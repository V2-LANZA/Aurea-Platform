from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db
from ..models import GroupMember, Message, User, UserReport
from ..schemas import UserReportCreateRequest, UserReportOut

router = APIRouter()


def _display_name(user: User | None) -> str:
    if not user:
        return "Unknown user"
    return user.full_name or user.username


def _to_report_out(report: UserReport) -> UserReportOut:
    return UserReportOut(
        id=report.id,
        reporter_id=report.reporter_id,
        reporter_username=report.reporter.username if report.reporter else "unknown",
        reported_user_id=report.reported_user_id,
        reported_username=report.reported_user.username if report.reported_user else "unknown",
        reported_user_display_name=_display_name(report.reported_user),
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


@router.post("", response_model=UserReportOut, status_code=status.HTTP_201_CREATED)
def create_user_report(
    payload: UserReportCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.reported_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot report yourself")

    membership = (
        db.query(GroupMember)
        .filter(
            GroupMember.group_id == payload.group_id,
            GroupMember.user_id == current_user.id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    reported_membership = (
        db.query(GroupMember)
        .filter(
            GroupMember.group_id == payload.group_id,
            GroupMember.user_id == payload.reported_user_id,
        )
        .first()
    )
    if not reported_membership:
        raise HTTPException(status_code=404, detail="Reported user is not in this group")

    message = None
    if payload.message_id is not None:
        message = db.query(Message).filter(Message.id == payload.message_id).first()
        if not message or message.group_id != payload.group_id:
            raise HTTPException(status_code=404, detail="Message not found in this group")
        if message.user_id != payload.reported_user_id:
            raise HTTPException(status_code=400, detail="Message does not belong to reported user")

    reason = payload.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Reason is required")

    report = UserReport(
        reporter_id=current_user.id,
        reported_user_id=payload.reported_user_id,
        group_id=payload.group_id,
        message_id=payload.message_id,
        reason=reason,
        details=payload.details.strip() if payload.details else None,
        status="pending",
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return _to_report_out(report)
