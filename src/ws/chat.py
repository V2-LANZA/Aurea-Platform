from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Set, Optional, Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from ..deps import get_db
from ..auth import get_current_user_ws
from ..models import GroupMember  # adjust if your membership model is named differently

router = APIRouter()


# -----------------------------
# Connection manager (per group)
# -----------------------------
@dataclass
class Connection:
    ws: WebSocket
    user_id: int
    username: str


class GroupHub:
    def __init__(self) -> None:
        self.groups: Dict[int, Set[Connection]] = {}

    def add(self, group_id: int, conn: Connection) -> None:
        if group_id not in self.groups:
            self.groups[group_id] = set()
        self.groups[group_id].add(conn)

    def remove(self, group_id: int, conn: Connection) -> None:
        if group_id in self.groups:
            self.groups[group_id].discard(conn)
            if not self.groups[group_id]:
                del self.groups[group_id]

    async def broadcast(self, group_id: int, payload: dict) -> None:
        conns = list(self.groups.get(group_id, []))
        dead: list[Connection] = []
        for c in conns:
            try:
                await c.ws.send_json(payload)
            except Exception:
                dead.append(c)
        for d in dead:
            self.remove(group_id, d)


hub = GroupHub()


# -----------------------------
# Helpers
# -----------------------------
def _db_session() -> Session:
    """
    get_db() is a generator dependency in FastAPI.
    In WebSockets, we manually create a session by advancing it once.
    """
    gen = get_db()
    return next(gen)


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_member(db: Session, group_id: int, user_id: int) -> bool:
    return (
        db.query(GroupMember)
        .filter(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
        .first()
        is not None
    )


def _risk_analyse(text: str) -> dict:
    """
    Optional stub.
    If you already have a real risk flagger, replace this with your function.
    Return shape:
      { "flagged": bool, "score": number|None, "reasons": [..] }
    """
    lowered = text.lower()
    reasons = []
    score = 0.0

    keywords = ["meet me", "address", "send pics", "nude", "where do you live", "alone", "secret"]
    for k in keywords:
        if k in lowered:
            reasons.append(k)
            score += 15

    flagged = score >= 20
    return {"flagged": flagged, "score": score if flagged else None, "reasons": reasons if flagged else []}


# -----------------------------
# WebSocket endpoint
# -----------------------------
@router.websocket("/ws/chat/{group_id}")
async def ws_chat(websocket: WebSocket, group_id: int):
    db = _db_session()

    # 1) Validate token and get user
    try:
        user = await get_current_user_ws(websocket, db)
    except Exception:
        # accept then send error so frontend sees JSON
        await websocket.accept()
        await websocket.send_json({"type": "error", "detail": "Invalid/expired token"})
        await websocket.close()
        return

    username = getattr(user, "email", None) or getattr(user, "username", None) or f"user-{user.id}"

    # 2) Membership check
    if not _is_member(db, group_id, user.id):
        await websocket.accept()
        await websocket.send_json({"type": "error", "detail": "Not a member of this group"})
        await websocket.close()
        return

    # 3) Accept WS + register connection
    await websocket.accept()
    conn = Connection(ws=websocket, user_id=user.id, username=str(username))
    hub.add(group_id, conn)

    # 4) Notify join
    await hub.broadcast(
        group_id,
        {
            "id": None,
            "from": "system",
            "text": f"{conn.username} joined group {group_id}",
            "created_at": _iso_now(),
        },
    )

    try:
        while True:
            raw = await websocket.receive_text()

            # We accept either:
            #  - JSON: {"text":"hello"}
            #  - plain text
            text = raw
            try:
                import json
                data = json.loads(raw)
                if isinstance(data, dict) and "text" in data:
                    text = str(data["text"])
            except Exception:
                pass

            text = text.strip()
            if not text:
                continue

            # 5) Risk analysis
            risk = _risk_analyse(text)

            # 6) Broadcast message to group
            payload = {
                "id": None,  # if you save messages, set actual id
                "from": conn.username,
                "text": text,
                "created_at": _iso_now(),
                "risk": risk,
            }

            await hub.broadcast(group_id, payload)

    except WebSocketDisconnect:
        hub.remove(group_id, conn)
        await hub.broadcast(
            group_id,
            {
                "id": None,
                "from": "system",
                "text": f"{conn.username} left",
                "created_at": _iso_now(),
            },
        )
    except Exception:
        hub.remove(group_id, conn)
        try:
            await websocket.close()
        except Exception:
            pass