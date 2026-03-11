from fastapi import APIRouter, Depends
from ..auth import get_current_user
from ..schemas import MeOut

router = APIRouter()  # no prefix here


@router.get("/me", response_model=MeOut)
def me(user=Depends(get_current_user)):
    return MeOut(id=user.id, username=user.email)