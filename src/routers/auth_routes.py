import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..auth import create_access_token, hash_password, verify_password
from ..deps import get_current_user, get_db
from ..models import User
from ..schemas import LoginRequest, RegisterRequest, TokenResponse, UserOut

router = APIRouter()

ADMIN_SETUP_KEY = os.getenv("ADMIN_SETUP_KEY", "Charizard")


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
