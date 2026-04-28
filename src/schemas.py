from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class RegisterRequest(BaseModel):
    username: str
    email: str
    date_of_birth: date
    full_name: Optional[str] = None
    pronouns: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    password: str
    admin_setup_key: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    pronouns: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    date_of_birth: Optional[date] = None
    full_name: Optional[str] = None
    pronouns: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    is_suspended: bool
    is_available: bool = True

    class Config:
        from_attributes = True


class PublicUserOut(BaseModel):
    id: int
    username: str
    full_name: Optional[str] = None
    pronouns: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    is_suspended: bool
    is_available: bool = True
    is_friend: bool = False
    is_restricted_in_group: bool = False
    friend_state: str = "none"
    friend_request_id: Optional[int] = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    email: str
    role: str


class GroupCreate(BaseModel):
    name: str


class GroupJoin(BaseModel):
    invite_code: str


class GroupOut(BaseModel):
    id: int
    name: str
    invite_code: str
    created_by_id: int
    is_suspended: bool = False
    suspension_reason: Optional[str] = None
    member_count: Optional[int] = None
    member_preview: list[PublicUserOut] = []

    class Config:
        from_attributes = True


class MessageIn(BaseModel):
    content: str


class MessageUpdate(BaseModel):
    content: str


class MessageOut(BaseModel):
    id: int
    group_id: int
    user_id: Optional[int] = None
    username: str
    full_name: Optional[str] = None
    pronouns: Optional[str] = None
    avatar_url: Optional[str] = None
    sender_is_suspended: bool = False
    sender_is_available: bool = True
    content: str
    created_at: datetime
    message_type: str = "message"
    is_hidden_for_viewer: bool = False


class FriendshipActionRequest(BaseModel):
    friend_user_id: int


class UnreadGroupCountOut(BaseModel):
    group_id: int
    unread_count: int


class UnreadSummaryOut(BaseModel):
    total_unread: int
    groups: list[UnreadGroupCountOut]


class UnreadNavbarOut(BaseModel):
    total_unread: int


class AlertOut(BaseModel):
    id: int
    group_id: int
    message_id: Optional[int] = None
    sender_username: str
    trigger_text: str
    matched_reasons: Optional[str] = None
    category: str = "other/general risk"
    categories: list[str] = []
    severity: str
    level: str
    detail: str
    status: str
    is_reviewed: bool
    admin_note: Optional[str] = None
    reviewed_by_id: Optional[int] = None
    reviewed_by_username: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserAlertOut(BaseModel):
    id: int
    group_id: int
    message_id: Optional[int] = None
    sender_username: str
    trigger_text: str
    matched_reasons: Optional[str] = None
    category: str = "other/general risk"
    categories: list[str] = []
    severity: str
    detail: str
    created_at: datetime

    class Config:
        from_attributes = True


class AdminAlertOut(AlertOut):
    group_name: Optional[str] = None
    sender_user_id: Optional[int] = None
    sender_display_name: Optional[str] = None
    sender_email: Optional[str] = None
    sender_is_suspended: Optional[bool] = None
    sender_is_restricted_in_group: bool = False
    message_content: Optional[str] = None
    message_created_at: Optional[datetime] = None


class AlertActionRequest(BaseModel):
    admin_note: Optional[str] = None


class UserAlertCreateRequest(BaseModel):
    message_id: Optional[int] = None
    group_id: Optional[int] = None
    message_text: str
    against_user: Optional[str] = None
    reason: Optional[str] = None


class UserMuteCreateRequest(BaseModel):
    muted_user_id: int


class UserMuteOut(BaseModel):
    id: int
    muter_id: int
    muted_user_id: int
    group_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class UserReportCreateRequest(BaseModel):
    reported_user_id: int
    group_id: int
    message_id: Optional[int] = None
    reason: str
    details: Optional[str] = None


class UserReportActionRequest(BaseModel):
    admin_note: Optional[str] = None


