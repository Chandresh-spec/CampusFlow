from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class NoticeResponse(BaseModel):
    id: int
    title: str
    content: str
    posted_by: str
    semester: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class NoticeCreateRequest(BaseModel):
    title: str
    content: str
    semester: Optional[int] = None

class NoticeUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    semester: Optional[int] = None

NoticeCreate = NoticeCreateRequest
NoticeUpdate = NoticeUpdateRequest
