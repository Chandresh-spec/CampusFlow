from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    mobile_number: Optional[str] = None
    usn: Optional[str] = None
    sem: Optional[int] = None
    is_verified: Optional[bool] = True
    date_joined: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class UserUpdateRequest(BaseModel):
    email: Optional[str] = None
    mobile_number: Optional[str] = None
    sem: Optional[int] = None
    semester: Optional[int] = None
    role: Optional[str] = None

ProfileUpdateRequest = UserUpdateRequest
