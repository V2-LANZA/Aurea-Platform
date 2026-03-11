from pydantic import BaseModel, Field
from typing import Optional, List


# ---------- Auth ----------
class RegisterIn(BaseModel):
    # UI sends username; we accept it.
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=6, max_length=64)

class LoginIn(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=6, max_length=64)

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class MeOut(BaseModel):
    id: int
    username: str


# ---------- Groups ----------
class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)

class JoinIn(BaseModel):
    invite_code: str

class GroupOut(BaseModel):
    id: int
    name: str
    invite_code: str
    bot_enabled: bool

class GroupUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    bot_enabled: Optional[bool] = None


# ---------- Messages ----------
class MessageOut(BaseModel):
    id: int
    group_id: int
    user_id: Optional[int] = None
    content: str

class MessageUpdate(BaseModel):
    content: str = Field(min_length=1, max_length=1000)


# ---------- Alerts ----------
class AlertCreateIn(BaseModel):
    message_text: str = Field(min_length=1, max_length=2000)
    against_user: str = Field(min_length=1, max_length=80)
    reason: Optional[str] = None
    message_id: Optional[int] = None
    group_id: Optional[int] = None  # if your frontend sends it

class AlertOut(BaseModel):
    id: int
    message_id: Optional[int] = None
    score: Optional[float] = None
    reasons: List[str] = []
    created_at: str