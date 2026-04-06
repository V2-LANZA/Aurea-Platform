from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db
from ..models import Friendship, User
from ..schemas import PublicUserOut, UserOut, UserUpdateRequest

router = APIRouter()
BOT_USERNAME = "__aurea_bot__"


def _is_available(user: User) -> bool:
    return not user.is_suspended


def _friend_ids(db: Session, user_id: int) -> set[int]:
    friendships = (
        db.query(Friendship)
        .filter(or_(Friendship.user_id == user_id, Friendship.friend_id == user_id))
        .all()
    )
    ids: set[int] = set()
    for friendship in friendships:
        ids.add(friendship.friend_id if friendship.user_id == user_id else friendship.user_id)
    return ids


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        date_of_birth=user.date_of_birth,
        full_name=user.full_name,
        pronouns=user.pronouns,
        bio=user.bio,
        avatar_url=user.avatar_url,
        role=user.role,
        is_suspended=user.is_suspended,
        is_available=_is_available(user),
    )


def _public_user_out(user: User, friend_ids: set[int]) -> PublicUserOut:
    return PublicUserOut(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        pronouns=user.pronouns,
        bio=user.bio,
        avatar_url=user.avatar_url,
        role=user.role,
        is_suspended=user.is_suspended,
        is_available=_is_available(user),
        is_friend=user.id in friend_ids,
    )


def _friendship_pair(user_id: int, friend_id: int) -> tuple[int, int]:
    return (user_id, friend_id) if user_id < friend_id else (friend_id, user_id)


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return _user_out(current_user)


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
    return _user_out(current_user)


@router.get("/friends", response_model=list[PublicUserOut])
def get_friends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    friend_ids = _friend_ids(db, current_user.id)
    if not friend_ids:
        return []

    users = (
        db.query(User)
        .filter(User.id.in_(friend_ids))
        .order_by(User.is_suspended.asc(), func.lower(User.username).asc())
        .all()
    )
    return [_public_user_out(user, friend_ids) for user in users]


@router.get("/directory", response_model=list[PublicUserOut])
def get_directory(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    friend_ids = _friend_ids(db, current_user.id)
    users = (
        db.query(User)
        .filter(
            User.id != current_user.id,
            User.role != "admin",
            func.lower(User.username) != BOT_USERNAME,
        )
        .order_by(User.is_suspended.asc(), func.lower(User.username).asc())
        .all()
    )
    return [_public_user_out(user, friend_ids) for user in users]


@router.get("/by-username/{username}", response_model=PublicUserOut)
def get_user_by_username(
    username: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(func.lower(User.username) == username.strip().lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _public_user_out(user, _friend_ids(db, current_user.id))


@router.post("/friends/{user_id}", response_model=PublicUserOut)
def add_friend(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot add yourself")

    friend = db.query(User).filter(User.id == user_id).first()
    if not friend:
        raise HTTPException(status_code=404, detail="User not found")

    left_id, right_id = _friendship_pair(current_user.id, user_id)
    existing = (
        db.query(Friendship)
        .filter(Friendship.user_id == left_id, Friendship.friend_id == right_id)
        .first()
    )
    if not existing:
        db.add(Friendship(user_id=left_id, friend_id=right_id))
        db.commit()

    return _public_user_out(friend, _friend_ids(db, current_user.id))


@router.delete("/friends/{user_id}", response_model=PublicUserOut)
def remove_friend(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    friend = db.query(User).filter(User.id == user_id).first()
    if not friend:
        raise HTTPException(status_code=404, detail="User not found")

    left_id, right_id = _friendship_pair(current_user.id, user_id)
    friendship = (
        db.query(Friendship)
        .filter(Friendship.user_id == left_id, Friendship.friend_id == right_id)
        .first()
    )
    if friendship:
        db.delete(friendship)
        db.commit()

    return _public_user_out(friend, _friend_ids(db, current_user.id))
