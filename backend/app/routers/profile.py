import uuid
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.dependencies import get_current_user
from app.schemas.user import ProfileUpdateRequest
from app.services import s3_service
from app.config import get_settings

settings = get_settings()

router = APIRouter(prefix="/api", tags=["profile"])

def format_user_profile(user: User) -> dict:
    avatar_url = None
    if user.avatar_url:
        avatar_url = f"/api/profile/avatar/{user.id}/"
    else:
        import glob
        for base_dir in ["/app/data", "./backend/data", "./data", "."]:
            avatars_dir = os.path.join(base_dir, "avatars")
            if os.path.exists(avatars_dir):
                matches = glob.glob(os.path.join(avatars_dir, f"user_{user.id}_*"))
                if matches:
                    avatar_url = f"/api/profile/avatar/{user.id}/"
                    break

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "mobile_number": user.mobile_number,
        "usn": user.usn,
        "sem": user.sem,
        "avatar_url": avatar_url,
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

@router.get("/profile/avatar/{user_id}/")
@router.get("/profile/avatar/{user_id}")
async def get_user_avatar(user_id: int, db: AsyncSession = Depends(get_db)):
    # 1. Local disk file response (super fast)
    import glob
    for base_dir in ["/app/data", "./backend/data", "./data", "."]:
        avatars_dir = os.path.join(base_dir, "avatars")
        if os.path.exists(avatars_dir):
            matches = glob.glob(os.path.join(avatars_dir, f"user_{user_id}_*"))
            if matches:
                matches.sort(key=os.path.getmtime, reverse=True)
                local_path = matches[0]
                if os.path.exists(local_path) and os.path.getsize(local_path) > 0:
                    from fastapi.responses import FileResponse
                    media_type = "image/png" if local_path.endswith(".png") else "image/jpeg"
                    return FileResponse(path=local_path, media_type=media_type)

    res = await db.execute(select(User).where(User.id == user_id))
    target_user = res.scalar_one_or_none()
    if not target_user or not target_user.avatar_url:
        raise HTTPException(status_code=404, detail="Avatar not found")
        
    s3_key = target_user.avatar_url
    if "avatars/" in s3_key:
        s3_key = "avatars/" + s3_key.split("avatars/")[-1].split("?")[0]
        
    if s3_key and not s3_key.startswith("http"):
        # 2. Download from S3 with server credentials (works on private buckets)
        try:
            img_bytes = await s3_service.download_file_bytes(s3_key)
            if img_bytes and len(img_bytes) > 0:
                import io
                from fastapi.responses import StreamingResponse
                media_type = "image/png" if s3_key.endswith(".png") else "image/jpeg"
                return StreamingResponse(io.BytesIO(img_bytes), media_type=media_type)
        except Exception as e:
            print(f"[AvatarServe] S3 stream warning: {e}")
            
        # 3. Presigned URL redirect
        try:
            presigned_url = await s3_service.generate_presigned_download_url(s3_key, expires_in=86400)
            if presigned_url:
                from fastapi.responses import RedirectResponse
                return RedirectResponse(url=presigned_url, status_code=307)
        except Exception:
            pass

    if target_user.avatar_url.startswith("http"):
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=target_user.avatar_url, status_code=307)
        
    raise HTTPException(status_code=404, detail="Avatar not found")

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

    # 1. Save local copy immediately for instant display
    for base_dir in ["/app/data", "./backend/data", "./data", "."]:
        try:
            local_target = os.path.join(base_dir, s3_key)
            os.makedirs(os.path.dirname(local_target), exist_ok=True)
            with open(local_target, "wb") as f:
                f.write(file_bytes)
            break
        except Exception:
            pass

    user.avatar_url = s3_key
    await db.commit()
    await db.refresh(user)

    # 2. Upload to S3 asynchronously in the background so API responds in milliseconds
    import asyncio
    asyncio.create_task(s3_service.upload_file_bytes(s3_key, file_bytes, content_type=content_type))

    return {
        "message": "Profile photo updated successfully",
        "avatar_url": f"/api/profile/avatar/{user.id}/",
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
