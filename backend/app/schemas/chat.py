from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class AnonRoomResponse(BaseModel):
    id: int
    subject_id: int
    subject_name: str
    subject_code: str
    last_message: Optional[str] = None
    last_time: Optional[datetime] = None
    message_count: int
    model_config = ConfigDict(from_attributes=True)

class AnonMessageResponse(BaseModel):
    id: int
    sender_alias: str
    content: str
    is_faculty: bool
    is_me: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class SendMessageRequest(BaseModel):
    content: str

class GenAIRequest(BaseModel):
    question: str

class GenAIResponse(BaseModel):
    answer: str

class RAGChatRequest(BaseModel):
    question: str
    subject_id: str

class RAGUploadRequest(BaseModel):
    subject_id: str
