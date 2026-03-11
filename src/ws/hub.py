# aurea-platform/src/ws/hub.py
from __future__ import annotations

from collections import defaultdict
from typing import Dict, Any
from fastapi import WebSocket


class ConnectionManager:
    """
    Keeps active websocket connections per group.
    groups[gid][uid] = websocket
    """
    def __init__(self) -> None:
        self.groups: Dict[int, Dict[int, WebSocket]] = defaultdict(dict)

    async def connect(self, gid: int, uid: int, ws: WebSocket) -> None:
        self.groups[gid][uid] = ws

    def disconnect(self, gid: int, uid: int) -> None:
        if gid in self.groups and uid in self.groups[gid]:
            del self.groups[gid][uid]
        if gid in self.groups and not self.groups[gid]:
            del self.groups[gid]

    async def broadcast(self, gid: int, payload: Dict[str, Any]) -> None:
        """
        Send JSON to everyone in a group.
        If a socket fails, drop it.
        """
        dead = []
        for uid, ws in list(self.groups.get(gid, {}).items()):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(uid)

        for uid in dead:
            self.disconnect(gid, uid)

    async def send_to_user(self, gid: int, uid: int, payload: Dict[str, Any]) -> None:
        ws = self.groups.get(gid, {}).get(uid)
        if ws:
            await ws.send_json(payload)


manager = ConnectionManager()
