import secrets
import string
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db
from ..models import Alert, Friendship, Group, GroupMember, GroupRestriction, Message, User, UserGroupState, UserMute, UserReport
from ..models import FriendRequest
from ..schemas import (
    GroupCreate,
    GroupJoin,
    GroupOut,
    PublicUserOut,
    UnreadGroupCountOut,
    UnreadSummaryOut,
    UserMuteCreateRequest,
    UserMuteOut,
)

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


def _get_membership(db: Session, group_id: int, user_id: int) -> GroupMember:
    membership = (
        db.query(GroupMember)
        .filter(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=404, detail="Group not found")
    return membership


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


def _user_out(
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
        is_available=not user.is_suspended,
        is_friend=user.id in friend_ids,
        is_restricted_in_group=False,
        friend_state=friend_state,
        friend_request_id=friend_request_id,
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
    pending_requests = _pending_friend_requests(db, current_user_id)

    return GroupOut(
        id=group.id,
        name=group.name,
        invite_code=group.invite_code,
        created_by_id=group.created_by_id,
        is_suspended=group.is_suspended,
        suspension_reason=group.suspension_reason,
        member_count=member_count,
        member_preview=[_user_out(member, friend_ids, pending_requests) for member in members],
    )


def _group_members_out(db: Session, group_id: int, current_user_id: int) -> list[PublicUserOut]:
    members = (
        db.query(User)
        .join(GroupMember, GroupMember.user_id == User.id)
        .filter(GroupMember.group_id == group_id)
        .order_by(func.lower(User.username).asc())
        .all()
    )
    friend_ids = _friend_ids(db, current_user_id)
    pending_requests = _pending_friend_requests(db, current_user_id)
    return [_user_out(member, friend_ids, pending_requests) for member in members]


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
        if membership.joined_at:
            query = query.filter(Message.created_at >= membership.joined_at)
        if state.last_read_message_id:
            query = query.filter(Message.id > state.last_read_message_id)

        unread_count = query.count()
        summaries.append(
            UnreadGroupCountOut(group_id=membership.group_id, unread_count=unread_count)
        )
        total_unread += unread_count

    return UnreadSummaryOut(total_unread=total_unread, groups=summaries)


@router.get("/unread-counts", response_model=UnreadSummaryOut)
def get_unread_counts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_unread_summary(db=db, current_user=current_user)


@router.post("/{gid}/read", response_model=UnreadGroupCountOut)
def mark_group_as_read(
    gid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    membership = _get_membership(db, gid, current_user.id)
    state = _ensure_group_state(db, current_user.id, gid)
    latest_query = db.query(Message).filter(Message.group_id == gid)
    if membership.joined_at:
        latest_query = latest_query.filter(Message.created_at >= membership.joined_at)
    latest_message = (
        latest_query
        .order_by(Message.id.desc())
        .first()
    )
    state.last_read_message_id = latest_message.id if latest_message else state.last_read_message_id
    state.last_read_at = datetime.now(timezone.utc)
    db.add(state)
    db.commit()
    return UnreadGroupCountOut(group_id=gid, unread_count=0)


@router.patch("/{gid}/read", response_model=UnreadGroupCountOut)
def mark_group_as_read_patch(
    gid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return mark_group_as_read(gid=gid, db=db, current_user=current_user)


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
        latest_query = db.query(Message).filter(Message.group_id == membership.group_id)
        if membership.joined_at:
            latest_query = latest_query.filter(Message.created_at >= membership.joined_at)
        latest_message = (
            latest_query
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


@router.get("/{gid}/members", response_model=list[PublicUserOut])
def get_group_members(
    gid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_member(db, gid, current_user.id)
    return _group_members_out(db, gid, current_user.id)


@router.delete("/{gid}/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_group(
    gid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = _ensure_member(db, gid, current_user.id)
    membership = _get_membership(db, gid, current_user.id)

    if group.created_by_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="Group creators cannot leave this group until ownership transfer is supported.",
        )

    db.query(UserMute).filter(
        UserMute.group_id == gid,
        or_(
            UserMute.muter_id == current_user.id,
            UserMute.muted_user_id == current_user.id,
        ),
    ).delete(synchronize_session=False)
    db.query(UserGroupState).filter(
        UserGroupState.user_id == current_user.id,
        UserGroupState.group_id == gid,
    ).delete(synchronize_session=False)
    db.delete(membership)
    db.commit()
    return None


@router.delete("/{gid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    gid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = db.query(Group).filter(Group.id == gid).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    membership = (
        db.query(GroupMember)
        .filter(GroupMember.group_id == gid, GroupMember.user_id == current_user.id)
        .first()
    )
    if current_user.role != "admin" and group.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="You cannot delete this group")
    if current_user.role != "admin" and not membership:
        raise HTTPException(status_code=403, detail="You cannot delete this group")

    db.query(UserMute).filter(UserMute.group_id == gid).delete(synchronize_session=False)
    db.query(UserGroupState).filter(UserGroupState.group_id == gid).delete(synchronize_session=False)
    db.query(GroupRestriction).filter(GroupRestriction.group_id == gid).delete(synchronize_session=False)
    db.query(Alert).filter(Alert.group_id == gid).delete(synchronize_session=False)
    db.query(UserReport).filter(UserReport.group_id == gid).delete(synchronize_session=False)
    db.query(Message).filter(Message.group_id == gid).delete(synchronize_session=False)
    db.query(GroupMember).filter(GroupMember.group_id == gid).delete(synchronize_session=False)
    db.delete(group)
    db.commit()
    return None


@router.get("/{gid}/mutes", response_model=list[UserMuteOut])
def list_group_mutes(
    gid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_member(db, gid, current_user.id)
    return (
        db.query(UserMute)
        .filter(UserMute.group_id == gid, UserMute.muter_id == current_user.id)
        .order_by(UserMute.created_at.desc())
        .all()
    )


@router.post("/{gid}/mutes", response_model=UserMuteOut, status_code=status.HTTP_201_CREATED)
def mute_group_member(
    gid: int,
    payload: UserMuteCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_member(db, gid, current_user.id)
    if payload.muted_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot mute yourself")

    target_membership = (
        db.query(GroupMember)
        .filter(GroupMember.group_id == gid, GroupMember.user_id == payload.muted_user_id)
        .first()
    )
    if not target_membership:
        raise HTTPException(status_code=404, detail="User is not a member of this group")

    existing = (
        db.query(UserMute)
        .filter(
            UserMute.group_id == gid,
            UserMute.muter_id == current_user.id,
            UserMute.muted_user_id == payload.muted_user_id,
        )
        .first()
    )
    if existing:
        return existing

    mute = UserMute(
        group_id=gid,
        muter_id=current_user.id,
        muted_user_id=payload.muted_user_id,
    )
    db.add(mute)
    db.commit()
    db.refresh(mute)
    return mute


@router.delete("/{gid}/mutes/{muted_user_id}", status_code=status.HTTP_204_NO_CONTENT)
def unmute_group_member(
    gid: int,
    muted_user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_member(db, gid, current_user.id)

    mute = (
        db.query(UserMute)
        .filter(
            UserMute.group_id == gid,
            UserMute.muter_id == current_user.id,
            UserMute.muted_user_id == muted_user_id,
        )
        .first()
    )
    if not mute:
        raise HTTPException(status_code=404, detail="Mute not found")

    db.delete(mute)
    db.commit()
    return None


@router.get("/{gid}/restrictions/{user_id}")
def get_group_restriction_status(
    gid: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_member(db, gid, current_user.id)
    now = datetime.now(timezone.utc)
    restriction = (
        db.query(GroupRestriction)
        .filter(
            GroupRestriction.group_id == gid,
            GroupRestriction.user_id == user_id,
            GroupRestriction.resolved_at.is_(None),
            or_(GroupRestriction.restricted_until.is_(None), GroupRestriction.restricted_until > now),
        )
        .first()
    )
    return {"restricted": restriction is not None}
