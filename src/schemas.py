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


class FriendshipActionRequest(BaseModel):
    friend_user_id: int


class UnreadGroupCountOut(BaseModel):
    group_id: int
    unread_count: int


class UnreadSummaryOut(BaseModel):
    total_unread: int
    groups: list[UnreadGroupCountOut]


class AlertOut(BaseModel):
    id: int
    group_id: int
    message_id: Optional[int] = None
    sender_username: str
    trigger_text: str
    matched_reasons: Optional[str] = None
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


class AdminAlertOut(AlertOut):
    group_name: Optional[str] = None
    sender_user_id: Optional[int] = None
    sender_display_name: Optional[str] = None
    sender_email: Optional[str] = None
    sender_is_suspended: Optional[bool] = None
    message_content: Optional[str] = None
    message_created_at: Optional[datetime] = None


class AlertActionRequest(BaseModel):
    admin_note: Optional[str] = None


class AdminDashboardResponse(BaseModel):
    total_users: int
    total_groups: int
    total_messages: int
    total_alerts: int
    pending_alerts: int
    high_severity_alerts: int
    escalated_alerts: int
    suspended_users: int
    recent_alerts: list[AlertOut]


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
    joined_at: datetime


class AdminGroupOut(BaseModel):
    id: int
    name: str
    invite_code: str
    created_at: datetime
    created_by_id: int
    created_by_username: str
    member_count: int
    members: list[AdminGroupMemberOut]
