import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..auth import create_access_token, hash_password, verify_password
from ..deps import get_current_user, get_db
from ..models import PasswordResetToken, User
from ..schemas import (
    LoginRequest,
    PasswordForgotRequest,
    PasswordForgotResponse,
    PasswordResetRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)

router = APIRouter()

ADMIN_SETUP_KEY = os.getenv("ADMIN_SETUP_KEY", "Charizard")
APP_ENV = os.getenv("APP_ENV", "development").lower()
RESET_TOKEN_MINUTES = 30


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    username = payload.username.strip()
    username_lookup = username.lower()
    email = payload.email.strip().lower()
    full_name = payload.full_name.strip() if payload.full_name else None
    pronouns = payload.pronouns.strip() if payload.pronouns else None
    bio = payload.bio.strip() if payload.bio else None
    avatar_url = payload.avatar_url.strip() if payload.avatar_url else None
    password = payload.password
    date_of_birth = payload.date_of_birth

    if not username or not password or not email:
        raise HTTPException(
            status_code=400,
            detail="Username, email, date of birth, and password are required",
        )

    if email and "@" not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email")

    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")

    existing_username = db.query(User).filter(func.lower(User.username) == username_lookup).first()
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already exists")

    existing_email = db.query(User).filter(func.lower(User.email) == email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already exists")

    role = "user"
    if payload.admin_setup_key and payload.admin_setup_key == ADMIN_SETUP_KEY:
        role = "admin"

    user = User(
        username=username,
        email=email,
        date_of_birth=date_of_birth,
        full_name=full_name,
        pronouns=pronouns,
        bio=bio,
        avatar_url=avatar_url,
        password_hash=hash_password(password),
        role=role,
        is_suspended=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    username = payload.username.strip()
    password = payload.password

    user = db.query(User).filter(func.lower(User.username) == username.lower()).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    if user.is_suspended:
        raise HTTPException(status_code=403, detail="Your account has been suspended")

    token = create_access_token(user.id, user.username)
    return TokenResponse(
        access_token=token,
        username=user.username,
        email=user.email,
        role=user.role,
    )


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/forgot-password", response_model=PasswordForgotResponse)
def forgot_password(payload: PasswordForgotRequest, db: Session = Depends(get_db)):
    identity = payload.identity.strip().lower()
    message = "If an account matches that email or username, a reset link has been prepared."

    if not identity:
        return PasswordForgotResponse(message=message)

    user = (
        db.query(User)
        .filter(or_(func.lower(User.username) == identity, func.lower(User.email) == identity))
        .first()
    )
    if not user:
        return PasswordForgotResponse(message=message)

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_MINUTES)

    reset_token = PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=expires_at,
    )
    db.add(reset_token)
    db.commit()

    reset_url = f"/reset-password?token={token}"
    if APP_ENV != "production":
        print(f"[Aurea Reset] user={user.username} reset_url={reset_url}")
        return PasswordForgotResponse(message=message, reset_token=token, reset_url=reset_url)

    return PasswordForgotResponse(message=message)


@router.post("/reset-password")
def reset_password(payload: PasswordResetRequest, db: Session = Depends(get_db)):
    token_value = payload.token.strip()
    password = payload.password
    reset_token = db.query(PasswordResetToken).filter(PasswordResetToken.token == token_value).first()

    if not reset_token:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if reset_token.used_at is not None:
        raise HTTPException(status_code=400, detail="This reset token has already been used")
    if reset_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(password)
    reset_token.used_at = datetime.now(timezone.utc)
    db.add(user)
    db.add(reset_token)
    db.commit()
    return {"message": "Password reset successfully"}
