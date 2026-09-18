"""
Notice models — Notice and NoticeDismiss.
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.database import Base


class Notice(Base):
    __tablename__ = "notices"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, default="")
    posted_by_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    semester = Column(Integer, nullable=True)  # null = all semesters
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    posted_by = relationship("User", lazy="joined")
    dismissals = relationship("NoticeDismiss", back_populates="notice", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Notice {self.title}>"


class NoticeDismiss(Base):
    __tablename__ = "notice_dismissals"

    id = Column(Integer, primary_key=True, index=True)
    notice_id = Column(Integer, ForeignKey("notices.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    dismissed_at = Column(DateTime, default=datetime.utcnow)

    notice = relationship("Notice", back_populates="dismissals")
    student = relationship("User")

    __table_args__ = (
        UniqueConstraint("notice_id", "student_id", name="uq_notice_student_dismiss"),
    )
