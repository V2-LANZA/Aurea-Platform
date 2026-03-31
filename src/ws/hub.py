from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect(self, group_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[group_id].add(websocket)

    def disconnect(self, group_id: int, websocket: WebSocket):
        if group_id in self.active_connections and websocket in self.active_connections[group_id]:
            self.active_connections[group_id].remove(websocket)
            if not self.active_connections[group_id]:
                self.active_connections.pop(group_id, None)

    async def send_personal(self, websocket: WebSocket, payload: dict):
        await websocket.send_json(payload)

    async def broadcast(self, group_id: int, payload: dict):
        dead = []

        for websocket in list(self.active_connections.get(group_id, set())):
            try:
                await websocket.send_json(payload)
            except Exception:
                dead.append(websocket)

        for websocket in dead:
            self.disconnect(group_id, websocket)


manager = ConnectionManager()