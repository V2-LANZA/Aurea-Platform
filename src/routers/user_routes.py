from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db
from ..models import FriendRequest, Friendship, User
from ..schemas import (
    FriendRequestActionRequest,
    FriendRequestOut,
    FriendRequestRespondRequest,
    FriendRequestSummaryOut,
    PublicUserOut,
    UserOut,
    UserUpdateRequest,
)

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


def _pending_friend_requests(db: Session, user_id: int) -> dict[int, tuple[str, int]]:
    requests = (
        db.query(FriendRequest)
        .filter(
            FriendRequest.status == "pending",
            or_(FriendRequest.requester_id == user_id, FriendRequest.receiver_id == user_id),
        )
        .all()
    )
    mapping: dict[int, tuple[str, int]] = {}
    for request in requests:
        if request.requester_id == user_id:
            mapping[request.receiver_id] = ("outgoing_pending", request.id)
        else:
            mapping[request.requester_id] = ("incoming_pending", request.id)
    return mapping


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


def _public_user_out(
    user: User,
    friend_ids: set[int],
    pending_requests: dict[int, tuple[str, int]] | None = None,
) -> PublicUserOut:
    pending_requests = pending_requests or {}
    friend_state = "friends" if user.id in friend_ids else "none"
    friend_request_id = None
    if friend_state == "none" and user.id in pending_requests:
        friend_state, friend_request_id = pending_requests[user.id]
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
        friend_state=friend_state,
        friend_request_id=friend_request_id,
    )


def _friendship_pair(user_id: int, friend_id: int) -> tuple[int, int]:
    return (user_id, friend_id) if user_id < friend_id else (friend_id, user_id)


def _friend_request_out(request: FriendRequest, friend_ids: set[int]) -> FriendRequestOut:
    return FriendRequestOut(
        id=request.id,
        status=request.status,
        created_at=request.created_at,
        responded_at=request.responded_at,
        requester=_public_user_out(request.requester, friend_ids),
        receiver=_public_user_out(request.receiver, friend_ids),
    )


