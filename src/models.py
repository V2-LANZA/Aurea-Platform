# src/models.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, Float, DateTime, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from .db import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Group(Base):
    __tablename__ = "groups"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    invite_code = Column(String, unique=True, index=True, nullable=False)
    bot_enabled = Column(Boolean, default=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)

class GroupMember(Base):
    __tablename__ = "group_members"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), primary_key=True)
    role = Column(String, default="member")

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # null when bot
    content = Column(Text, nullable=False)
    is_bot = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

class Alert(Base):
    __tablename__ = "alerts"
    id         = Column(Integer, primary_key=True)
    message_id = Column(Integer, ForeignKey("messages.id"), index=True, nullable=False)
    group_id   = Column(Integer, ForeignKey("groups.id"),   index=True, nullable=False)
    user_id    = Column(Integer, ForeignKey("users.id"),    index=True, nullable=True)
    score      = Column(Float, nullable=False)
    reasons    = Column(String, nullable=False)  # comma-joined reason keys
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (Index("ix_alerts_group_time", "group_id", "created_at"),)


Index("ix_alerts_group_time", Alert.group_id, Alert.created_at)
