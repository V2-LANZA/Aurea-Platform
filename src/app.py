from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from .db import engine, Base
from .routers import auth_routes, group_routes, message_routes, alert_routes, user_routes
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


@app.get("/health")
def health():
    return {"status": "ok"}


# IMPORTANT: prefixes are defined HERE
app.include_router(auth_routes.router, prefix="/auth", tags=["auth"])
app.include_router(user_routes.router, prefix="/users", tags=["users"])
app.include_router(group_routes.router, prefix="/groups", tags=["groups"])
app.include_router(message_routes.router, prefix="/messages", tags=["messages"])
app.include_router(alert_routes.router, prefix="/alerts", tags=["alerts"])

app.include_router(ws_router)


@app.get("/")
def root():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"name": "Aurea API", "docs": "/docs", "health": "/health"}