def _ensure_no_existing_friendship(db: Session, left_id: int, right_id: int) -> None:
    existing = (
        db.query(Friendship)
        .filter(Friendship.user_id == left_id, Friendship.friend_id == right_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="You are already friends")


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
    pending_requests = _pending_friend_requests(db, current_user.id)
    if not friend_ids:
        return []

    users = (
        db.query(User)
        .filter(User.id.in_(friend_ids))
        .order_by(User.is_suspended.asc(), func.lower(User.username).asc())
        .all()
    )
    return [_public_user_out(user, friend_ids, pending_requests) for user in users]


@router.get("/friend-requests", response_model=FriendRequestSummaryOut)
def get_friend_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    friend_ids = _friend_ids(db, current_user.id)
    pending_requests = _pending_friend_requests(db, current_user.id)
    incoming = (
        db.query(FriendRequest)
        .filter(FriendRequest.receiver_id == current_user.id)
        .order_by(FriendRequest.created_at.desc())
        .all()
    )
    outgoing = (
        db.query(FriendRequest)
        .filter(FriendRequest.requester_id == current_user.id)
        .order_by(FriendRequest.created_at.desc())
        .all()
    )
    friends = (
        db.query(User)
        .filter(User.id.in_(friend_ids))
        .order_by(func.lower(User.username).asc())
        .all()
    ) if friend_ids else []
    return FriendRequestSummaryOut(
        incoming=[_friend_request_out(request, friend_ids) for request in incoming],
        outgoing=[_friend_request_out(request, friend_ids) for request in outgoing],
        friends=[_public_user_out(user, friend_ids, pending_requests) for user in friends],
    )


@router.get("/friends/summary", response_model=FriendRequestSummaryOut)
def get_friends_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_friend_requests(db=db, current_user=current_user)


@router.post("/friend-requests", response_model=FriendRequestOut, status_code=status.HTTP_201_CREATED)
def create_friend_request(
    payload: FriendRequestActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot add yourself")

    receiver = db.query(User).filter(User.id == payload.user_id).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="User not found")

    left_id, right_id = _friendship_pair(current_user.id, payload.user_id)
    _ensure_no_existing_friendship(db, left_id, right_id)

    existing = (
        db.query(FriendRequest)
        .filter(
            or_(
                (FriendRequest.requester_id == current_user.id) & (FriendRequest.receiver_id == payload.user_id),
                (FriendRequest.requester_id == payload.user_id) & (FriendRequest.receiver_id == current_user.id),
            )
        )
        .first()
    )

    if existing and existing.status == "pending":
        raise HTTPException(status_code=400, detail="A friend request is already pending")
    if existing and existing.status == "declined":
        existing.requester_id = current_user.id
        existing.receiver_id = payload.user_id
        existing.status = "pending"
        existing.responded_at = None
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return _friend_request_out(existing, _friend_ids(db, current_user.id))

    request = FriendRequest(
        requester_id=current_user.id,
        receiver_id=payload.user_id,
        status="pending",
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return _friend_request_out(request, _friend_ids(db, current_user.id))


@router.patch("/friend-requests/{request_id}", response_model=FriendRequestOut)
def respond_to_friend_request(
    request_id: int,
    payload: FriendRequestRespondRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request = db.query(FriendRequest).filter(FriendRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Friend request not found")
    if request.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="You cannot respond to this request")
    if request.status != "pending":
        raise HTTPException(status_code=400, detail="This request has already been handled")

    action = payload.action.strip().lower()
    if action not in {"accepted", "declined"}:
        raise HTTPException(status_code=400, detail="Action must be accepted or declined")

    request.status = action
    request.responded_at = datetime.now(timezone.utc)

    if action == "accepted":
        left_id, right_id = _friendship_pair(request.requester_id, request.receiver_id)
        existing = (
            db.query(Friendship)
            .filter(Friendship.user_id == left_id, Friendship.friend_id == right_id)
            .first()
        )
        if not existing:
            db.add(Friendship(user_id=left_id, friend_id=right_id))

    db.add(request)
    db.commit()
    db.refresh(request)
    return _friend_request_out(request, _friend_ids(db, current_user.id))


@router.get("/directory", response_model=list[PublicUserOut])
def get_directory(
    query: str = Query(default=""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    friend_ids = _friend_ids(db, current_user.id)
    pending_requests = _pending_friend_requests(db, current_user.id)
    users_query = (
        db.query(User)
        .filter(
            User.id != current_user.id,
            User.role != "admin",
            func.lower(User.username) != BOT_USERNAME,
        )
        .order_by(User.is_suspended.asc(), func.lower(User.username).asc())
    )
    if query.strip():
        pattern = f"%{query.strip().lower()}%"
        users_query = users_query.filter(func.lower(User.username).like(pattern))
    users = users_query.limit(50).all()
    return [_public_user_out(user, friend_ids, pending_requests) for user in users]


@router.get("/by-username/{username}", response_model=PublicUserOut)
def get_user_by_username(
    username: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(func.lower(User.username) == username.strip().lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _public_user_out(
        user,
        _friend_ids(db, current_user.id),
        _pending_friend_requests(db, current_user.id),
    )


@router.post("/friends/{user_id}", response_model=FriendRequestOut)
def add_friend(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return create_friend_request(
        payload=FriendRequestActionRequest(user_id=user_id),
        db=db,
        current_user=current_user,
    )


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
    requests = (
        db.query(FriendRequest)
        .filter(
            or_(
                (FriendRequest.requester_id == current_user.id) & (FriendRequest.receiver_id == user_id),
                (FriendRequest.requester_id == user_id) & (FriendRequest.receiver_id == current_user.id),
            )
        )
        .all()
    )
    for request in requests:
        db.delete(request)
    db.commit()

    return _public_user_out(friend, _friend_ids(db, current_user.id))
