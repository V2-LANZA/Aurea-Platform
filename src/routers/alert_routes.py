from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..deps import get_db
from ..auth import get_current_user
from ..models import Alert, GroupMember

router = APIRouter()  # IMPORTANT: no prefix here


def _is_member(db: Session, gid: int, uid: int) -> bool:
    return db.query(GroupMember).filter_by(group_id=gid, user_id=uid).first() is not None


@router.get("/{gid}")
def list_alerts(gid: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not _is_member(db, gid, user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this group")

    rows = (
        db.query(Alert)
        .filter(Alert.group_id == gid)
        .order_by(Alert.created_at.desc())
        .limit(50)
        .all()
    )

    out = []
    for a in rows:
        reasons = []
        if getattr(a, "reasons", None):
            reasons = [r.strip() for r in a.reasons.split(",") if r.strip()]

        out.append(
            {
                "id": a.id,
                "message_id": a.message_id,
                "score": getattr(a, "score", None),
                "reasons": reasons,
                "created_at": a.created_at.isoformat() if hasattr(a.created_at, "isoformat") else str(a.created_at),
            }
        )
    return out