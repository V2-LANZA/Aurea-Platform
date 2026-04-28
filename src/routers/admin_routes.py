from datetime import datetime, timedelta, timezone
import csv
import io
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Query as SAQuery, Session

from ..deps import get_current_admin, get_db
from ..models import Alert, Group, GroupMember, GroupRestriction, Message, User, UserReport
from ..schemas import (
    AdminAlertOut,
    AdminDashboardResponse,
    AdminModerationCountsOut,
    AdminGroupMemberOut,
    AdminGroupOut,
    AdminUserActionRequest,
    AlertActionRequest,
    AlertOut,
    CategoryCountOut,
    GroupRestrictionActionRequest,
    GroupRestrictionOut,
    GroupSuspensionActionRequest,
    ReportsAnalyticsPointOut,
    ReportsAnalyticsResponse,
    ReportsAnalyticsSummaryOut,
    UserOut,
    UserReportActionRequest,
    UserReportOut,
)
from ..services.bot import categories_from_alert_text

router = APIRouter()


def _active_restriction_filter():
    now = datetime.now(timezone.utc)
    return (
        GroupRestriction.resolved_at.is_(None),
        or_(GroupRestriction.restricted_until.is_(None), GroupRestriction.restricted_until > now),
    )


def _display_name(user: User | None) -> str:
    if not user:
        return "Unknown user"
    return user.full_name or user.username


def _normalize_alert_status(status: str | None) -> str | None:
    if not status:
        return None
    if status == "pending":
        return "pending_review"
    if status == "escalated":
        return "high_risk"
    return status


def _apply_date_range(query: SAQuery, column, range_value: str | None) -> SAQuery:
    if not range_value or range_value == "all":
        return query

    now = datetime.now(timezone.utc)
    start: datetime | None = None
    if range_value == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif range_value == "7d":
        start = now - timedelta(days=7)
    elif range_value == "30d":
        start = now - timedelta(days=30)

    if start is None:
        return query
    return query.filter(column >= start)


def _apply_sort(query: SAQuery, column, sort: str | None) -> SAQuery:
    if sort == "oldest":
        return query.order_by(column.asc())
    return query.order_by(column.desc())


