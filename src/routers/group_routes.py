import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db
from ..models import Group, GroupMember, User
from ..schemas import GroupCreate, GroupJoin, GroupOut, UserOut

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


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        pronouns=user.pronouns,
        bio=user.bio,
        avatar_url=user.avatar_url,
        role=user.role,
        is_suspended=user.is_suspended,
    )


def _group_out(db: Session, group: Group) -> GroupOut:
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

    return GroupOut(
        id=group.id,
        name=group.name,
        invite_code=group.invite_code,
        member_count=member_count,
        member_preview=[_user_out(member) for member in members],
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
    return [_group_out(db, group) for group in groups]


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
    db.commit()
    db.refresh(group)

    return _group_out(db, group)


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
        return _group_out(db, group)

    db.add(GroupMember(user_id=current_user.id, group_id=group.id))
    db.commit()
    db.refresh(group)
    return _group_out(db, group)


@router.get("/{gid}", response_model=GroupOut)
def get_group(
    gid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _group_out(db, _ensure_member(db, gid, current_user.id))
