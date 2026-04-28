from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    date_of_birth = Column(Date, nullable=True)
    full_name = Column(String(120), nullable=True)
    pronouns = Column(String(50), nullable=True)
    bio = Column(Text, nullable=True)
    avatar_url = Column(Text, nullable=True)
    password_hash = Column(String(255), nullable=False)

    role = Column(String(20), default="user", nullable=False)  # user | admin
    is_suspended = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    memberships = relationship("GroupMember", back_populates="user", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="user", cascade="all, delete-orphan")
    group_states = relationship("UserGroupState", back_populates="user", cascade="all, delete-orphan")
    sent_reports = relationship("UserReport", foreign_keys="UserReport.reporter_id", back_populates="reporter")
    received_reports = relationship("UserReport", foreign_keys="UserReport.reported_user_id", back_populates="reported_user")

    @property
    def is_available(self):
        return not self.is_suspended


class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    invite_code = Column(String(20), unique=True, index=True, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_suspended = Column(Boolean, default=False, nullable=False)
    suspended_at = Column(DateTime(timezone=True), nullable=True)
    suspended_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    suspension_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    members = relationship("GroupMember", back_populates="group", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="group", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="group", cascade="all, delete-orphan")
    reports = relationship("UserReport", back_populates="group", cascade="all, delete-orphan")


class GroupMember(Base):
    __tablename__ = "group_members"
    __table_args__ = (
        UniqueConstraint("user_id", "group_id", name="uq_user_group"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="memberships")
    group = relationship("Group", back_populates="members")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    group = relationship("Group", back_populates="messages")
    user = relationship("User", back_populates="messages")
    reports = relationship("UserReport", back_populates="message")


class UserGroupState(Base):
    __tablename__ = "user_group_states"
    __table_args__ = (
        UniqueConstraint("user_id", "group_id", name="uq_user_group_state"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False, index=True)
    last_read_message_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    last_read_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="group_states")
    group = relationship("Group")


class Friendship(Base):
    __tablename__ = "friendships"
    __table_args__ = (
        UniqueConstraint("user_id", "friend_id", name="uq_friendship_pair"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    friend_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    friend = relationship("User", foreign_keys=[friend_id])


class FriendRequest(Base):
    __tablename__ = "friend_requests"
    __table_args__ = (
        UniqueConstraint("requester_id", "receiver_id", name="uq_friend_request_pair"),
    )

    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(20), default="pending", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    responded_at = Column(DateTime(timezone=True), nullable=True)

    requester = relationship("User", foreign_keys=[requester_id])
    receiver = relationship("User", foreign_keys=[receiver_id])


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=True)

    sender_username = Column(String(80), nullable=False)
    trigger_text = Column(Text, nullable=False)
    matched_reasons = Column(Text, nullable=True)

    severity = Column(String(20), default="low", nullable=False)   # low | medium | high
    level = Column(String(30), default="flagged", nullable=False)
    detail = Column(Text, nullable=False)

    status = Column(String(20), default="pending_review", nullable=False)  # pending_review | high_risk | reviewed | dismissed
    is_reviewed = Column(Boolean, default=False, nullable=False)
    admin_note = Column(Text, nullable=True)

    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    group = relationship("Group", back_populates="alerts")
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])

    @property
    def reviewed_by_username(self):
        if not self.reviewed_by:
            return None
        return self.reviewed_by.full_name or self.reviewed_by.username


class UserMute(Base):
    __tablename__ = "user_mutes"
    __table_args__ = (
        UniqueConstraint("muter_id", "muted_user_id", "group_id", name="uq_user_mute"),
    )

    id = Column(Integer, primary_key=True, index=True)
    muter_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    muted_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class GroupRestriction(Base):
    __tablename__ = "group_restrictions"
    __table_args__ = (
        UniqueConstraint("user_id", "group_id", name="uq_group_restriction"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False, index=True)
    reason = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    restricted_until = Column(DateTime(timezone=True), nullable=True)
    restricted_by_system = Column(Boolean, default=False, nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class UserReport(Base):
    __tablename__ = "user_reports"

    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    reported_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=True, index=True)
    reason = Column(String(120), nullable=False)
    details = Column(Text, nullable=True)
    status = Column(String(20), default="pending", nullable=False)
    admin_note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    reporter = relationship("User", foreign_keys=[reporter_id], back_populates="sent_reports")
    reported_user = relationship("User", foreign_keys=[reported_user_id], back_populates="received_reports")
    group = relationship("Group", back_populates="reports")
    message = relationship("Message", back_populates="reports")
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String(255), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", foreign_keys=[user_id])
