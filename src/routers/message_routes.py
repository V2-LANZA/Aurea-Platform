from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from src.services.detect import analyze 

from ..deps import get_db
from ..auth import get_current_user
from ..models import Message, GroupMember, Alert
from ..schemas import MessageOut, MessageUpdate
from pydantic import BaseModel, Field  # local schema for create

RISK_THRESHOLD = 0.6

router = APIRouter(prefix="/groups", tags=["messages"])

class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=1000)

def _ensure_member(db: Session, gid: int, user_id: int):
    member = db.query(GroupMember).filter_by(group_id=gid, user_id=user_id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this group")

@router.get("/{gid}/messages", response_model=list[MessageOut])
def get_messages(gid: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    _ensure_member(db, gid, user.id)
    rows = (
        db.query(Message)
        .filter(Message.group_id == gid)
        .order_by(Message.created_at.desc())
        .limit(50)
        .all()
    )
    return [MessageOut(id=m.id, group_id=m.group_id, user_id=m.user_id, content=m.content) for m in rows]

@router.post("/{gid}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def send_message(gid: int, payload: MessageCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    _ensure_member(db, gid, user.id)

    m = Message(group_id=gid, user_id=user.id, content=payload.content, is_bot=False)
    db.add(m); db.commit(); db.refresh(m)

    score, reasons = analyze(payload.content)
    print("AUREA detect:", m.id, score, reasons)  # <-- visible in terminal for proof

    if score >= RISK_THRESHOLD:
        db.add(Alert(message_id=m.id, group_id=gid, user_id=user.id,
                     score=score, reasons=",".join(reasons)))
        db.commit()

    return MessageOut(id=m.id, group_id=m.group_id, user_id=m.user_id, content=m.content)

def _role(db: Session, gid: int, uid: int) -> str | None:
    gm = db.query(GroupMember).filter_by(group_id=gid, user_id=uid).first()
    return gm.role if gm else None

@router.patch("/{gid}/messages/{mid}", response_model=MessageOut)
def edit_message(
    gid: int,
    mid: int,
    payload: MessageUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    _ensure_member(db, gid, user.id)
    m = db.query(Message).get(mid)
    if not m or m.group_id != gid:
        raise HTTPException(status_code=404, detail="Message not found")
    role = _role(db, gid, user.id)
    if user.id != m.user_id and role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only author or owner can edit")
    m.content = payload.content
    db.commit(); db.refresh(m)

    # optional: re-analyze & update alerts if you added the detector
    try:
        from src.services.detect import analyze
        score, reasons = analyze(m.content)
        db.query(Alert).filter_by(message_id=m.id).delete(synchronize_session=False)
        if score >= 0.6:
            db.add(Alert(message_id=m.id, group_id=gid, user_id=m.user_id, score=score, reasons=",".join(reasons)))
        db.commit()
    except Exception:
        pass

    return MessageOut(id=m.id, group_id=m.group_id, user_id=m.user_id, content=m.content)


@router.delete("/{gid}/messages/{mid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message(
    gid: int,
    mid: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    _ensure_member(db, gid, user.id)
    m = db.query(Message).get(mid)
    if not m or m.group_id != gid:
        raise HTTPException(status_code=404, detail="Message not found")
    role = _role(db, gid, user.id)
    if user.id != m.user_id and role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only author or owner can delete")
    db.query(Alert).filter_by(message_id=m.id).delete(synchronize_session=False)
    db.delete(m); db.commit()
    return
