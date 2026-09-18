from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from .academic import SubjectResponse

class ResourceResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    s3_key: str
    s3_url: str
    reference_url: Optional[str] = None
    file_type: str
    file_size: str
    subject: SubjectResponse
    uploaded_by: str
    status: str
    is_official: bool
    view_count: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ResourceCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    s3_key: str
    file_type: str
    file_size: Optional[str] = None
    subject: int
    reference_url: Optional[str] = None

class ResourceUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    s3_key: Optional[str] = None
    file_type: Optional[str] = None
    reference_url: Optional[str] = None

class PresignUploadRequest(BaseModel):
    filename: str
    content_type: str
    folder: Optional[str] = "resources"

class PresignUploadResponse(BaseModel):
    upload_url: str
    s3_key: str

class FacultyDashboardResponse(BaseModel):
    total_resources: int
    views_today: int
    pending_approvals: int
    active_students: int
    recent_uploads: List[ResourceResponse]

class StudentDashboardResponse(BaseModel):
    student: Any
    recent_resources: List[ResourceResponse]
    activity: Any
    resources_by_subject: Any
