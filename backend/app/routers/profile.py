from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.dependencies import get_current_user
from app.schemas.user import ProfileUpdateRequest
from app.services import auth_service

router = APIRouter(prefix="/api", tags=["profile"])

INSTITUTIONAL_FACULTY_PASSKEY = "CAMPUS_FACULTY_2026"

@router.get("/profile/")
async def get_profile(user: User = Depends(get_current_user)):
    return user

@router.patch("/profile/")
async def update_profile(
    req: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if req.email is not None and req.email.strip():
        user.email = req.email.strip().lower()
    if req.mobile_number is not None:
        user.mobile_number = req.mobile_number.strip()
    if req.sem is not None:
        user.sem = req.sem
    elif req.semester is not None:
        user.sem = req.semester

    # Strict Role Authentication: elevation from Student to Faculty/Teacher requires passcode
    if req.role is not None:
        r = req.role.strip().lower()
        if r in ["faculty", "teacher"]:
            if user.role == UserRole.student:
                if not req.faculty_code or req.faculty_code.strip() != INSTITUTIONAL_FACULTY_PASSKEY:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Valid Institutional Faculty Passcode is required to elevate to Teacher/Faculty role."
                    )
            user.role = UserRole.faculty
        elif r == "admin":
            if user.role != UserRole.admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admin role can only be assigned by existing administrators."
                )
            user.role = UserRole.admin
        else:
            user.role = UserRole.student

    # Password Change Handling with current password validation
    if req.new_password:
        if len(req.new_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be at least 6 characters long."
            )
        if not req.current_password or not auth_service.verify_password(req.current_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password does not match."
            )
        user.hashed_password = auth_service.hash_password(req.new_password)
        
    await db.commit()
    await db.refresh(user)
    return user
