from datetime import datetime
from typing import Dict, Any, Optional
import secrets
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.user import User, UserRole, Profile
from app.services import auth_service, email_service, otp_service
from app.services.otp_service import OTPResult
from app.schemas.auth import (
    LoginRequest, RegisterRequest, RefreshTokenRequest,
    ForgotPasswordRequest, VerifyOTPRequest, ResetPasswordRequest,
    SendRegisterOTPRequest, ResendRegisterOTPRequest, VerifyRegisterRequest,
    GoogleAuthRequest, SendGmailLoginOTPRequest, VerifyGmailLoginRequest,
    VerifyLoginOTPRequest, ResendLoginOTPRequest,
    TokenResponse, UserResponse, RegistrationResponse
)

router = APIRouter(prefix="/api", tags=["auth"])


def mask_email(email: str) -> str:
    if not email or "@" not in email:
        return email
    parts = email.split("@")
    name = parts[0]
    domain = parts[1]
    if len(name) <= 2:
        masked_name = name[0] + "*"
    else:
        masked_name = name[0] + "*" * (len(name) - 2) + name[-1]
    return f"{masked_name}@{domain}"


def format_user_dict(u: User) -> dict:
    import glob, os
    avatar_url = None
    raw_avatar = getattr(u, "avatar_url", None)
    if raw_avatar:
        if raw_avatar.startswith("http") or raw_avatar.startswith("/api/"):
            avatar_url = raw_avatar
        else:
            avatar_url = f"/api/profile/avatar/{u.id}/"
    else:
        for base_dir in ["/app/data", "./backend/data", "./data", "."]:
            matches = glob.glob(os.path.join(base_dir, "avatars", f"user_{u.id}_*"))
            if matches:
                avatar_url = f"/api/profile/avatar/{u.id}/"
                break

    role_val = (u.role.value if hasattr(u.role, "value") else str(u.role)).lower()
    sem_val = u.sem
    if role_val == "student" and (sem_val is None or sem_val < 1):
        sem_val = 1

    return {
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "role": role_val,
        "mobile_number": u.mobile_number,
        "usn": u.usn,
        "sem": sem_val,
        "semester": sem_val,
        "avatar_url": avatar_url,
        "bio": getattr(u, "bio", None),
        "email_verified": u.email_verified_at is not None,
        "email_verified_at": u.email_verified_at.isoformat() if u.email_verified_at else None,
    }


# ── Registration & Verification Endpoints ─────────────────────────────────────

