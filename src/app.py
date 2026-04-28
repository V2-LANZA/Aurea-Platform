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
    report_routes,
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
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
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

        if "groups" in tables:
            group_columns = {column["name"] for column in inspector.get_columns("groups")}
            group_additions = {
                "is_suspended": "ALTER TABLE groups ADD COLUMN is_suspended BOOLEAN DEFAULT 0 NOT NULL",
                "suspended_at": "ALTER TABLE groups ADD COLUMN suspended_at DATETIME",
                "suspended_by_id": "ALTER TABLE groups ADD COLUMN suspended_by_id INTEGER",
                "suspension_reason": "ALTER TABLE groups ADD COLUMN suspension_reason TEXT",
            }
            for column_name, statement in group_additions.items():
                if column_name not in group_columns:
                    connection.execute(text(statement))

        if "group_restrictions" in tables:
            restriction_columns = {column["name"] for column in inspector.get_columns("group_restrictions")}
            restriction_additions = {
                "restricted_until": "ALTER TABLE group_restrictions ADD COLUMN restricted_until DATETIME",
                "restricted_by_system": "ALTER TABLE group_restrictions ADD COLUMN restricted_by_system BOOLEAN DEFAULT 0 NOT NULL",
            }
            for column_name, statement in restriction_additions.items():
                if column_name not in restriction_columns:
                    connection.execute(text(statement))

        if "alerts" in tables:
            alert_columns = {column["name"] for column in inspector.get_columns("alerts")}
            if "admin_note" not in alert_columns:
                connection.execute(text("ALTER TABLE alerts ADD COLUMN admin_note TEXT"))
            connection.execute(
                text(
                    """
                    UPDATE alerts
                    SET status = CASE
                        WHEN status = 'pending' THEN 'pending_review'
                        WHEN status = 'escalated' THEN 'high_risk'
                        ELSE status
                    END
                    """
                )
            )

        if "user_reports" in tables:
            report_columns = {column["name"] for column in inspector.get_columns("user_reports")}
            if "admin_note" not in report_columns:
                connection.execute(text("ALTER TABLE user_reports ADD COLUMN admin_note TEXT"))

        if "friend_requests" in tables:
            request_columns = {column["name"] for column in inspector.get_columns("friend_requests")}
            if "responded_at" not in request_columns:
                connection.execute(text("ALTER TABLE friend_requests ADD COLUMN responded_at DATETIME"))

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
app.include_router(report_routes.router, prefix="/reports", tags=["reports"])
app.include_router(admin_routes.router, prefix="/admin", tags=["admin"])
app.include_router(ws_router)


@app.get("/")
def root():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"name": "Aurea API", "docs": "/docs", "health": "/health"}
