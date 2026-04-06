from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from ..deps import get_db, get_current_user
from ..models import Alert, Group, GroupMember, Message, User
from ..schemas import MessageIn, MessageOut, MessageUpdate
from ..services.bot import build_alert_detail, humanize_reasons
from ..services.detect import analyze

RISK_THRESHOLD = 0.3
BOT_USERNAME = "__aurea_bot__"

router = APIRouter(prefix="/groups", tags=["messages"])


def _ensure_member(db: Session, gid: int, user_id: int) -> None:
    member = db.query(GroupMember).filter_by(group_id=gid, user_id=user_id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this group")


def _is_group_creator(db: Session, gid: int, user_id: int) -> bool:
    group = db.query(Group).filter(Group.id == gid).first()
    return bool(group and group.created_by_id == user_id)


def _display_name(user: User | None) -> str:
    if not user:
        return "unknown"
    return user.full_name or user.username


def _to_message_out(m: Message) -> MessageOut:
    return MessageOut(
        id=m.id,
        group_id=m.group_id,
        user_id=m.user_id,
        username=m.user.username if m.user else "unknown",
        full_name=m.user.full_name if m.user else None,
        pronouns=m.user.pronouns if m.user else None,
        avatar_url=m.user.avatar_url if m.user else None,
        sender_is_suspended=m.user.is_suspended if m.user else False,
        sender_is_available=not m.user.is_suspended if m.user else True,
        content=m.content,
        created_at=m.created_at,
    )


@router.get("/{gid}/messages", response_model=list[MessageOut])
def get_messages(
    gid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_member(db, gid, current_user.id)

    rows = (
        db.query(Message)
        .filter(Message.group_id == gid)
        .order_by(Message.created_at.asc())
        .limit(100)
        .all()
    )

    return [_to_message_out(m) for m in rows]


@router.post("/{gid}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def send_message(
    gid: int,
    payload: MessageIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_member(db, gid, current_user.id)

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    m = Message(
        group_id=gid,
        user_id=current_user.id,
        content=content,
    )
    db.add(m)
    db.commit()
    db.refresh(m)

    score, reasons = analyze(content)
    if score >= RISK_THRESHOLD:
        severity = "high" if score >= 1 else "medium"
        db.add(
            Alert(
                message_id=m.id,
                group_id=gid,
                sender_username=current_user.username,
                trigger_text=content,
                matched_reasons=", ".join(humanize_reasons(reasons)) or None,
                severity=severity,
                level="flagged",
                detail=build_alert_detail(reasons),
            )
        )
        db.commit()

    return _to_message_out(m)


@router.patch("/{gid}/messages/{mid}", response_model=MessageOut)
def edit_message(
    gid: int,
    mid: int,
    payload: MessageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_member(db, gid, current_user.id)

    m = db.query(Message).filter(Message.id == mid).first()
    if not m or m.group_id != gid:
        raise HTTPException(status_code=404, detail="Message not found")

    if current_user.id != m.user_id and not _is_group_creator(db, gid, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the author or group creator can edit this message",
        )

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    m.content = content
    db.commit()
    db.refresh(m)

    db.query(Alert).filter(Alert.message_id == m.id).delete(synchronize_session=False)

    score, reasons = analyze(m.content)
    if score >= RISK_THRESHOLD:
        severity = "high" if score >= 1 else "medium"
        db.add(
            Alert(
                message_id=m.id,
                group_id=gid,
                sender_username=current_user.username,
                trigger_text=m.content,
                matched_reasons=", ".join(humanize_reasons(reasons)) or None,
                severity=severity,
                level="flagged",
                detail=build_alert_detail(reasons),
            )
        )
        db.commit()

    return _to_message_out(m)


@router.delete("/{gid}/messages/{mid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message(
    gid: int,
    mid: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure_member(db, gid, current_user.id)

    m = db.query(Message).filter(Message.id == mid).first()
    if not m or m.group_id != gid:
        raise HTTPException(status_code=404, detail="Message not found")

    if current_user.id != m.user_id and not _is_group_creator(db, gid, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the author or group creator can delete this message",
        )

    db.query(Alert).filter(Alert.message_id == m.id).delete(synchronize_session=False)
    db.delete(m)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
