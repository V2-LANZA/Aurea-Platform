from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Sequence

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth import hash_password
from ..models import Alert, GroupRestriction, Message, User
from .bot import (
    BOT_AVATAR_FALLBACK,
    BOT_DISPLAY_NAME,
    BOT_USERNAME,
    build_alert_detail,
    build_bot_reply,
    build_cumulative_alert_detail,
    humanize_reasons,
    primary_category_for_reasons,
)
from .detect import analyze

RISK_THRESHOLD = 0.3
BOT_EMAIL = "aurea-bot@local"
BOT_COOLDOWN_SECONDS = 25
RISK_WINDOW_SECONDS = 3600
CUMULATIVE_THRESHOLD = 3
CUMULATIVE_WARNING_THRESHOLD = 1
CUMULATIVE_ESCALATION_COOLDOWN_SECONDS = 120
SYSTEM_RESTRICTION_MINUTES = 30

RISK_POINTS = {
    "ask_age": 1,
    "location": 1,
    "secrecy": 2,
    "ask_pics": 2,
    "meet_alone": 2,
    "sexual_terms": 3,
    "self_harm_encouragement": 3,
    "self_harm_distress": 2,
    "violent_threat": 3,
    "harassment": 2,
    "hate_speech": 3,
}

_last_bot_message_at: dict[int, datetime] = {}


@dataclass
class GroupRiskState:
    score: int = 0
    last_updated_at: datetime | None = None
    last_escalated_at: datetime | None = None


_group_risk_states: dict[int, GroupRiskState] = {}
_sender_risk_states: dict[tuple[int, int], GroupRiskState] = {}


@dataclass
class MessageProcessingResult:
    user_message: Message
    alert: Alert | None
    bot_message: Message | None
    score: float
    reasons: list[str]
    categories: list[str]
    severity: str | None
    cumulative_score: int
    cumulative_triggered: bool
    sender_notice: str | None = None


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def reset_runtime_state() -> None:
    _last_bot_message_at.clear()
    _group_risk_states.clear()
    _sender_risk_states.clear()


def serialize_message(message: Message, message_type: str | None = None) -> dict:
    msg_type = message_type or infer_message_type(message.user)
    is_bot = msg_type in {"bot", "system"}
    username = BOT_USERNAME if is_bot else (message.user.username if message.user else "unknown")
    full_name = BOT_DISPLAY_NAME if is_bot else (message.user.full_name if message.user else None)
    return {
        "type": msg_type,
        "id": message.id,
        "group_id": message.group_id,
        "user_id": message.user_id,
        "username": username,
        "full_name": full_name,
        "pronouns": message.user.pronouns if message.user and not is_bot else None,
        "avatar_url": message.user.avatar_url if message.user and not is_bot else BOT_AVATAR_FALLBACK,
        "sender_is_suspended": message.user.is_suspended if message.user else False,
        "sender_is_available": not message.user.is_suspended if message.user else True,
        "content": message.content,
        "created_at": message.created_at.isoformat() if message.created_at else None,
        "message_type": msg_type,
        "is_bot": is_bot,
    }


def infer_message_type(user: User | None) -> str:
    if user and user.username == BOT_USERNAME:
        return "bot"
    return "message"


def get_or_create_bot_user(db: Session) -> User:
    bot = db.query(User).filter(User.username == BOT_USERNAME).first()
    if bot:
        return bot

    bot = User(
        username=BOT_USERNAME,
        email=BOT_EMAIL,
        full_name=BOT_DISPLAY_NAME,
        password_hash=hash_password("bot-not-for-login"),
    )
    db.add(bot)
    db.commit()
    db.refresh(bot)
    return bot


def determine_severity(
    score: float,
    reasons: Sequence[str],
    *,
    cumulative_triggered: bool = False,
) -> str:
    reason_set = set(reasons)

    if cumulative_triggered:
        return "high"

    if reason_set.intersection({"self_harm_encouragement", "self_harm_distress", "violent_threat", "hate_speech"}):
        return "high"

    if "ask_pics" in reason_set and "sexual_terms" in reason_set:
        return "high"

    if score >= 0.8:
        return "high"

    if score >= RISK_THRESHOLD:
        return "medium"

    return "low"


