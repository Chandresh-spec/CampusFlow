from typing import Optional, Union
from datetime import datetime
from pydantic import BaseModel, ConfigDict, model_validator

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
    question: Optional[str] = None
    prompt: Optional[str] = None
    session_id: Optional[int] = None

    @model_validator(mode="after")
    def populate_question(self):
        if not self.question and self.prompt:
            self.question = self.prompt
        if not self.question:
            self.question = ""
        return self

class GenAIResponse(BaseModel):
    answer: str
    response: Optional[str] = None
    session_id: Optional[int] = None

    @model_validator(mode="after")
    def populate_response(self):
        if not self.response:
            self.response = self.answer
        return self

class RAGChatRequest(BaseModel):
    question: Optional[str] = None
    prompt: Optional[str] = None
    subject_id: Optional[Union[str, int]] = "1"
    session_id: Optional[int] = None

    @model_validator(mode="after")
    def populate_fields(self):
        if not self.question and self.prompt:
            self.question = self.prompt
        if not self.question:
            self.question = ""
        if self.subject_id is not None:
            self.subject_id = str(self.subject_id)
        else:
            self.subject_id = "1"
        return self

class RAGUploadRequest(BaseModel):
    subject_id: Optional[Union[str, int]] = "1"


class AIChatMessageSchema(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AIChatSessionSchema(BaseModel):
    id: int
    title: str
    mode: str
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    message_count: int = 0
    updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class AIChatSessionDetailSchema(BaseModel):
    id: int
    title: str
    mode: str
    subject_id: Optional[int] = None
    subject_name: Optional[str] = None
    messages: list[AIChatMessageSchema] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class CreateSessionRequest(BaseModel):
    title: Optional[str] = "New Chat"
    mode: Optional[str] = "genai"
    subject_id: Optional[int] = None

