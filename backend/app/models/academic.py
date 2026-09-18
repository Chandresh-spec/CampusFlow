"""
Academic models — Sem (semester) and Subject.
"""

from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Sem(Base):
    __tablename__ = "sems"

    id = Column(Integer, primary_key=True, index=True)
    sem_nmbr = Column(Integer, unique=True, nullable=False)

    subjects = relationship("Subject", back_populates="sem", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Sem {self.sem_nmbr}>"


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    sub_code = Column(String(20), unique=True, nullable=False, index=True)
    sub_name = Column(String(100), nullable=False)
    sem_id = Column(Integer, ForeignKey("sems.id", ondelete="CASCADE"), nullable=False)
    faculty_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    sem = relationship("Sem", back_populates="subjects")
    faculty = relationship("User", lazy="joined")
    resources = relationship("Resource", back_populates="subject", cascade="all, delete-orphan")
    chat_room = relationship("AnonChatRoom", back_populates="subject", uselist=False)

    def __repr__(self) -> str:
        return f"<Subject {self.sub_code}: {self.sub_name}>"
