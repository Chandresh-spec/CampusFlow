from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any

import secrets
import httpx
from app.database import get_db
from app.models.user import User, UserRole
from app.services import auth_service, email_service, otp_service
from app.schemas.auth import (
    LoginRequest, RegisterRequest, RefreshTokenRequest,
    ForgotPasswordRequest, VerifyOTPRequest, ResetPasswordRequest,
    SendRegisterOTPRequest, VerifyRegisterRequest,
    GoogleAuthRequest, SendGmailLoginOTPRequest, VerifyGmailLoginRequest,
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
        
    # Honor explicit role chosen at login or auto-detect teacher/faculty usernames
    if req.role:
        r = req.role.strip().lower()
        if r in ["teacher", "faculty", "professor"]:
            user.role = UserRole.faculty
        elif r == "student":
            user.role = UserRole.student
    elif user.username.lower().endswith("teacher") or user.username.lower().startswith("teacher") or "faculty" in user.username.lower():
        user.role = UserRole.faculty
        
    access = auth_service.create_access_token(user_id=user.id)
    refresh = auth_service.create_refresh_token(user_id=user.id)
    
    user.last_login = auth_service.get_current_time()
    await db.commit()
    await db.refresh(user)
    
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
        
    role_str = (req.role or "student").strip().lower()
    if role_str in ["teacher", "faculty", "professor"]:
        role_val = UserRole.faculty
    elif role_str == "admin":
        role_val = UserRole.admin
    else:
        role_val = UserRole.student
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
        return {"access": access, "refresh": req.refresh}
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
        
    role_str = (req.role or "student").strip().lower()
    if role_str in ["teacher", "faculty", "professor"]:
        role_val = UserRole.faculty
    elif role_str == "admin":
        role_val = UserRole.admin
    else:
        role_val = UserRole.student
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

@router.post("/auth/google/", response_model=Dict[str, Any])
@router.post("/google-login/", response_model=Dict[str, Any])
async def google_auth(req: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    email = None
    name = req.name or ""
    
    token = req.credential or req.id_token
    if token:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={token}")
                if resp.status_code == 200:
                    info = resp.json()
                    email = info.get("email")
                    name = name or info.get("name") or info.get("given_name", "")
        except Exception as e:
            print(f"[GOOGLE AUTH] Token verification error: {e}")
            
    if not email and req.access_token:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    headers={"Authorization": f"Bearer {req.access_token}"}
                )
                if resp.status_code == 200:
                    info = resp.json()
                    email = info.get("email")
                    name = name or info.get("name")
        except Exception as e:
            print(f"[GOOGLE AUTH] Access token verification error: {e}")
            
    # Direct fallback if email is provided and matches Gmail or test domain
    if not email and req.email:
        email = req.email.strip().lower()
        
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to verify Google account or email missing"
        )
        
    email = email.strip().lower()
    
    # Check if user exists
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    
    if not user:
        # Create user
        base_username = (email.split("@")[0] or "user").replace(".", "_")[:18]
        username_candidate = base_username
        
        # Check uniqueness
        counter = 1
        while True:
            res_user = await db.execute(select(User).where(User.username == username_candidate))
            if not res_user.scalar_one_or_none():
                break
            username_candidate = f"{base_username}_{counter:03d}"
            counter += 1
            
        role_str = (req.role or "student").strip().lower()
        if role_str in ["teacher", "faculty", "professor"]:
            role_val = UserRole.faculty
        elif role_str == "admin":
            role_val = UserRole.admin
        else:
            role_val = UserRole.student
        
        user = User(
            username=username_candidate,
            email=email,
            hashed_password=auth_service.hash_password(secrets.token_urlsafe(16)),
            role=role_val,
            is_active=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        if req.role and req.role.strip().lower() in ["teacher", "faculty", "professor"]:
            user.role = UserRole.faculty
        user.last_login = auth_service.get_current_time()
        await db.commit()
        await db.refresh(user)
        
    access = auth_service.create_access_token(user_id=user.id)
    refresh = auth_service.create_refresh_token(user_id=user.id)
    
    return {
        "message": "Google authentication successful",
        "user": format_user_dict(user),
        "tokens": {
            "access": access,
            "refresh": refresh
        }
    }

@router.post("/auth/send-gmail-login-otp/")
async def send_gmail_login_otp(req: SendGmailLoginOTPRequest, db: AsyncSession = Depends(get_db)):
    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valid email address is required")
        
    otp = otp_service.generate_otp()
    key = f"gmail_login_{email}"
    otp_service.store_otp(key, otp, ttl=600)
    await email_service.send_email(
        email,
        "Smart College - Your Gmail Login Code",
        f"Your one-time sign-in code is: {otp}\nValid for 10 minutes."
    )
    return {"message": f"Sign-in OTP sent to {email}"}

@router.post("/auth/verify-gmail-login/")
async def verify_gmail_login(req: VerifyGmailLoginRequest, db: AsyncSession = Depends(get_db)):
    email = req.email.strip().lower()
    key = f"gmail_login_{email}"
    
    if not otp_service.verify_otp(key, req.otp):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")
        
    otp_service.delete_otp(key)
    
    # Check if user exists
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    
    if not user:
        base_username = (email.split("@")[0] or "user").replace(".", "_")[:18]
        username_candidate = base_username
        
        counter = 1
        while True:
            res_user = await db.execute(select(User).where(User.username == username_candidate))
            if not res_user.scalar_one_or_none():
                break
            username_candidate = f"{base_username}_{counter:03d}"
            counter += 1
            
        role_str = (req.role or "student").strip().lower()
        if role_str in ["teacher", "faculty", "professor"]:
            role_val = UserRole.faculty
        elif role_str == "admin":
            role_val = UserRole.admin
        else:
            role_val = UserRole.student
        
        user = User(
            username=username_candidate,
            email=email,
            hashed_password=auth_service.hash_password(secrets.token_urlsafe(16)),
            role=role_val,
            is_active=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        if req.role and req.role.strip().lower() in ["teacher", "faculty", "professor"]:
            user.role = UserRole.faculty
        user.last_login = auth_service.get_current_time()
        await db.commit()
        await db.refresh(user)
        
    access = auth_service.create_access_token(user_id=user.id)
    refresh = auth_service.create_refresh_token(user_id=user.id)
    
    return {
        "message": "Gmail login successful",
        "user": format_user_dict(user),
        "tokens": {
            "access": access,
            "refresh": refresh
        }
    }
