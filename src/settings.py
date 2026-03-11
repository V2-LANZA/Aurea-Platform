# src/settings.py
import os

# ---- Database ----
# default: sqlite in project folder
AUREA_DB_URL = os.getenv(
    "AUREA_DB_URL",
    "sqlite:///./aurea.db",
)

# ---- JWT / Auth ----
SECRET_KEY = os.getenv("AUREA_SECRET_KEY", "dev-secret-change-me")
ALGORITHM = os.getenv("AUREA_JWT_ALG", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("AUREA_JWT_EXPIRE_MIN", "10080"))  # 7 days