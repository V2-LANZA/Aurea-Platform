from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..deps import get_current_admin, get_db
from ..models import Alert, Group, GroupMember, Message, User
from ..schemas import (
    AdminAlertOut,
    AdminDashboardResponse,
    AdminGroupMemberOut,
    AdminGroupOut,
    AdminUserActionRequest,
    AlertActionRequest,
    AlertOut,
    UserOut,
)

router = APIRouter()


def _to_alert_out(alert: Alert) -> AlertOut:
    return AlertOut(
        id=alert.id,
        group_id=alert.group_id,
        message_id=alert.message_id,
        sender_username=alert.sender_username,
        trigger_text=alert.trigger_text,
        matched_reasons=alert.matched_reasons,
        severity=alert.severity,
        level=alert.level,
        detail=alert.detail,
        status=alert.status,
        is_reviewed=alert.is_reviewed,
        admin_note=alert.admin_note,
        reviewed_by_id=alert.reviewed_by_id,
        reviewed_by_username=alert.reviewed_by_username,
        reviewed_at=alert.reviewed_at,
        created_at=alert.created_at,
    )


def _display_name(user: User | None) -> str:
    if not user:
        return "Unknown user"
    return user.full_name or user.username


@router.get("/dashboard", response_model=AdminDashboardResponse)
def get_admin_dashboard(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    recent_alerts = db.query(Alert).order_by(Alert.created_at.desc()).limit(10).all()

    return AdminDashboardResponse(
        total_users=db.query(User).count(),
        total_groups=db.query(Group).count(),
        total_messages=db.query(Message).count(),
        total_alerts=db.query(Alert).count(),
        pending_alerts=db.query(Alert).filter(Alert.status == "pending").count(),
        high_severity_alerts=db.query(Alert).filter(Alert.severity == "high").count(),
        escalated_alerts=db.query(Alert).filter(Alert.status == "escalated").count(),
        suspended_users=db.query(User).filter(User.is_suspended.is_(True)).count(),
        recent_alerts=[_to_alert_out(a) for a in recent_alerts],
    )


@router.get("/alerts", response_model=list[AdminAlertOut])
def get_admin_alerts(
    group_id: Optional[int] = Query(default=None),
    severity: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    query = db.query(Alert)

    if group_id is not None:
        query = query.filter(Alert.group_id == group_id)

    if severity:
        query = query.filter(Alert.severity == severity)

    if status:
        query = query.filter(Alert.status == status)

    alerts = query.order_by(Alert.created_at.desc()).all()

    group_ids = {alert.group_id for alert in alerts}
    message_ids = {alert.message_id for alert in alerts if alert.message_id is not None}

    groups = {}
    if group_ids:
        groups = {
            group.id: group
            for group in db.query(Group).filter(Group.id.in_(group_ids)).all()
        }

    messages = {}
    if message_ids:
        messages = {
            message.id: message
            for message in db.query(Message).filter(Message.id.in_(message_ids)).all()
        }

    sender_ids = {message.user_id for message in messages.values()}
    senders = {}
    if sender_ids:
        senders = {
            user.id: user
            for user in db.query(User).filter(User.id.in_(sender_ids)).all()
        }

    items: list[AdminAlertOut] = []
    for alert in alerts:
        group = groups.get(alert.group_id)
        message = messages.get(alert.message_id) if alert.message_id is not None else None
        sender = senders.get(message.user_id) if message else None

        items.append(
            AdminAlertOut(
                id=alert.id,
                group_id=alert.group_id,
                message_id=alert.message_id,
                sender_username=alert.sender_username or (sender.username if sender else "unknown"),
                trigger_text=alert.trigger_text or (message.content if message else ""),
                matched_reasons=alert.matched_reasons,
                severity=alert.severity,
                level=alert.level,
                detail=alert.detail,
                status=alert.status,
                is_reviewed=alert.is_reviewed,
                admin_note=alert.admin_note,
                reviewed_by_id=alert.reviewed_by_id,
                reviewed_by_username=alert.reviewed_by_username,
                reviewed_at=alert.reviewed_at,
                created_at=alert.created_at,
                group_name=group.name if group else None,
                sender_user_id=sender.id if sender else None,
                sender_display_name=_display_name(sender) if sender else alert.sender_username,
                sender_email=sender.email if sender else None,
                sender_is_suspended=sender.is_suspended if sender else None,
                message_content=message.content if message else alert.trigger_text,
                message_created_at=message.created_at if message else None,
            )
        )

    return items


@router.get("/groups", response_model=list[AdminGroupOut])
def get_admin_groups(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    groups = db.query(Group).order_by(Group.created_at.desc()).all()
    if not groups:
        return []

    creator_ids = {group.created_by_id for group in groups}
    creators = {
        user.id: user
        for user in db.query(User).filter(User.id.in_(creator_ids)).all()
    }

    memberships = (
        db.query(GroupMember, User)
        .join(User, User.id == GroupMember.user_id)
        .filter(GroupMember.group_id.in_([group.id for group in groups]))
        .order_by(GroupMember.joined_at.asc())
        .all()
    )

    members_by_group: dict[int, list[AdminGroupMemberOut]] = {}
    for membership, user in memberships:
        members_by_group.setdefault(membership.group_id, []).append(
            AdminGroupMemberOut(
                id=user.id,
                username=user.username,
                email=user.email,
                full_name=user.full_name,
                pronouns=user.pronouns,
                bio=user.bio,
                avatar_url=user.avatar_url,
                is_suspended=user.is_suspended,
                joined_at=membership.joined_at,
            )
        )

    return [
        AdminGroupOut(
            id=group.id,
            name=group.name,
            invite_code=group.invite_code,
            created_at=group.created_at,
            created_by_id=group.created_by_id,
            created_by_username=_display_name(creators.get(group.created_by_id)),
            member_count=len(members_by_group.get(group.id, [])),
            members=members_by_group.get(group.id, []),
        )
        for group in groups
    ]


@router.patch("/alerts/{alert_id}/review", response_model=AlertOut)
def review_alert(
    alert_id: int,
    payload: AlertActionRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = "reviewed"
    alert.is_reviewed = True
    alert.admin_note = payload.admin_note
    alert.reviewed_by_id = current_admin.id
    alert.reviewed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(alert)
    return _to_alert_out(alert)


@router.patch("/alerts/{alert_id}/dismiss", response_model=AlertOut)
def dismiss_alert(
    alert_id: int,
    payload: AlertActionRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = "dismissed"
    alert.is_reviewed = True
    alert.admin_note = payload.admin_note
    alert.reviewed_by_id = current_admin.id
    alert.reviewed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(alert)
    return _to_alert_out(alert)


@router.patch("/alerts/{alert_id}/escalate", response_model=AlertOut)
def escalate_alert(
    alert_id: int,
    payload: AlertActionRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = "escalated"
    alert.is_reviewed = True
    alert.admin_note = payload.admin_note
    alert.reviewed_by_id = current_admin.id
    alert.reviewed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(alert)
    return _to_alert_out(alert)


@router.get("/users", response_model=list[UserOut])
def get_admin_users(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.patch("/users/{user_id}/suspend", response_model=UserOut)
def suspend_user(
    user_id: int,
    payload: AdminUserActionRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.role == "admin":
        raise HTTPException(status_code=400, detail="Cannot suspend another admin")

    user.is_suspended = True
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}/unsuspend", response_model=UserOut)
def unsuspend_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_suspended = False
    db.commit()
    db.refresh(user)
    return user