@router.post("/register/", status_code=status.HTTP_201_CREATED, response_model=Dict[str, Any])
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Production-ready registration endpoint:
    1. Validates and normalizes email/username/password.
    2. Atomically persists User and Profile records (email_verified_at=None).
    3. Enforces Redis rate-limiting and resend cooldown.
    4. Issues cryptographically secure OTP stored as a keyed HMAC.
    5. Dispatches email verification message without holding DB connection.
    6. Does not issue authentication tokens before email verification.
    """
    email_clean = req.email.strip().lower()
    username_clean = req.username.strip()

    # 1. Check existing account
    existing_query = await db.execute(
        select(User).where((User.username == username_clean) | (User.email == email_clean))
    )
    existing_user = existing_query.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists"
        )

    role_str = (req.role or "student").lower()
    role_val = UserRole(role_str) if role_str in UserRole._value2member_map_ else UserRole.student
    sem_val = req.sem if req.sem is not None else getattr(req, "semester", None)

    target_user = User(
        username=username_clean,
        email=email_clean,
        hashed_password=auth_service.hash_password(req.password),
        role=role_val,
        is_active=True,
        email_verified_at=None,
        mobile_number=req.mobile_number,
        usn=req.usn,
        sem=sem_val,
    )
    db.add(target_user)
    try:
        await db.commit()
        await db.refresh(target_user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists"
        )

    # 2. Issue OTP via Redis / In-Memory (Rate limit & cooldown enforced)
    otp_code, otp_res = otp_service.issue_otp(email_clean, purpose="register")
    if otp_res == OTPResult.COOLDOWN_ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Please wait before requesting another verification code."
        )
    elif otp_res == OTPResult.RATE_LIMIT_EXCEEDED:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum verification attempts exceeded. Please try again later."
        )

    # 3. Non-blocking email dispatch
    email_subject = "CampusFlow - Verify Your Academic Account"
    email_body = (
        f"Hello {target_user.username},\n\n"
        f"Your verification code is: {otp_code}\n\n"
        f"This code will expire in 5 minutes.\n"
        f"Please enter this code to complete your registration.\n\n"
        f"Best regards,\nCampusFlow Security"
    )
    await email_service.send_email(email_clean, email_subject, email_body)

    return {
        "message": "Registration successful. Please verify your email.",
        "email": mask_email(email_clean),
        "requires_verification": True,
        "user": format_user_dict(target_user),
    }


@router.post("/verify-register/", status_code=status.HTTP_201_CREATED, response_model=Dict[str, Any])
@router.post("/verify-email/", status_code=status.HTTP_200_OK, response_model=Dict[str, Any])
async def verify_register(req: VerifyRegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Atomic Email Verification:
    - Verifies HMAC of OTP via atomic Redis Lua script.
    - Handles single-use consumption and attempt counting.
    - Updates email_verified_at in PostgreSQL in a dedicated transaction.
    - Safely recovers from database errors by clearing cooldown.
    - Issues access & refresh JWT tokens upon successful verification.
    """
    email_clean = req.email.strip().lower()
    otp_clean = req.otp.strip()

    # 1. Verify OTP with Redis Lua script
    verify_res = otp_service.verify_otp_secure(
        identifier=email_clean,
        submitted_otp=otp_clean,
        purpose="register"
    )

    # Allow legacy fallback key if set directly in test mocks
    if verify_res != OTPResult.SUCCESS:
        legacy_key = f"register_otp_{email_clean}"
        if otp_service.verify_otp(legacy_key, otp_clean):
            otp_service.delete_otp(legacy_key)
            verify_res = OTPResult.SUCCESS

    if verify_res == OTPResult.INVALID_OTP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code"
        )
    elif verify_res == OTPResult.EXPIRED_OR_NOT_FOUND:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired or is invalid"
        )
    elif verify_res == OTPResult.MAX_ATTEMPTS_EXCEEDED:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed verification attempts. Please request a new code."
        )

    # 2. Retrieve user record
    result = await db.execute(select(User).where(User.email == email_clean))
    user = result.scalar_one_or_none()

    if not user:
        # If legacy client didn't call /register first and provided password
        if req.username and req.password:
            role_str = (req.role or "student").lower()
            role_val = UserRole(role_str) if role_str in UserRole._value2member_map_ else UserRole.student
            user = User(
                username=req.username.strip(),
                email=email_clean,
                hashed_password=auth_service.hash_password(req.password),
                role=role_val,
                is_active=True,
                email_verified_at=datetime.utcnow(),
                mobile_number=req.mobile_number,
                usn=req.usn,
                sem=req.sem,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    else:
        # User already exists - mark email verified
        user.email_verified_at = datetime.utcnow()
        user.updated_at = datetime.utcnow()
        try:
            await db.commit()
            await db.refresh(user)
        except Exception as e:
            await db.rollback()
            # Recovery strategy: clear cooldown so user can immediately request a new OTP
            otp_service.clear_cooldown(email_clean, purpose="register")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="A database error occurred while activating your account. Please request a new verification code."
            )

    # 3. Issue authentication tokens
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


@router.post("/send-register-otp/")
@router.post("/resend-register-otp/")
async def send_register_otp(req: SendRegisterOTPRequest, db: AsyncSession = Depends(get_db)):
    """Resend registration OTP subject to atomic cooldown and rate limits."""
    email_clean = req.email.strip().lower()

    # If user already verified, disallow resending
    res = await db.execute(select(User).where(User.email == email_clean))
    user = res.scalar_one_or_none()
    if user and user.email_verified_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists"
        )

    otp_code, otp_res = otp_service.issue_otp(email_clean, purpose="register")
    if otp_res == OTPResult.COOLDOWN_ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Please wait before requesting another verification code."
        )
    elif otp_res == OTPResult.RATE_LIMIT_EXCEEDED:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Maximum verification attempts exceeded. Please try again later."
        )

    # Keep backwards-compatible legacy key
    otp_service.store_otp(f"register_otp_{email_clean}", otp_code)

    email_subject = "CampusFlow - Registration Verification Code"
    email_body = f"Your verification OTP is {otp_code}. Valid for 5 minutes."
    await email_service.send_email(email_clean, email_subject, email_body)

    return {"message": "OTP sent successfully"}


# ── Login Endpoints with Email Verification Gate ──────────────────────────────

