from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..schemas import RegisterIn, LoginIn, TokenOut
from ..models import User
from ..auth import hash_password, verify_password, make_token
from ..deps import get_db

router = APIRouter()  # IMPORTANT: no prefix here


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    # We store "username" into the User.email field (so you don't have to redo DB right now)
    existing = db.query(User).filter_by(email=payload.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")

    u = User(email=payload.username, password_hash=hash_password(payload.password))
    db.add(u)
    db.commit()
    db.refresh(u)
    return TokenOut(access_token=make_token(u.id))


@router.post("/signup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def signup(payload: RegisterIn, db: Session = Depends(get_db)):
    # alias endpoint if something still calls /auth/signup
    return register(payload, db)


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    u = db.query(User).filter_by(email=payload.username).first()
    if not u or not verify_password(payload.password, u.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return TokenOut(access_token=make_token(u.id))