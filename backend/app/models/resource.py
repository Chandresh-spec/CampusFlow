"""
Resource models — Resource and ResourceDownload.
Files are stored in S3 (s3_key / s3_url). Local file field is removed.
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, BigInteger,
    ForeignKey, UniqueConstraint, Enum as SAEnum,
)
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class FileType(str, enum.Enum):
    PDF = "PDF"
    PPT = "PPT"
    DOC = "DOC"
    IMG = "IMG"


class ResourceStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, default="")

    # S3 storage (replaces Django FileField)
    s3_key = Column(String(500), nullable=True)      # e.g. "resources/abc123.pdf"
    s3_url = Column(String(1000), nullable=True)      # public or presigned URL
    reference_url = Column(String(500), nullable=True)

    file_type = Column(SAEnum(FileType), nullable=False)
    file_size = Column(BigInteger, nullable=True)      # bytes

    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    uploaded_by_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    status = Column(SAEnum(ResourceStatus), default=ResourceStatus.PENDING, nullable=False)
    is_official = Column(Boolean, default=False)
    view_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    subject = relationship("Subject", back_populates="resources")
    uploaded_by = relationship("User", lazy="joined")
    downloads = relationship("ResourceDownload", back_populates="resource", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Resource {self.title} ({self.status})>"


class ResourceDownload(Base):
    __tablename__ = "resource_downloads"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    resource_id = Column(Integer, ForeignKey("resources.id", ondelete="CASCADE"), nullable=False)
    downloaded_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("User")
    resource = relationship("Resource", back_populates="downloads")

    __table_args__ = (
        UniqueConstraint("student_id", "resource_id", name="uq_student_resource_download"),
    )
