import json
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import or_

from ..auth import decode_token
from ..db import SessionLocal
from ..models import Group, GroupMember, GroupRestriction, User
from ..services.messages_service import process_message, serialize_message
from ..services.bot import BOT_DISPLAY_NAME, BOT_USERNAME
from .hub import manager

router = APIRouter()


def _extract_content(raw: str) -> str:
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return str(data.get("content", "")).strip()
    except json.JSONDecodeError:
        pass
    return raw.strip()


@router.websocket("/ws/chat/{group_id}")
async def chat_socket(websocket: WebSocket, group_id: int):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4401, reason="Missing token")
        return

    try:
        payload = decode_token(token)
    except Exception:
        await websocket.close(code=4401, reason="Invalid/expired token")
        return

    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=4401, reason="Invalid token payload")
        return

    db = SessionLocal()

    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
        member = db.query(GroupMember).filter_by(group_id=group_id, user_id=int(user_id)).first()
        group = db.query(Group).filter(Group.id == group_id).first()

        if not user or not member or not group:
            await websocket.close(code=4403, reason="Not a member of this group")
            return
        if user.is_suspended:
            await websocket.close(code=4403, reason="Your account is suspended")
            return

        await manager.connect(group_id, websocket)

        while True:
            raw = await websocket.receive_text()
            content = _extract_content(raw)

            if not content:
                continue

            db.refresh(user)
            if user.is_suspended:
                await websocket.close(code=4403, reason="Your account is suspended")
                return
            db.refresh(group)
            if group.is_suspended and user.role != "admin":
                await websocket.send_json(
                    {
                        "type": "system",
                        "message_type": "system",
                        "is_bot": True,
                        "username": BOT_USERNAME,
                        "full_name": BOT_DISPLAY_NAME,
                        "detail": "This group has been suspended by an admin. Messages are disabled.",
                    }
                )
                continue
            restriction = (
                db.query(GroupRestriction)
                .filter(
                    GroupRestriction.group_id == group_id,
                    GroupRestriction.user_id == int(user_id),
                    GroupRestriction.resolved_at.is_(None),
                    or_(
                        GroupRestriction.restricted_until.is_(None),
                        GroupRestriction.restricted_until > datetime.now(timezone.utc),
                    ),
                )
                .first()
            )
            if restriction:
                await websocket.send_json(
                    {
                        "type": "system",
                        "message_type": "system",
                        "is_bot": True,
                        "username": BOT_USERNAME,
                        "full_name": BOT_DISPLAY_NAME,
                        "detail": "You are restricted from sending messages in this group.",
                    }
                )
                continue

            result = process_message(
                db,
                group_id=group_id,
                sender=user,
                content=content,
            )

            if result.sender_notice:
                await websocket.send_json(
                    {
                        "type": "system",
                        "message_type": "system",
                        "is_bot": True,
                        "username": BOT_USERNAME,
                        "full_name": BOT_DISPLAY_NAME,
                        "detail": result.sender_notice,
                    }
                )

            await manager.broadcast(
                group_id,
                serialize_message(result.user_message),
            )

            if result.bot_message:
                await manager.broadcast(
                    group_id,
                    serialize_message(result.bot_message, "bot"),
                )

    except WebSocketDisconnect:
        manager.disconnect(group_id, websocket)
    except Exception:
        manager.disconnect(group_id, websocket)
        try:
            await websocket.close(code=1011, reason="Server error")
        except Exception:
            pass
    finally:
        db.close()