def _to_alert_out(alert: Alert) -> AlertOut:
    categories = categories_from_alert_text(alert.matched_reasons, alert.detail)
    return AlertOut(
        id=alert.id,
        group_id=alert.group_id,
        message_id=alert.message_id,
        sender_username=alert.sender_username,
        trigger_text=alert.trigger_text,
        matched_reasons=alert.matched_reasons,
        category=categories[0],
        categories=categories,
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


def _to_report_out(
    report: UserReport,
    restricted_pairs: set[tuple[int, int]] | None = None,
) -> UserReportOut:
    restricted_pairs = restricted_pairs or set()
    return UserReportOut(
        id=report.id,
        reporter_id=report.reporter_id,
        reporter_username=report.reporter.username if report.reporter else "unknown",
        reported_user_id=report.reported_user_id,
        reported_username=report.reported_user.username if report.reported_user else "unknown",
        reported_user_display_name=_display_name(report.reported_user),
        reported_user_is_suspended=report.reported_user.is_suspended if report.reported_user else False,
        reported_user_is_restricted_in_group=(report.group_id, report.reported_user_id) in restricted_pairs,
        group_id=report.group_id,
        group_name=report.group.name if report.group else None,
        message_id=report.message_id,
        message_preview=report.message.content if report.message else None,
        reason=report.reason,
        details=report.details,
        status=report.status,
        created_at=report.created_at,
        reviewed_at=report.reviewed_at,
        reviewed_by_id=report.reviewed_by_id,
        reviewed_by_username=_display_name(report.reviewed_by) if report.reviewed_by else None,
        admin_note=report.admin_note,
    )


def _build_dashboard_summary(alerts: list[Alert]) -> dict:
    alerts_by_severity = {"low": 0, "medium": 0, "high": 0}
    alerts_by_category: dict[str, int] = {}
    review_status_counts = {
        "pending_review": 0,
        "high_risk": 0,
        "reviewed": 0,
        "dismissed": 0,
    }
    response_times: list[float] = []

    for alert in alerts:
        alerts_by_severity[alert.severity] = alerts_by_severity.get(alert.severity, 0) + 1
        review_status_counts[alert.status] = review_status_counts.get(alert.status, 0) + 1

        categories = categories_from_alert_text(alert.matched_reasons, alert.detail)
        primary_category = categories[0]
        alerts_by_category[primary_category] = alerts_by_category.get(primary_category, 0) + 1

        if alert.reviewed_at and alert.created_at:
            response_times.append((alert.reviewed_at - alert.created_at).total_seconds())

    most_common_categories = sorted(
        (CategoryCountOut(name=name, count=count) for name, count in alerts_by_category.items()),
        key=lambda item: item.count,
        reverse=True,
    )[:5]

    return {
        "alerts_by_severity": alerts_by_severity,
        "alerts_by_category": alerts_by_category,
        "review_status_counts": review_status_counts,
        "average_response_time_seconds": (
            sum(response_times) / len(response_times) if response_times else None
        ),
        "most_common_categories": most_common_categories,
    }


def _set_alert_status(alert: Alert, status: str, admin: User, note: str | None) -> Alert:
    alert.status = status
    alert.is_reviewed = status in {"reviewed", "dismissed", "high_risk"}
    alert.admin_note = note
    alert.reviewed_by_id = admin.id
    alert.reviewed_at = datetime.now(timezone.utc)
    return alert


def _csv_response(filename: str, headers: list[str], rows: list[list[object]]) -> StreamingResponse:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    writer.writerows(rows)
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _filtered_alerts(db: Session, range_value: str) -> list[Alert]:
    query = _apply_date_range(db.query(Alert), Alert.created_at, range_value)
    return query.all()


def _filtered_reports(db: Session, range_value: str) -> list[UserReport]:
    query = _apply_date_range(db.query(UserReport), UserReport.created_at, range_value)
    return query.all()


def _filtered_groups(db: Session, range_value: str) -> list[Group]:
    query = _apply_date_range(db.query(Group), Group.created_at, range_value)
    return query.all()


def _build_activity_points(alerts: list[Alert], reports: list[UserReport]) -> list[ReportsAnalyticsPointOut]:
    buckets: dict[str, int] = {}
    for item in [*alerts, *reports]:
        created_at = item.created_at.astimezone(timezone.utc) if item.created_at else None
        if not created_at:
            continue
        label = created_at.strftime("%Y-%m-%d")
        buckets[label] = buckets.get(label, 0) + 1
    return [
        ReportsAnalyticsPointOut(label=label, value=value)
        for label, value in sorted(buckets.items())
    ]


def _count_points(values: dict[str, int]) -> list[ReportsAnalyticsPointOut]:
    return [ReportsAnalyticsPointOut(label=label, value=count) for label, count in values.items()]


def _admin_group_out(db: Session, group: Group) -> AdminGroupOut:
    creator = db.query(User).filter(User.id == group.created_by_id).first()
    memberships = (
        db.query(GroupMember, User)
        .join(User, User.id == GroupMember.user_id)
        .filter(GroupMember.group_id == group.id)
        .order_by(GroupMember.joined_at.asc())
        .all()
    )
    restrictions = {
        restriction.user_id
        for restriction in db.query(GroupRestriction)
        .filter(GroupRestriction.group_id == group.id, *_active_restriction_filter())
        .all()
    }
    members = [
        AdminGroupMemberOut(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            pronouns=user.pronouns,
            bio=user.bio,
            avatar_url=user.avatar_url,
            is_suspended=user.is_suspended,
            is_restricted_in_group=user.id in restrictions,
            joined_at=membership.joined_at,
        )
        for membership, user in memberships
    ]
    return AdminGroupOut(
        id=group.id,
        name=group.name,
        invite_code=group.invite_code,
        created_at=group.created_at,
        created_by_id=group.created_by_id,
        created_by_username=_display_name(creator),
        is_suspended=group.is_suspended,
        suspended_at=group.suspended_at,
        suspension_reason=group.suspension_reason,
        member_count=len(members),
        members=members,
    )


@router.get("/dashboard", response_model=AdminDashboardResponse)
def get_admin_dashboard(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    recent_alerts = db.query(Alert).order_by(Alert.created_at.desc()).limit(10).all()
    all_alerts = db.query(Alert).all()
    all_reports = db.query(UserReport).all()
    summary = _build_dashboard_summary(all_alerts)

    return AdminDashboardResponse(
        total_users=db.query(User).count(),
        total_groups=db.query(Group).count(),
        total_messages=db.query(Message).count(),
        total_flagged_messages=db.query(Alert.message_id).filter(Alert.message_id.isnot(None)).distinct().count(),
        total_alerts=db.query(Alert).count(),
        pending_alerts=db.query(Alert).filter(Alert.status == "pending_review").count(),
        reviewed_alerts=db.query(Alert).filter(Alert.status == "reviewed").count(),
        high_severity_alerts=db.query(Alert).filter(Alert.severity == "high").count(),
        high_risk_alerts=db.query(Alert).filter(Alert.status == "high_risk").count(),
        dismissed_alerts=db.query(Alert).filter(Alert.status == "dismissed").count(),
        suspended_users=db.query(User).filter(User.is_suspended.is_(True)).count(),
        pending_reports=sum(1 for report in all_reports if report.status == "pending"),
        reviewed_reports=sum(1 for report in all_reports if report.status == "reviewed"),
        alerts_by_severity=summary["alerts_by_severity"],
        alerts_by_category=summary["alerts_by_category"],
        review_status_counts=summary["review_status_counts"],
        average_response_time_seconds=summary["average_response_time_seconds"],
        most_common_categories=summary["most_common_categories"],
        recent_alerts=[_to_alert_out(a) for a in recent_alerts],
    )


@router.get("/moderation/counts", response_model=AdminModerationCountsOut)
def get_admin_moderation_counts(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    pending_review_count = db.query(Alert).filter(Alert.status == "pending_review").count()
    high_risk_count = db.query(Alert).filter(Alert.status == "high_risk").count()
    reviewed_count = db.query(Alert).filter(Alert.status == "reviewed").count()
    reported_users_count = db.query(UserReport).filter(UserReport.status == "pending").count()
    return AdminModerationCountsOut(
        pending_review_count=pending_review_count,
        high_risk_count=high_risk_count,
        reviewed_count=reviewed_count,
        reported_users_count=reported_users_count,
        new_alerts_count=pending_review_count + high_risk_count,
    )


@router.get("/alerts", response_model=list[AdminAlertOut])
def get_admin_alerts(
    group_id: Optional[int] = Query(default=None),
    severity: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    sort: str = Query(default="newest"),
    range: str = Query(default="all"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    query = db.query(Alert)

    if group_id is not None:
        query = query.filter(Alert.group_id == group_id)
    if severity:
        query = query.filter(Alert.severity == severity)
    normalized_status = _normalize_alert_status(status)
    if normalized_status:
        query = query.filter(Alert.status == normalized_status)

    query = _apply_date_range(query, Alert.created_at, range)
    alerts = _apply_sort(query, Alert.created_at, sort).all()

    group_ids = {alert.group_id for alert in alerts}
    message_ids = {alert.message_id for alert in alerts if alert.message_id is not None}
    groups = {
        group.id: group for group in db.query(Group).filter(Group.id.in_(group_ids)).all()
    } if group_ids else {}
    messages = {
        message.id: message for message in db.query(Message).filter(Message.id.in_(message_ids)).all()
    } if message_ids else {}

    sender_ids = {message.user_id for message in messages.values()}
    senders = {
        user.id: user for user in db.query(User).filter(User.id.in_(sender_ids)).all()
    } if sender_ids else {}
    restricted_pairs = {
        (restriction.group_id, restriction.user_id)
        for restriction in db.query(GroupRestriction)
        .filter(GroupRestriction.group_id.in_(group_ids), *_active_restriction_filter())
        .all()
    } if group_ids else set()

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
                category=categories_from_alert_text(alert.matched_reasons, alert.detail)[0],
                categories=categories_from_alert_text(alert.matched_reasons, alert.detail),
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
                sender_is_restricted_in_group=(alert.group_id, sender.id) in restricted_pairs if sender else False,
                message_content=message.content if message else alert.trigger_text,
                message_created_at=message.created_at if message else None,
            )
        )

    return items


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

    _set_alert_status(alert, "reviewed", current_admin, payload.admin_note)
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

    _set_alert_status(alert, "dismissed", current_admin, payload.admin_note)
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

    _set_alert_status(alert, "high_risk", current_admin, payload.admin_note)
    db.commit()
    db.refresh(alert)
    return _to_alert_out(alert)


@router.patch("/alerts/{alert_id}/resolve", response_model=AlertOut)
def resolve_alert(
    alert_id: int,
    payload: AlertActionRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    _set_alert_status(alert, "reviewed", current_admin, payload.admin_note or "Marked as resolved")
    db.commit()
    db.refresh(alert)
    return _to_alert_out(alert)


@router.patch("/alerts/{alert_id}/note", response_model=AlertOut)
def update_alert_note(
    alert_id: int,
    payload: AlertActionRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.admin_note = payload.admin_note
    alert.reviewed_by_id = current_admin.id
    alert.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)
    return _to_alert_out(alert)


@router.get("/reports", response_model=list[UserReportOut])
def get_admin_reports(
    status: Optional[str] = Query(default=None),
    group_id: Optional[int] = Query(default=None),
    sort: str = Query(default="newest"),
    range: str = Query(default="all"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    query = db.query(UserReport)
    if status:
        query = query.filter(UserReport.status == status)
    if group_id is not None:
        query = query.filter(UserReport.group_id == group_id)

    query = _apply_date_range(query, UserReport.created_at, range)
    reports = _apply_sort(query, UserReport.created_at, sort).all()
    restricted_pairs = {
        (restriction.group_id, restriction.user_id)
        for restriction in db.query(GroupRestriction).filter(*_active_restriction_filter()).all()
    }
    return [_to_report_out(report, restricted_pairs) for report in reports]


@router.patch("/reports/{report_id}/review", response_model=UserReportOut)
def review_report(
    report_id: int,
    payload: UserReportActionRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    report = db.query(UserReport).filter(UserReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    report.status = "reviewed"
    report.reviewed_by_id = current_admin.id
    report.reviewed_at = datetime.now(timezone.utc)
    report.admin_note = payload.admin_note
    db.commit()
    db.refresh(report)
    restricted_pairs = {
        (restriction.group_id, restriction.user_id)
        for restriction in db.query(GroupRestriction).filter(*_active_restriction_filter()).all()
    }
    return _to_report_out(report, restricted_pairs)


@router.patch("/reports/{report_id}/dismiss", response_model=UserReportOut)
def dismiss_report(
    report_id: int,
    payload: UserReportActionRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    report = db.query(UserReport).filter(UserReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    report.status = "dismissed"
    report.reviewed_by_id = current_admin.id
    report.reviewed_at = datetime.now(timezone.utc)
    report.admin_note = payload.admin_note
    db.commit()
    db.refresh(report)
    restricted_pairs = {
        (restriction.group_id, restriction.user_id)
        for restriction in db.query(GroupRestriction).filter(*_active_restriction_filter()).all()
    }
    return _to_report_out(report, restricted_pairs)


@router.get("/groups", response_model=list[AdminGroupOut])
def get_admin_groups(
    sort: str = Query(default="newest"),
    range: str = Query(default="all"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    query = db.query(Group)
    query = _apply_date_range(query, Group.created_at, range)
    groups = _apply_sort(query, Group.created_at, sort).all()
    if not groups:
        return []

    creator_ids = {group.created_by_id for group in groups}
    creators = {
        user.id: user for user in db.query(User).filter(User.id.in_(creator_ids)).all()
    }
    group_ids = [group.id for group in groups]

    memberships = (
        db.query(GroupMember, User)
        .join(User, User.id == GroupMember.user_id)
        .filter(GroupMember.group_id.in_(group_ids))
        .order_by(GroupMember.joined_at.asc())
        .all()
    )
    restrictions = {
        (restriction.group_id, restriction.user_id): restriction
        for restriction in db.query(GroupRestriction)
        .filter(GroupRestriction.group_id.in_(group_ids), *_active_restriction_filter())
        .all()
    }

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
                is_restricted_in_group=(membership.group_id, user.id) in restrictions,
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
            is_suspended=group.is_suspended,
            suspended_at=group.suspended_at,
            suspension_reason=group.suspension_reason,
            member_count=len(members_by_group.get(group.id, [])),
            members=members_by_group.get(group.id, []),
        )
        for group in groups
    ]


@router.get("/users", response_model=list[UserOut])
def get_admin_users(
    sort: str = Query(default="newest"),
    range: str = Query(default="all"),
    status: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    query = db.query(User)
    if status == "suspended":
        query = query.filter(User.is_suspended.is_(True))
    query = _apply_date_range(query, User.created_at, range)
    return _apply_sort(query, User.created_at, sort).all()


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


@router.patch("/groups/{group_id}/members/{user_id}/restrict", response_model=GroupRestrictionOut)
def restrict_group_member(
    group_id: int,
    user_id: int,
    payload: GroupRestrictionActionRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    membership = (
        db.query(GroupMember)
        .filter(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=404, detail="User is not a member of this group")

    restriction = (
        db.query(GroupRestriction)
        .filter(
            GroupRestriction.group_id == group_id,
            GroupRestriction.user_id == user_id,
        )
        .order_by(GroupRestriction.created_at.desc())
        .first()
    )
    if not restriction:
        restriction = GroupRestriction(
            group_id=group_id,
            user_id=user_id,
            reason=payload.reason,
            created_by_id=current_admin.id,
            restricted_by_system=False,
            resolved_at=None,
        )
        db.add(restriction)
    else:
        restriction.reason = payload.reason or restriction.reason
        restriction.created_by_id = current_admin.id
        restriction.restricted_by_system = False
        restriction.restricted_until = None
        restriction.resolved_at = None

    db.commit()
    db.refresh(restriction)
    return restriction


@router.patch("/groups/{group_id}/members/{user_id}/unrestrict", response_model=GroupRestrictionOut)
def unrestrict_group_member(
    group_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    restriction = (
        db.query(GroupRestriction)
        .filter(
            GroupRestriction.group_id == group_id,
            GroupRestriction.user_id == user_id,
        )
        .order_by(GroupRestriction.created_at.desc())
        .first()
    )
    if not restriction:
        raise HTTPException(status_code=404, detail="Restriction not found")

    restriction.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(restriction)
    return restriction


@router.patch("/groups/{group_id}/suspend", response_model=AdminGroupOut)
def suspend_group(
    group_id: int,
    payload: GroupSuspensionActionRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    group.is_suspended = True
    group.suspended_at = datetime.now(timezone.utc)
    group.suspended_by_id = current_admin.id
    group.suspension_reason = payload.reason
    db.add(group)
    db.commit()
    db.refresh(group)
    return _admin_group_out(db, group)


@router.patch("/groups/{group_id}/unsuspend", response_model=AdminGroupOut)
def unsuspend_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    group.is_suspended = False
    group.suspended_at = None
    group.suspended_by_id = None
    group.suspension_reason = None
    db.add(group)
    db.commit()
    db.refresh(group)
    return _admin_group_out(db, group)


@router.get("/reports/analytics", response_model=ReportsAnalyticsResponse)
def get_reports_analytics(
    range: str = Query(default="all"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    alerts = _filtered_alerts(db, range)
    reports = _filtered_reports(db, range)
    groups = _filtered_groups(db, range)
    restrictions = db.query(GroupRestriction).filter(*_active_restriction_filter()).all()
    suspended_users = db.query(User).filter(User.is_suspended.is_(True)).count()

    alerts_by_severity = {"low": 0, "medium": 0, "high": 0}
    alerts_by_status = {
        "pending_review": 0,
        "high_risk": 0,
        "reviewed": 0,
        "dismissed": 0,
    }
    reports_by_reason: dict[str, int] = {}
    top_groups: dict[str, int] = {}
    top_categories: dict[str, int] = {}

    for alert in alerts:
        alerts_by_severity[alert.severity] = alerts_by_severity.get(alert.severity, 0) + 1
        alerts_by_status[alert.status] = alerts_by_status.get(alert.status, 0) + 1
        group_name = alert.group.name if alert.group else f"Group {alert.group_id}"
        top_groups[group_name] = top_groups.get(group_name, 0) + 1
        for category in categories_from_alert_text(alert.matched_reasons, alert.detail):
            top_categories[category] = top_categories.get(category, 0) + 1

    for report in reports:
        reports_by_reason[report.reason] = reports_by_reason.get(report.reason, 0) + 1
        group_name = report.group.name if report.group else f"Group {report.group_id}"
        top_groups[group_name] = top_groups.get(group_name, 0) + 1

    suspended_groups = sum(1 for group in groups if group.is_suspended)
    restricted_groups = len({restriction.group_id for restriction in restrictions})

    return ReportsAnalyticsResponse(
        summary=ReportsAnalyticsSummaryOut(
            total_alerts=len(alerts),
            pending_review_alerts=alerts_by_status["pending_review"],
            high_risk_alerts=alerts_by_status["high_risk"],
            reviewed_alerts=alerts_by_status["reviewed"],
            dismissed_alerts=alerts_by_status["dismissed"],
            total_user_reports=len(reports),
            suspended_users=suspended_users,
            restricted_groups=restricted_groups,
            active_group_restrictions=len(restrictions),
            suspended_groups=suspended_groups,
        ),
        alerts_by_severity=_count_points(alerts_by_severity),
        alerts_by_status=_count_points(alerts_by_status),
        reports_by_reason=[
            ReportsAnalyticsPointOut(label=label, value=value)
            for label, value in sorted(reports_by_reason.items(), key=lambda item: item[1], reverse=True)
        ],
        safety_activity_over_time=_build_activity_points(alerts, reports),
        top_flagged_groups=[
            ReportsAnalyticsPointOut(label=label, value=value)
            for label, value in sorted(top_groups.items(), key=lambda item: item[1], reverse=True)[:5]
        ],
        top_risk_categories=[
            ReportsAnalyticsPointOut(label=label, value=value)
            for label, value in sorted(top_categories.items(), key=lambda item: item[1], reverse=True)[:6]
        ],
    )


@router.get("/reports/alerts.csv")
def download_alerts_csv(
    range: str = Query(default="all"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    alerts = _apply_sort(_apply_date_range(db.query(Alert), Alert.created_at, range), Alert.created_at, "newest").all()
    rows = [
        [
            alert.id,
            alert.created_at.isoformat() if alert.created_at else "",
            alert.group.name if alert.group else "",
            alert.sender_username,
            alert.severity,
            alert.status,
            alert.trigger_text,
            alert.matched_reasons,
            alert.reviewed_by_username or "",
            alert.reviewed_at.isoformat() if alert.reviewed_at else "",
        ]
        for alert in alerts
    ]
    return _csv_response(
        "aurea-alerts.csv",
        [
            "alert_id",
            "created_at",
            "group_name",
            "sender_username",
            "severity",
            "status",
            "trigger_text",
            "matched_reasons",
            "reviewed_by",
            "reviewed_at",
        ],
        rows,
    )


@router.get("/reports/user-reports.csv")
def download_user_reports_csv(
    range: str = Query(default="all"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    reports = _apply_sort(_apply_date_range(db.query(UserReport), UserReport.created_at, range), UserReport.created_at, "newest").all()
    rows = [
        [
            report.id,
            report.created_at.isoformat() if report.created_at else "",
            report.reporter.username if report.reporter else "",
            report.reported_user.username if report.reported_user else "",
            report.group.name if report.group else "",
            report.reason,
            report.details or "",
            report.status,
            _display_name(report.reviewed_by) if report.reviewed_by else "",
            report.reviewed_at.isoformat() if report.reviewed_at else "",
        ]
        for report in reports
    ]
    return _csv_response(
        "aurea-user-reports.csv",
        [
            "report_id",
            "created_at",
            "reporter_username",
            "reported_username",
            "group_name",
            "reason",
            "details",
            "status",
            "reviewed_by",
            "reviewed_at",
        ],
        rows,
    )


@router.get("/reports/summary.csv")
def download_moderation_summary_csv(
    range: str = Query(default="all"),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    analytics = get_reports_analytics(range=range, db=db, current_admin=current_admin)
    rows = [[
        datetime.now(timezone.utc).date().isoformat(),
        analytics.summary.total_alerts,
        analytics.summary.high_risk_alerts,
        analytics.summary.reviewed_alerts,
        analytics.summary.dismissed_alerts,
        analytics.summary.total_user_reports,
        analytics.summary.suspended_users,
        analytics.summary.active_group_restrictions,
        analytics.summary.suspended_groups,
    ]]
    return _csv_response(
        "aurea-moderation-summary.csv",
        [
            "date",
            "total_alerts",
            "high_risk_alerts",
            "reviewed_alerts",
            "dismissed_alerts",
            "user_reports",
            "suspended_users",
            "group_restrictions",
            "suspended_groups",
        ],
        rows,
    )
