from typing import Optional, List, Any, Union
from datetime import datetime
from pydantic import BaseModel, ConfigDict, model_validator
from .academic import SubjectResponse

class ResourceResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    s3_key: Optional[str] = None
    s3_url: Optional[str] = None
    reference_url: Optional[str] = None
    file_type: str
    file_size: Optional[Union[int, str]] = None
    subject: Optional[SubjectResponse] = None
    subject_name: Optional[str] = None
    uploaded_by: Optional[Any] = None
    status: str
    is_official: bool = False
    view_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class ResourceCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    s3_key: Optional[str] = None
    s3_url: Optional[str] = None
    file_type: Optional[str] = "PDF"
    file_size: Optional[Union[int, str]] = None
    subject_id: Optional[int] = None
    subject: Optional[int] = None
    reference_url: Optional[str] = None

    @model_validator(mode="after")
    def populate_subject_id(self):
        if self.subject_id is None and self.subject is not None:
            self.subject_id = self.subject
        return self

class ResourceUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    s3_key: Optional[str] = None
    s3_url: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[Union[int, str]] = None
    subject_id: Optional[int] = None
    reference_url: Optional[str] = None

class PresignUploadRequest(BaseModel):
    filename: Optional[str] = None
    file_name: Optional[str] = None
    content_type: Optional[str] = None
    file_type: Optional[str] = None
    folder: Optional[str] = "resources"

    @model_validator(mode="after")
    def normalize_fields(self):
        if not self.filename and self.file_name:
            self.filename = self.file_name
        if not self.content_type and self.file_type:
            self.content_type = self.file_type
        if not self.content_type:
            self.content_type = "application/octet-stream"
        if not self.filename:
            self.filename = "uploaded_file"
        return self

class PresignUploadResponse(BaseModel):
    upload_url: str
    s3_key: str

class FacultyDashboardResponse(BaseModel):
    total_resources: int
    views_today: int
    pending_approvals: int
    active_students: int
    recent_uploads: List[Any]

class StudentDashboardResponse(BaseModel):
    student: Any
    recent_resources: List[Any]
    activity: Any
    resources_by_subject: Any
