import re
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator
from .user import UserResponse

class LoginRequest(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def clean_username(cls, v: str) -> str:
        return v.strip()

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    role: str = "student"
    mobile_number: Optional[str] = None
    usn: Optional[str] = None
    sem: Optional[int] = None
    semester: Optional[int] = None

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 3:
            raise ValueError("Username must be at least 3 characters long")
        if not re.match(r"^[a-zA-Z0-9_-]+$", cleaned):
            raise ValueError("Username can only contain alphanumeric characters, underscores, and hyphens")
        return cleaned

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", cleaned):
            raise ValueError("Invalid email format")
        return cleaned

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v

class TokenResponse(BaseModel):
    access: str
    refresh: str

class AuthResponse(BaseModel):
    message: str
    user: UserResponse
    tokens: TokenResponse
    model_config = ConfigDict(from_attributes=True)

class RegistrationResponse(BaseModel):
    message: str
    email: str
    requires_verification: bool = True
    user: Optional[UserResponse] = None
    model_config = ConfigDict(from_attributes=True)

class ForgotPasswordRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        return v.strip().lower()

class VerifyOTPRequest(BaseModel):
    email: str
    otp: str

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("otp")
    @classmethod
    def clean_otp(cls, v: str) -> str:
        return v.strip()

class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        return v.strip().lower()

class SendRegisterOTPRequest(BaseModel):
    email: str
    username: Optional[str] = None

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        return v.strip().lower()

class ResendRegisterOTPRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        return v.strip().lower()

class VerifyRegisterRequest(BaseModel):
    email: str
    otp: str
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = "student"
    mobile_number: Optional[str] = None
    usn: Optional[str] = None
    sem: Optional[int] = None

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("otp")
    @classmethod
    def clean_otp(cls, v: str) -> str:
        return v.strip()

class RefreshTokenRequest(BaseModel):
    refresh: str

class RefreshTokenResponse(BaseModel):
    access: str
    refresh: Optional[str] = None

class GoogleAuthRequest(BaseModel):
    credential: Optional[str] = None
    access_token: Optional[str] = None
    id_token: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = "student"

class SendGmailLoginOTPRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        return v.strip().lower()

class VerifyGmailLoginRequest(BaseModel):
    email: str
    otp: str
    role: Optional[str] = "student"

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("otp")
    @classmethod
    def clean_otp(cls, v: str) -> str:
        return v.strip()

class VerifyLoginOTPRequest(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None
    username: Optional[str] = None
    otp: str

    @field_validator("otp")
    @classmethod
    def clean_otp(cls, v: str) -> str:
        return v.strip()

class ResendLoginOTPRequest(BaseModel):
    user_id: Optional[int] = None
    email: Optional[str] = None
    username: Optional[str] = None
