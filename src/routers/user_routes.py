from fastapi import APIRouter, Depends

from ..deps import get_current_user
from ..models import User
from ..schemas import UserOut, UserUpdateRequest
from sqlalchemy.orm import Session
from ..deps import get_db

router = APIRouter()


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.full_name = payload.full_name.strip() if payload.full_name else None
    current_user.pronouns = payload.pronouns.strip() if payload.pronouns else None
    current_user.bio = payload.bio.strip() if payload.bio else None
    current_user.avatar_url = payload.avatar_url.strip() if payload.avatar_url else None
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user