class UserReportOut(BaseModel):
    id: int
    reporter_id: int
    reporter_username: str
    reported_user_id: int
    reported_username: str
    reported_user_display_name: Optional[str] = None
    reported_user_is_suspended: bool = False
    reported_user_is_restricted_in_group: bool = False
    group_id: int
    group_name: Optional[str] = None
    message_id: Optional[int] = None
    message_preview: Optional[str] = None
    reason: str
    details: Optional[str] = None
    status: str
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by_id: Optional[int] = None
    reviewed_by_username: Optional[str] = None
    admin_note: Optional[str] = None


class GroupRestrictionActionRequest(BaseModel):
    reason: Optional[str] = None


class GroupSuspensionActionRequest(BaseModel):
    reason: Optional[str] = None


class GroupRestrictionOut(BaseModel):
    id: int
    user_id: int
    group_id: int
    reason: Optional[str] = None
    created_by_id: int
    restricted_until: Optional[datetime] = None
    restricted_by_system: bool = False
    resolved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CategoryCountOut(BaseModel):
    name: str
    count: int


class FriendRequestActionRequest(BaseModel):
    user_id: int


class FriendRequestRespondRequest(BaseModel):
    action: str


class FriendRequestOut(BaseModel):
    id: int
    status: str
    created_at: datetime
    responded_at: Optional[datetime] = None
    requester: PublicUserOut
    receiver: PublicUserOut


class FriendRequestSummaryOut(BaseModel):
    incoming: list[FriendRequestOut]
    outgoing: list[FriendRequestOut]
    friends: list[PublicUserOut]


class PasswordForgotRequest(BaseModel):
    identity: str


class PasswordForgotResponse(BaseModel):
    message: str
    reset_token: Optional[str] = None
    reset_url: Optional[str] = None


class PasswordResetRequest(BaseModel):
    token: str
    password: str


class ReportsAnalyticsPointOut(BaseModel):
    label: str
    value: int


class ReportsAnalyticsSummaryOut(BaseModel):
    total_alerts: int
    pending_review_alerts: int
    high_risk_alerts: int
    reviewed_alerts: int
    dismissed_alerts: int
    total_user_reports: int
    suspended_users: int
    restricted_groups: int
    active_group_restrictions: int
    suspended_groups: int


class ReportsAnalyticsResponse(BaseModel):
    summary: ReportsAnalyticsSummaryOut
    alerts_by_severity: list[ReportsAnalyticsPointOut]
    alerts_by_status: list[ReportsAnalyticsPointOut]
    reports_by_reason: list[ReportsAnalyticsPointOut]
    safety_activity_over_time: list[ReportsAnalyticsPointOut]
    top_flagged_groups: list[ReportsAnalyticsPointOut]
    top_risk_categories: list[ReportsAnalyticsPointOut]


class AdminDashboardResponse(BaseModel):
    total_users: int
    total_groups: int
    total_messages: int
    total_flagged_messages: int
    total_alerts: int
    pending_alerts: int
    reviewed_alerts: int
    high_severity_alerts: int
    high_risk_alerts: int
    dismissed_alerts: int
    suspended_users: int
    pending_reports: int
    reviewed_reports: int
    alerts_by_severity: dict[str, int]
    alerts_by_category: dict[str, int]
    review_status_counts: dict[str, int]
    average_response_time_seconds: Optional[float] = None
    most_common_categories: list[CategoryCountOut]
    recent_alerts: list[AlertOut]


class AdminModerationCountsOut(BaseModel):
    pending_review_count: int
    high_risk_count: int
    reviewed_count: int
    reported_users_count: int
    new_alerts_count: int


class AdminUserActionRequest(BaseModel):
    reason: Optional[str] = None


class AdminGroupMemberOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    pronouns: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    is_suspended: bool
    is_restricted_in_group: bool = False
    joined_at: datetime


class AdminGroupOut(BaseModel):
    id: int
    name: str
    invite_code: str
    created_at: datetime
    created_by_id: int
    created_by_username: str
    is_suspended: bool = False
    suspended_at: Optional[datetime] = None
    suspension_reason: Optional[str] = None
    member_count: int
    members: list[AdminGroupMemberOut]
