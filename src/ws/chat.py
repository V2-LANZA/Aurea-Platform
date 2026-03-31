import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..auth import decode_token, hash_password
from ..db import SessionLocal
from ..models import Alert, GroupMember, Message, User
from ..services.bot import build_alert_detail, build_bot_reply, humanize_reasons
from ..services.detect import analyze
from .hub import manager

router = APIRouter()

RISK_THRESHOLD = 0.3
BOT_USERNAME = "__aurea_bot__"
BOT_EMAIL = "aurea-bot@local"


def _extract_content(raw: str) -> str:
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return str(data.get("content", "")).strip()
    except json.JSONDecodeError:
        pass
    return raw.strip()


def _display_name(user: User | None) -> str:
    if not user:
        return "unknown"
    return user.full_name or user.username


def _get_or_create_bot_user(db) -> User:
    bot = db.query(User).filter(User.username == BOT_USERNAME).first()
    if bot:
        return bot

    bot = User(
        username=BOT_USERNAME,
        email=BOT_EMAIL,
        full_name="Aurea Bot",
        password_hash=hash_password("bot-not-for-login"),
    )
    db.add(bot)
    db.commit()
    db.refresh(bot)
    return bot


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

        if not user or not member:
            await websocket.close(code=4403, reason="Not a member of this group")
            return

        await manager.connect(group_id, websocket)

        await manager.send_personal(
            websocket,
            {
                "type": "system",
                "detail": f"Connected to group {group_id}",
            },
        )

        while True:
            raw = await websocket.receive_text()
            content = _extract_content(raw)

            if not content:
                continue

            message = Message(
                group_id=group_id,
                user_id=user.id,
                content=content,
            )
            db.add(message)
            db.commit()
            db.refresh(message)

            score, reasons = analyze(content)

            await manager.broadcast(
                group_id,
                {
                    "type": "message",
                    "id": message.id,
                    "group_id": group_id,
                    "user_id": user.id,
                    "username": _display_name(user),
                    "full_name": user.full_name,
                    "pronouns": user.pronouns,
                    "avatar_url": user.avatar_url,
                    "content": message.content,
                    "created_at": message.created_at.isoformat() if message.created_at else None,
                },
            )

            if score >= RISK_THRESHOLD:
                severity = "high" if score >= 1 else "medium"
                alert = Alert(
                    group_id=group_id,
                    message_id=message.id,
                    sender_username=user.username,
                    trigger_text=message.content,
                    matched_reasons=", ".join(humanize_reasons(reasons)) or None,
                    severity=severity,
                    level="flagged",
                    detail=build_alert_detail(reasons),
                )
                db.add(alert)
                db.commit()

                bot_text = build_bot_reply(content, score, reasons)
                if bot_text:
                    bot_user = _get_or_create_bot_user(db)

                    bot_message = Message(
                        group_id=group_id,
                        user_id=bot_user.id,
                        content=bot_text,
                    )
                    db.add(bot_message)
                    db.commit()
                    db.refresh(bot_message)

                    await manager.broadcast(
                        group_id,
                        {
                            "type": "bot",
                            "id": bot_message.id,
                            "group_id": group_id,
                            "user_id": bot_user.id,
                            "username": _display_name(bot_user),
                            "full_name": bot_user.full_name,
                            "pronouns": bot_user.pronouns,
                            "avatar_url": bot_user.avatar_url,
                            "content": bot_message.content,
                            "created_at": bot_message.created_at.isoformat() if bot_message.created_at else None,
                        },
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
