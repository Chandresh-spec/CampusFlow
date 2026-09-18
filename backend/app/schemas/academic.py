from typing import Optional
from pydantic import BaseModel, ConfigDict

class SemesterResponse(BaseModel):
    id: int
    sem_nmbr: int
    model_config = ConfigDict(from_attributes=True)

class FacultyResponse(BaseModel):
    id: Optional[int] = None
    username: Optional[str] = None
    email: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class SubjectResponse(BaseModel):
    id: int
    sub_code: str
    sub_name: str
    sem: Optional[SemesterResponse] = None
    faculty: Optional[FacultyResponse] = None
    model_config = ConfigDict(from_attributes=True)

class SubjectCreateRequest(BaseModel):
    sub_code: str
    sub_name: str
    sem_id: Optional[int] = None
    faculty_id: Optional[int] = None
    sem: Optional[int] = None
    faculty: Optional[int] = None

    def model_post_init(self, __context):
        if self.sem_id is None and self.sem is not None:
            self.sem_id = self.sem
        if self.faculty_id is None and self.faculty is not None:
            self.faculty_id = self.faculty

class SubjectUpdateRequest(BaseModel):
    sub_code: Optional[str] = None
    sub_name: Optional[str] = None
    sem_id: Optional[int] = None
    faculty_id: Optional[int] = None
    sem: Optional[int] = None
    faculty: Optional[int] = None

    def model_post_init(self, __context):
        if self.sem_id is None and self.sem is not None:
            self.sem_id = self.sem
        if self.faculty_id is None and self.faculty is not None:
            self.faculty_id = self.faculty

SubjectCreate = SubjectCreateRequest
SubjectUpdate = SubjectUpdateRequest
