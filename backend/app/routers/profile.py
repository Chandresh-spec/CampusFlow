import uuid
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.dependencies import get_current_user
from app.schemas.user import ProfileUpdateRequest
from app.services import s3_service
from app.config import get_settings

settings = get_settings()

router = APIRouter(prefix="/api", tags=["profile"])

def format_user_profile(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "mobile_number": user.mobile_number,
        "usn": user.usn,
        "sem": user.sem,
        "avatar_url": user.avatar_url,
        "bio": user.bio,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
    }

@router.get("/profile/")
async def get_profile(user: User = Depends(get_current_user)):
    return format_user_profile(user)

@router.patch("/profile/")
async def update_profile(
    req: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if req.email is not None:
        user.email = req.email.strip().lower()
    if req.mobile_number is not None:
        user.mobile_number = req.mobile_number.strip()
    if req.sem is not None:
        user.sem = req.sem
    if req.bio is not None:
        user.bio = req.bio.strip()
    if req.avatar_url is not None:
        user.avatar_url = req.avatar_url.strip()
        
    await db.commit()
    await db.refresh(user)
    return format_user_profile(user)

@router.post("/profile/avatar/")
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    content_type = file.content_type or "image/jpeg"
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image files (JPEG, PNG, WebP, GIF) are allowed"
        )

    file_bytes = await file.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Profile picture must be under 5MB"
        )

    # Determine extension
    ext = "jpg"
    if "png" in content_type:
        ext = "png"
    elif "webp" in content_type:
        ext = "webp"
    elif "gif" in content_type:
        ext = "gif"

    s3_key = f"avatars/user_{user.id}_{uuid.uuid4().hex[:8]}.{ext}"

    # Upload to AWS S3 (and local persistent cache)
    await s3_service.upload_file_bytes(s3_key, file_bytes, content_type=content_type)

    if settings.S3_BUCKET_NAME and settings.AWS_ACCESS_KEY_ID:
        avatar_url = f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{s3_key}"
    else:
        avatar_url = f"/data/{s3_key}"

    user.avatar_url = avatar_url
    await db.commit()
    await db.refresh(user)

    return {
        "message": "Avatar uploaded successfully to S3",
        "avatar_url": user.avatar_url,
        "user": format_user_profile(user)
    }

@router.delete("/profile/avatar/")
async def delete_avatar(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if user.avatar_url:
        try:
            # Extract s3 key if applicable
            if "avatars/" in user.avatar_url:
                s3_key = "avatars/" + user.avatar_url.split("avatars/")[-1]
                await s3_service.delete_object(s3_key)
        except Exception:
            pass

    user.avatar_url = None
    await db.commit()
    await db.refresh(user)

    return {
        "message": "Avatar removed successfully",
        "user": format_user_profile(user)
    }
