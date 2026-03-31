from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db
from ..models import Alert, GroupMember, User
from ..schemas import AlertOut

router = APIRouter()


@router.get("", response_model=list[AlertOut])
def list_alerts(
    group_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(Alert)
        .join(GroupMember, GroupMember.group_id == Alert.group_id)
        .filter(GroupMember.user_id == current_user.id)
    )

    if group_id is not None:
        query = query.filter(Alert.group_id == group_id)

    return query.order_by(Alert.created_at.desc()).all()