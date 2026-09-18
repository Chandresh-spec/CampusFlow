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

    @model_validator(mode="after")
    def populate_response(self):
        if not self.response:
            self.response = self.answer
        return self

class RAGChatRequest(BaseModel):
    question: Optional[str] = None
    prompt: Optional[str] = None
    subject_id: Optional[Union[str, int]] = "1"

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
