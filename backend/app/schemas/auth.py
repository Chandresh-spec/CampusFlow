from typing import Optional
from pydantic import BaseModel, ConfigDict
from .user import UserResponse

class LoginRequest(BaseModel):
    username: str
    password: str
    role: Optional[str] = None

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    role: str = "student"
    mobile_number: Optional[str] = None
    usn: Optional[str] = None
    sem: Optional[int] = None
    semester: Optional[int] = None

class TokenResponse(BaseModel):
    access: str
    refresh: str

class AuthResponse(BaseModel):
    message: str
    user: UserResponse
    tokens: TokenResponse
    model_config = ConfigDict(from_attributes=True)

class ForgotPasswordRequest(BaseModel):
    email: str

class VerifyOTPRequest(BaseModel):
    email: str
    otp: str

class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str

class SendRegisterOTPRequest(BaseModel):
    email: str
    username: str

class VerifyRegisterRequest(BaseModel):
    email: str
    otp: str
    username: str
    password: str
    role: str
    mobile_number: Optional[str] = None
    usn: Optional[str] = None
    sem: Optional[int] = None

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

class VerifyGmailLoginRequest(BaseModel):
    email: str
    otp: str
    role: Optional[str] = "student"