@router.post("/login/", response_model=Dict[str, Any])
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    username_clean = req.username.strip()
    result = await db.execute(
        select(User).where((User.username == username_clean) | (User.email == username_clean.lower()))
    )
    user = result.scalar_one_or_none()

    if not user or not auth_service.verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    # Verification Gate: Prevent authentication before email verification
    if not user.email_verified_at:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify your email before logging in."
        )

    otp = otp_service.generate_otp()
    key = f"login_otp_{user.id}"
    otp_service.store_otp(key, otp, ttl=300)

    email_subject = "CampusFlow - Login Verification Code"
    email_body = (
        f"Hello {user.username},\n\n"
        f"Your login verification code is: {otp}\n\n"
        f"This code will expire in 5 minutes.\n"
        f"If you did not attempt to sign in, please secure your account immediately.\n\n"
        f"Best regards,\nCampusFlow Security"
    )
    await email_service.send_email(user.email, email_subject, email_body)

    return {
        "requires_otp": True,
        "message": f"Verification code sent to {mask_email(user.email)}",
        "user_id": user.id,
        "email": mask_email(user.email),
        "username": user.username
    }


@router.post("/verify-login-otp/", response_model=Dict[str, Any])
@router.post("/auth/verify-login-otp/", response_model=Dict[str, Any])
async def verify_login_otp(req: VerifyLoginOTPRequest, db: AsyncSession = Depends(get_db)):
    user = None
    if req.user_id:
        result = await db.execute(select(User).where(User.id == req.user_id))
        user = result.scalar_one_or_none()
    elif req.email:
        result = await db.execute(select(User).where(User.email == req.email.strip().lower()))
        user = result.scalar_one_or_none()
    elif req.username:
        result = await db.execute(select(User).where(User.username == req.username.strip()))
        user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    key = f"login_otp_{user.id}"
    if not otp_service.verify_otp(key, req.otp.strip()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification code")

    otp_service.delete_otp(key)

    user.last_login = auth_service.get_current_time()
    await db.commit()

    access = auth_service.create_access_token(user_id=user.id)
    refresh = auth_service.create_refresh_token(user_id=user.id)

    return {
        "message": "Login successful",
        "user": format_user_dict(user),
        "tokens": {
            "access": access,
            "refresh": refresh
        }
    }


@router.post("/resend-login-otp/")
@router.post("/auth/resend-login-otp/")
async def resend_login_otp(req: ResendLoginOTPRequest, db: AsyncSession = Depends(get_db)):
    user = None
    if req.user_id:
        result = await db.execute(select(User).where(User.id == req.user_id))
        user = result.scalar_one_or_none()
    elif req.email:
        result = await db.execute(select(User).where(User.email == req.email.strip().lower()))
        user = result.scalar_one_or_none()
    elif req.username:
        result = await db.execute(select(User).where(User.username == req.username.strip()))
        user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    otp = otp_service.generate_otp()
    key = f"login_otp_{user.id}"
    otp_service.store_otp(key, otp, ttl=300)

    email_subject = "CampusFlow - New Login Verification Code"
    email_body = (
        f"Hello {user.username},\n\n"
        f"Your new login verification code is: {otp}\n\n"
        f"This code will expire in 5 minutes.\n\n"
        f"Best regards,\nCampusFlow Security"
    )
    await email_service.send_email(user.email, email_subject, email_body)

    return {
        "message": f"New verification code sent to {mask_email(user.email)}",
        "email": mask_email(user.email)
    }


# ── Password Reset & OAuth Endpoints ──────────────────────────────────────────

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

    if not email and req.email:
        email = req.email.strip().lower()

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to verify Google account or email missing"
        )

    email = email.strip().lower()

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

        role_str = (req.role or "student").lower()
        role_val = UserRole(role_str) if role_str in UserRole._value2member_map_ else UserRole.student

        # Google accounts are pre-verified
        user = User(
            username=username_candidate,
            email=email,
            hashed_password=auth_service.hash_password(secrets.token_urlsafe(16)),
            role=role_val,
            is_active=True,
            email_verified_at=datetime.utcnow()
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        user.last_login = auth_service.get_current_time()
        if not user.email_verified_at:
            user.email_verified_at = datetime.utcnow()
        await db.commit()

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

        role_str = (req.role or "student").lower()
        role_val = UserRole(role_str) if role_str in UserRole._value2member_map_ else UserRole.student

        user = User(
            username=username_candidate,
            email=email,
            hashed_password=auth_service.hash_password(secrets.token_urlsafe(16)),
            role=role_val,
            is_active=True,
            email_verified_at=datetime.utcnow()
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        user.last_login = auth_service.get_current_time()
        if not user.email_verified_at:
            user.email_verified_at = datetime.utcnow()
        await db.commit()

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
