from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db
from ..models import Alert, GroupMember, Message, User
from ..schemas import UserAlertCreateRequest, UserAlertOut
from ..services.bot import categories_from_alert_text

router = APIRouter()


def _to_user_alert_out(alert: Alert) -> UserAlertOut:
    categories = categories_from_alert_text(alert.matched_reasons, alert.detail)
    return UserAlertOut(
        id=alert.id,
        group_id=alert.group_id,
        message_id=alert.message_id,
        sender_username=alert.sender_username,
        trigger_text=alert.trigger_text,
        matched_reasons=alert.matched_reasons,
        category=categories[0],
        categories=categories,
        severity=alert.severity,
        detail=alert.detail,
        created_at=alert.created_at,
    )


@router.get("", response_model=list[UserAlertOut])
def list_alerts(
    group_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(Alert)
        .join(GroupMember, GroupMember.group_id == Alert.group_id)
        .filter(GroupMember.user_id == current_user.id)
    )

    if group_id is not None:
        query = query.filter(Alert.group_id == group_id)

    alerts = query.order_by(Alert.created_at.desc()).all()
    return [_to_user_alert_out(alert) for alert in alerts]


@router.post("", response_model=UserAlertOut, status_code=status.HTTP_201_CREATED)
def create_user_report(
    payload: UserAlertCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    message = None
    group_id = payload.group_id

    if payload.message_id is not None:
        message = db.query(Message).filter(Message.id == payload.message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Message not found")
        group_id = message.group_id

    if group_id is None:
        raise HTTPException(status_code=400, detail="A group_id or message_id is required")

    membership = (
        db.query(GroupMember)
        .filter(GroupMember.group_id == group_id, GroupMember.user_id == current_user.id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    sender_username = payload.against_user or "unknown"
    trigger_text = payload.message_text.strip()
    if message is not None:
        sender_username = message.user.username if message.user else sender_username
        trigger_text = message.content

    if not trigger_text:
        raise HTTPException(status_code=400, detail="Message text is required")

    reason = (payload.reason or "User reported a risky message").strip()
    alert = Alert(
        group_id=group_id,
        message_id=message.id if message else None,
        sender_username=sender_username,
        trigger_text=trigger_text,
        matched_reasons="other/general risk, user report",
        severity="medium",
        level="user-report",
        detail=f"Reported by @{current_user.username}: {reason}",
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return _to_user_alert_out(alert)
