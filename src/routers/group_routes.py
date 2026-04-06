import secrets
import string
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db
from ..models import Friendship, Group, GroupMember, Message, User, UserGroupState
from ..schemas import GroupCreate, GroupJoin, GroupOut, PublicUserOut, UnreadGroupCountOut, UnreadSummaryOut

router = APIRouter()


def _generate_invite_code(db: Session, length: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    while True:
        code = "".join(secrets.choice(alphabet) for _ in range(length))
        exists = db.query(Group).filter(Group.invite_code == code).first()
        if not exists:
            return code


def _ensure_member(db: Session, group_id: int, user_id: int) -> Group:
    group = (
        db.query(Group)
        .join(GroupMember, GroupMember.group_id == Group.id)
        .filter(Group.id == group_id, GroupMember.user_id == user_id)
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


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


def _user_out(user: User, friend_ids: set[int]) -> PublicUserOut:
    return PublicUserOut(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        pronouns=user.pronouns,
        bio=user.bio,
        avatar_url=user.avatar_url,
        role=user.role,
        is_suspended=user.is_suspended,
        is_available=not user.is_suspended,
        is_friend=user.id in friend_ids,
    )


def _ensure_group_state(db: Session, user_id: int, group_id: int) -> UserGroupState:
    state = (
        db.query(UserGroupState)
        .filter(UserGroupState.user_id == user_id, UserGroupState.group_id == group_id)
        .first()
    )
    if state:
        return state

    state = UserGroupState(user_id=user_id, group_id=group_id)
    db.add(state)
    db.commit()
    db.refresh(state)
    return state


def _group_out(db: Session, group: Group, current_user_id: int) -> GroupOut:
    members = (
        db.query(User)
        .join(GroupMember, GroupMember.user_id == User.id)
        .filter(GroupMember.group_id == group.id)
        .order_by(GroupMember.joined_at.asc())
        .limit(4)
        .all()
    )
    member_count = (
        db.query(GroupMember)
        .filter(GroupMember.group_id == group.id)
        .count()
    )
    friend_ids = _friend_ids(db, current_user_id)

    return GroupOut(
        id=group.id,
        name=group.name,
        invite_code=group.invite_code,
        member_count=member_count,
        member_preview=[_user_out(member, friend_ids) for member in members],
    )


@router.get("", response_model=list[GroupOut])
def list_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    groups = (
        db.query(Group)
        .join(GroupMember, GroupMember.group_id == Group.id)
        .filter(GroupMember.user_id == current_user.id)
        .order_by(Group.created_at.desc())
        .all()
    )
    for group in groups:
        _ensure_group_state(db, current_user.id, group.id)
    return [_group_out(db, group, current_user.id) for group in groups]


@router.post("", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
def create_group(
    payload: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Group name is required")

    group = Group(
        name=name,
        invite_code=_generate_invite_code(db),
        created_by_id=current_user.id,
    )
    db.add(group)
    db.commit()
    db.refresh(group)

    membership = GroupMember(user_id=current_user.id, group_id=group.id)
    db.add(membership)
    db.flush()
    db.add(UserGroupState(user_id=current_user.id, group_id=group.id))
    db.commit()
    db.refresh(group)

    return _group_out(db, group, current_user.id)


@router.post("/join", response_model=GroupOut)
def join_group(
    payload: GroupJoin,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invite_code = payload.invite_code.strip().upper()
    if not invite_code:
        raise HTTPException(status_code=400, detail="Invite code is required")

    group = db.query(Group).filter(Group.invite_code == invite_code).first()
    if not group:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    existing = (
        db.query(GroupMember)
        .filter(
            GroupMember.group_id == group.id,
            GroupMember.user_id == current_user.id,
        )
        .first()
    )
    if existing:
        _ensure_group_state(db, current_user.id, group.id)
        return _group_out(db, group, current_user.id)

    db.add(GroupMember(user_id=current_user.id, group_id=group.id))
    db.flush()
    db.add(UserGroupState(user_id=current_user.id, group_id=group.id))
    db.commit()
    db.refresh(group)
    return _group_out(db, group, current_user.id)


@router.get("/unread-summary", response_model=UnreadSummaryOut)
def get_unread_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    memberships = (
        db.query(GroupMember)
        .filter(GroupMember.user_id == current_user.id)
        .all()
    )
    summaries: list[UnreadGroupCountOut] = []
    total_unread = 0

    for membership in memberships:
        state = _ensure_group_state(db, current_user.id, membership.group_id)
        query = db.query(Message).filter(
            Message.group_id == membership.group_id,
            Message.user_id != current_user.id,
        )
        if state.last_read_message_id:
            query = query.filter(Message.id > state.last_read_message_id)

        unread_count = query.count()
        summaries.append(
            UnreadGroupCountOut(group_id=membership.group_id, unread_count=unread_count)
        )
        total_unread += unread_count

    return UnreadSummaryOut(total_unread=total_unread, groups=summaries)


@router.post("/{gid}/read", response_model=UnreadGroupCountOut)
def mark_group_as_read(
    gid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_member(db, gid, current_user.id)
    state = _ensure_group_state(db, current_user.id, gid)
    latest_message = (
        db.query(Message)
        .filter(Message.group_id == gid)
        .order_by(Message.id.desc())
        .first()
    )
    state.last_read_message_id = latest_message.id if latest_message else state.last_read_message_id
    state.last_read_at = datetime.now(timezone.utc)
    db.add(state)
    db.commit()
    return UnreadGroupCountOut(group_id=gid, unread_count=0)


@router.post("/read-all", response_model=UnreadSummaryOut)
def mark_all_groups_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    memberships = (
        db.query(GroupMember)
        .filter(GroupMember.user_id == current_user.id)
        .all()
    )
    for membership in memberships:
        state = _ensure_group_state(db, current_user.id, membership.group_id)
        latest_message = (
            db.query(Message)
            .filter(Message.group_id == membership.group_id)
            .order_by(Message.id.desc())
            .first()
        )
        if latest_message:
            state.last_read_message_id = latest_message.id
        state.last_read_at = datetime.now(timezone.utc)
        db.add(state)

    db.commit()
    return UnreadSummaryOut(
        total_unread=0,
        groups=[UnreadGroupCountOut(group_id=membership.group_id, unread_count=0) for membership in memberships],
    )


@router.get("/{gid}", response_model=GroupOut)
def get_group(
    gid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_group_state(db, current_user.id, gid)
    return _group_out(db, _ensure_member(db, gid, current_user.id), current_user.id)
