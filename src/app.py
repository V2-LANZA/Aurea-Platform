from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text

from .db import Base, engine
from .routers import (
    admin_routes,
    alert_routes,
    auth_routes,
    group_routes,
    message_routes,
    user_routes,
)
from .ws.chat import router as ws_router

app = FastAPI(title="Aurea API")

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    _ensure_runtime_schema()


def _ensure_runtime_schema():
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "users" not in tables:
        return

    columns = {column["name"] for column in inspector.get_columns("users")}
    additions = {
        "date_of_birth": "ALTER TABLE users ADD COLUMN date_of_birth DATE",
        "pronouns": "ALTER TABLE users ADD COLUMN pronouns VARCHAR(50)",
        "bio": "ALTER TABLE users ADD COLUMN bio TEXT",
        "avatar_url": "ALTER TABLE users ADD COLUMN avatar_url TEXT",
    }

    with engine.begin() as connection:
        for column_name, statement in additions.items():
            if column_name not in columns:
                connection.execute(text(statement))

        if "user_group_states" in tables and "group_members" in tables:
            connection.execute(
                text(
                    """
                    INSERT INTO user_group_states (user_id, group_id)
                    SELECT gm.user_id, gm.group_id
                    FROM group_members gm
                    LEFT JOIN user_group_states ugs
                      ON ugs.user_id = gm.user_id AND ugs.group_id = gm.group_id
                    WHERE ugs.id IS NULL
                    """
                )
            )


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth_routes.router, prefix="/auth", tags=["auth"])
app.include_router(user_routes.router, prefix="/users", tags=["users"])
app.include_router(group_routes.router, prefix="/groups", tags=["groups"])
app.include_router(message_routes.router)
app.include_router(alert_routes.router, prefix="/alerts", tags=["alerts"])
app.include_router(admin_routes.router, prefix="/admin", tags=["admin"])
app.include_router(ws_router)


@app.get("/")
def root():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"name": "Aurea API", "docs": "/docs", "health": "/health"}