def create_alert(
    db: Session,
    *,
    group_id: int,
    message: Message,
    sender_username: str,
    severity: str,
    reasons: Sequence[str],
    categories: Sequence[str],
    detail: str | None = None,
    level: str = "flagged",
) -> Alert:
    matched_labels = humanize_reasons(reasons)
    matched_text_parts = list(dict.fromkeys([*matched_labels, *categories]))

    alert = Alert(
        message_id=message.id,
        group_id=group_id,
        sender_username=sender_username,
        trigger_text=message.content,
        matched_reasons=", ".join(matched_text_parts) or None,
        severity=severity,
        level=level,
        detail=detail or build_alert_detail(reasons, categories=categories),
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def _points_for_reasons(reasons: Sequence[str]) -> int:
    total = 0
    for reason in set(reasons):
        total += RISK_POINTS.get(reason, 1)
    return total


def _update_cumulative_risk(group_id: int, reasons: Sequence[str], now: datetime) -> tuple[int, bool]:
    state = _group_risk_states.setdefault(group_id, GroupRiskState())

    if state.last_updated_at and now - state.last_updated_at > timedelta(seconds=RISK_WINDOW_SECONDS):
        state.score = 0

    state.score += _points_for_reasons(reasons)
    state.last_updated_at = now

    if state.score < CUMULATIVE_THRESHOLD:
        return state.score, False

    if (
        state.last_escalated_at
        and now - state.last_escalated_at < timedelta(seconds=CUMULATIVE_ESCALATION_COOLDOWN_SECONDS)
    ):
        return state.score, False

    state.last_escalated_at = now
    state.score = max(0, state.score - CUMULATIVE_THRESHOLD)
    return CUMULATIVE_THRESHOLD, True


def _update_sender_risk(
    group_id: int,
    sender_id: int,
    reasons: Sequence[str],
    now: datetime,
) -> tuple[int, bool, bool]:
    state = _sender_risk_states.setdefault((group_id, sender_id), GroupRiskState())

    if state.last_updated_at and now - state.last_updated_at > timedelta(seconds=RISK_WINDOW_SECONDS):
        state.score = 0

    # Prototype strike tracking is group-specific and windowed.
    # Most risky messages count as one strike, direct threats count as two,
    # and self-harm distress does not add punishment strikes.
    state.score += _strike_weight_for_reasons(reasons)
    state.last_updated_at = now

    warning_triggered = state.score >= 1
    escalation_triggered = state.score >= CUMULATIVE_THRESHOLD and (
        not state.last_escalated_at
        or now - state.last_escalated_at >= timedelta(seconds=CUMULATIVE_ESCALATION_COOLDOWN_SECONDS)
    )

    if escalation_triggered:
        state.last_escalated_at = now
        state.score = max(0, state.score - CUMULATIVE_THRESHOLD)
        return CUMULATIVE_THRESHOLD, True, warning_triggered

    return state.score, False, warning_triggered


def _should_temp_restrict(reason_set: set[str], severity: str | None, *, cumulative_triggered: bool) -> bool:
    if "self_harm_distress" in reason_set:
        return False
    return cumulative_triggered


def _strike_weight_for_reasons(reasons: Sequence[str]) -> int:
    reason_set = set(reasons)
    if "self_harm_distress" in reason_set:
        return 0
    if "violent_threat" in reason_set:
        return 2
    return 1 if reason_set else 0


def get_active_group_restriction(
    db: Session,
    *,
    group_id: int,
    user_id: int,
) -> GroupRestriction | None:
    return (
        db.query(GroupRestriction)
        .filter(
            GroupRestriction.group_id == group_id,
            GroupRestriction.user_id == user_id,
            GroupRestriction.resolved_at.is_(None),
            or_(
                GroupRestriction.restricted_until.is_(None),
                GroupRestriction.restricted_until > utc_now(),
            ),
        )
        .first()
    )


def _upsert_system_restriction(
    db: Session,
    *,
    group_id: int,
    sender: User,
    reason: str,
) -> GroupRestriction:
    bot_user = get_or_create_bot_user(db)
    restriction = (
        db.query(GroupRestriction)
        .filter(
            GroupRestriction.group_id == group_id,
            GroupRestriction.user_id == sender.id,
        )
        .order_by(GroupRestriction.created_at.desc())
        .first()
    )
    restricted_until = utc_now() + timedelta(minutes=SYSTEM_RESTRICTION_MINUTES)
    if not restriction:
        restriction = GroupRestriction(
            group_id=group_id,
            user_id=sender.id,
            reason=reason,
            created_by_id=bot_user.id,
            restricted_until=restricted_until,
            restricted_by_system=True,
        )
        db.add(restriction)
    else:
        restriction.reason = reason
        restriction.restricted_until = restricted_until
        restriction.restricted_by_system = True
        restriction.created_by_id = bot_user.id
        restriction.resolved_at = None

    db.commit()
    db.refresh(restriction)
    return restriction


def _should_send_bot_message(group_id: int, severity: str, now: datetime) -> bool:
    if severity == "high":
        _last_bot_message_at[group_id] = now
        return True

    last_sent_at = _last_bot_message_at.get(group_id)
    if last_sent_at and now - last_sent_at < timedelta(seconds=BOT_COOLDOWN_SECONDS):
        return False

    _last_bot_message_at[group_id] = now
    return True


def process_message(
    db: Session,
    *,
    group_id: int,
    sender: User,
    content: str,
) -> MessageProcessingResult:
    message = Message(
        group_id=group_id,
        user_id=sender.id,
        content=content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    score, reasons = analyze(content)
    categories = primary_category_for_reasons(reasons)
    now = utc_now()

    cumulative_score = 0
    cumulative_triggered = False
    sender_notice: str | None = None
    if reasons:
        sender_cumulative_score, sender_cumulative_triggered, sender_warning_triggered = _update_sender_risk(
            group_id,
            sender.id,
            reasons,
            now,
        )
        cumulative_score = sender_cumulative_score
        cumulative_triggered = sender_cumulative_triggered
    else:
        sender_cumulative_score = 0
        sender_cumulative_triggered = False
        sender_warning_triggered = False

    alert: Alert | None = None
    bot_message: Message | None = None

    if score >= RISK_THRESHOLD:
        severity = determine_severity(score, reasons)
        alert = create_alert(
            db,
            group_id=group_id,
            message=message,
            sender_username=sender.username,
            severity=severity,
            reasons=reasons,
            categories=categories,
        )
    else:
        severity = None

    if cumulative_triggered:
        severity = "high"
        if alert:
            alert.severity = "high"
            alert.level = "cumulative-risk"
            alert.matched_reasons = "repeated pattern risk"
            alert.detail = build_cumulative_alert_detail(reasons)
            db.add(alert)
            db.commit()
            db.refresh(alert)
        else:
            alert = create_alert(
                db,
                group_id=group_id,
                message=message,
                sender_username=sender.username,
                severity="high",
                reasons=["repeated_pattern", *reasons],
                categories=["repeated pattern risk"],
                detail=build_cumulative_alert_detail(reasons),
                level="cumulative-risk",
            )
        categories = ["repeated pattern risk"]

    reason_set = set(reasons)
    temporary_hold_triggered = _should_temp_restrict(
        reason_set,
        severity,
        cumulative_triggered=cumulative_triggered,
    )

    if alert and (
        temporary_hold_triggered
        or reason_set.intersection({"violent_threat", "hate_speech", "self_harm_encouragement"})
        or "self_harm_distress" in reason_set
    ):
        alert.status = "high_risk"
        db.add(alert)
        db.commit()
        db.refresh(alert)

    if "self_harm_distress" in reason_set:
        sender_notice = (
            "Aurea Bot: You are not in trouble. "
            "If you might hurt yourself or are in immediate danger, contact emergency services now or speak to a trusted adult immediately. "
            "If you are in the UK, call 999 for immediate danger. Please reach out to someone nearby now."
        )
    elif temporary_hold_triggered:
        restriction_reason = (
            "Temporary safety hold applied after repeated risky messages."
            if sender_cumulative_triggered or cumulative_triggered
            else "Temporary safety hold applied after severe safety-risk messages."
        )
        _upsert_system_restriction(
            db,
            group_id=group_id,
            sender=sender,
            reason=restriction_reason,
        )
        if reason_set.intersection({"violent_threat", "harassment", "hate_speech", "self_harm_encouragement"}):
            sender_notice = (
                "Aurea Bot: Your sending access in this group has been paused while moderators review recent messages. "
                "You can still view the chat, but you cannot send new messages here until the review is resolved or the pause expires."
            )
        else:
            sender_notice = (
                "Aurea Bot: Your sending access in this group has been paused while moderators review recent messages. "
                "You can still view the chat, but you cannot send new messages here until the review is resolved or the pause expires."
            )
    elif sender_warning_triggered:
        if sender_cumulative_score >= 2:
            sender_notice = (
                "Aurea Bot: Repeated unsafe messages have been detected. "
                "If this continues, your sending access in this group may be paused for review."
            )
        else:
            sender_notice = (
                "Aurea Bot: Your recent message may break Aurea's safety rules. "
                "Please keep the conversation respectful."
            )

    bot_text = build_bot_reply(
        content=content,
        score=score,
        reasons=reasons,
        severity=severity,
        cumulative_triggered=False,
        categories=categories,
    )

    should_broadcast_bot_guidance = bool(
        bot_text
        and severity
        and "self_harm_distress" not in reason_set
        and _should_send_bot_message(group_id, severity, now)
    )

    if should_broadcast_bot_guidance:
        bot_user = get_or_create_bot_user(db)
        bot_message = Message(
            group_id=group_id,
            user_id=bot_user.id,
            content=bot_text,
        )
        db.add(bot_message)
        db.commit()
        db.refresh(bot_message)

    return MessageProcessingResult(
        user_message=message,
        alert=alert,
        bot_message=bot_message,
        score=score,
        reasons=reasons,
        categories=categories,
        severity=severity,
        cumulative_score=cumulative_score,
        cumulative_triggered=cumulative_triggered,
        sender_notice=sender_notice,
    )
