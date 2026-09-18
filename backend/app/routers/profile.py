from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.dependencies import get_current_user
from app.schemas.user import ProfileUpdateRequest

router = APIRouter(prefix="/api", tags=["profile"])

@router.get("/profile/")
async def get_profile(user: User = Depends(get_current_user)):
    return user

@router.patch("/profile/")
async def update_profile(
    req: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if req.email is not None:
        user.email = req.email
    if req.mobile_number is not None:
        user.mobile_number = req.mobile_number
    if req.sem is not None:
        user.sem = req.sem
        
    await db.commit()
    await db.refresh(user)
    return user
