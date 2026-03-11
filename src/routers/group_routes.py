from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import secrets
import string

from ..deps import get_db
from ..auth import get_current_user
from ..models import Group, GroupMember
from ..schemas import GroupCreate, GroupOut, JoinIn

router = APIRouter()  # prefix added in app.py as /groups


def _make_invite_code(n: int = 8) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(n))


def _group_out(g: Group) -> dict:
    return {
        "id": g.id,
        "name": g.name,
        "invite_code": g.invite_code,
        "bot_enabled": getattr(g, "bot_enabled", False),
    }


@router.get("", response_model=list[GroupOut])
@router.get("/mine", response_model=list[GroupOut])
def my_groups(db: Session = Depends(get_db), user=Depends(get_current_user)):
    rows = (
        db.query(Group)
        .join(GroupMember, GroupMember.group_id == Group.id)
        .filter(GroupMember.user_id == user.id)
        .order_by(Group.id.desc())
        .all()
    )
    return [_group_out(g) for g in rows]


@router.post("", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
@router.post("/create", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
def create_group(payload: GroupCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    # unique invite code
    code = _make_invite_code()
    for _ in range(10):
        exists = db.query(Group).filter_by(invite_code=code).first()
        if not exists:
            break
        code = _make_invite_code()
    else:
        raise HTTPException(status_code=500, detail="Could not generate invite code")

    # ✅ IMPORTANT: created_by required by your DB schema
    g = Group(
        name=payload.name,
        invite_code=code,
        bot_enabled=getattr(payload, "bot_enabled", False),
        created_by=user.id,
    )
    db.add(g)
    db.commit()
    db.refresh(g)

    # creator is a member
    existing = db.query(GroupMember).filter_by(group_id=g.id, user_id=user.id).first()
    if not existing:
        db.add(GroupMember(group_id=g.id, user_id=user.id))
        db.commit()

    return _group_out(g)


@router.post("/join", response_model=GroupOut)
def join_group(payload: JoinIn, db: Session = Depends(get_db), user=Depends(get_current_user)):
    g = db.query(Group).filter_by(invite_code=payload.invite_code).first()
    if not g:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    existing = db.query(GroupMember).filter_by(group_id=g.id, user_id=user.id).first()
    if not existing:
        db.add(GroupMember(group_id=g.id, user_id=user.id))
        db.commit()

    return _group_out(g)


@router.get("/{gid}", response_model=GroupOut)
def get_group(gid: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    member = db.query(GroupMember).filter_by(group_id=gid, user_id=user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this group")

    g = db.query(Group).filter_by(id=gid).first()
    if not g:
        raise HTTPException(status_code=404, detail="Group not found")

    return _group_out(g)