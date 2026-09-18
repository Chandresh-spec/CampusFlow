from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any

from app.database import get_db
from app.models.user import User, UserRole
from app.services import auth_service, email_service, otp_service
from app.schemas.auth import (
    LoginRequest, RegisterRequest, RefreshTokenRequest,
    ForgotPasswordRequest, VerifyOTPRequest, ResetPasswordRequest,
    SendRegisterOTPRequest, VerifyRegisterRequest,
    TokenResponse, UserResponse
)

router = APIRouter(prefix="/api", tags=["auth"])

def format_user_dict(u: User) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "role": u.role.value if hasattr(u.role, "value") else str(u.role),
        "mobile_number": u.mobile_number,
        "usn": u.usn,
        "sem": u.sem,
    }

@router.post("/login/", response_model=Dict[str, Any])
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == req.username))
    user = result.scalar_one_or_none()
    
    if not user or not auth_service.verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
        
    access = auth_service.create_access_token(user_id=user.id)
    refresh = auth_service.create_refresh_token(user_id=user.id)
    
    user.last_login = auth_service.get_current_time()
    await db.commit()
    
    return {
        "message": "Login successful",
        "user": format_user_dict(user),
        "tokens": {
            "access": access,
            "refresh": refresh
        }
    }

@router.post("/register/", status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where((User.username == req.username) | (User.email == req.email)))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")
        
    role_str = (req.role or "student").lower()
    role_val = UserRole(role_str) if role_str in UserRole._value2member_map_ else UserRole.student
    sem_val = req.sem if req.sem is not None else getattr(req, "semester", None)

    user = User(
        username=req.username,
        email=req.email,
        hashed_password=auth_service.hash_password(req.password),
        role=role_val,
        mobile_number=req.mobile_number,
        usn=req.usn,
        sem=sem_val
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    access = auth_service.create_access_token(user_id=user.id)
    refresh = auth_service.create_refresh_token(user_id=user.id)
    
    return {
        "message": "Registration successful",
        "user": format_user_dict(user),
        "tokens": {
            "access": access,
            "refresh": refresh
        }
    }

@router.post("/auth/refresh/")
async def refresh_token(req: RefreshTokenRequest):
    try:
        user_id = auth_service.decode_refresh_token(req.refresh)
        access = auth_service.create_access_token(user_id=user_id)
        return {"access": access}
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

@router.post("/forgot-password/")
async def forgot_password(req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    otp = otp_service.generate_otp()
    key = f"forgot_otp_{req.email}"
    otp_service.store_otp(key, otp)
    await email_service.send_email(req.email, "Password Reset OTP", f"Your OTP is {otp}")
    
    return {"message": "OTP sent successfully"}

@router.post("/verify-otp/")
async def verify_otp(req: VerifyOTPRequest):
    key = f"forgot_otp_{req.email}"
    if not otp_service.verify_otp(key, req.otp):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP")
        
    otp_service.set_flag(f"forgot_verified_{req.email}", ttl=600)
    return {"message": "OTP verified successfully"}

@router.post("/reset-password/")
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    new_pwd = getattr(req, 'new_password', None) or getattr(req, 'password', None)
    if not new_pwd or len(new_pwd) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters")
        
    verified_key = f"forgot_verified_{req.email}"
    is_verified = otp_service.check_flag(verified_key)
    
    if not is_verified:
        if not req.otp or not otp_service.verify_otp(f"forgot_otp_{req.email}", req.otp):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP not verified")
            
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    user.hashed_password = auth_service.hash_password(new_pwd)
    await db.commit()
    
    otp_service.delete_otp(f"forgot_otp_{req.email}")
    otp_service.delete_otp(verified_key)
    
    return {"message": "Password reset successfully"}

@router.post("/send-register-otp/")
async def send_register_otp(req: SendRegisterOTPRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where((User.email == req.email) | (User.username == req.username)))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists")
        
    otp = otp_service.generate_otp()
    key = f"register_otp_{req.email}"
    otp_service.store_otp(key, otp)
    await email_service.send_email(req.email, "Registration OTP", f"Your OTP is {otp}")
    
    return {"message": "OTP sent successfully"}

@router.post("/verify-register/", status_code=status.HTTP_201_CREATED)
async def verify_register(req: VerifyRegisterRequest, db: AsyncSession = Depends(get_db)):
    key = f"register_otp_{req.email}"
    if not otp_service.verify_otp(key, req.otp):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP")
        
    user = User(
        username=req.username,
        email=req.email,
        hashed_password=auth_service.hash_password(req.password),
        role=req.role if req.role else UserRole.student,
        mobile_number=req.mobile_number,
        usn=req.usn,
        sem=req.sem
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    otp_service.delete_otp(key)
    
    access = auth_service.create_access_token(user_id=user.id)
    refresh = auth_service.create_refresh_token(user_id=user.id)
    
    return {
        "message": "Registration successful",
        "user": format_user_dict(user),
        "tokens": {
            "access": access,
            "refresh": refresh
        }
    }
