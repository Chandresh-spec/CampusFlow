"""
Chat models — AnonChatRoom, AnonMessage, ChatSubject, PDFDocument.
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey,
)
from sqlalchemy.orm import relationship
from app.database import Base


class AnonChatRoom(Base):
    __tablename__ = "anon_chat_rooms"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    subject = relationship("Subject", back_populates="chat_room")
    messages = relationship("AnonMessage", back_populates="room", cascade="all, delete-orphan", order_by="AnonMessage.created_at")


class AnonMessage(Base):
    __tablename__ = "anon_messages"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("anon_chat_rooms.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    anon_alias = Column(String(50), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    room = relationship("AnonChatRoom", back_populates="messages")
    sender = relationship("User", lazy="joined")


class ChatSubject(Base):
    """Subject context for RAG PDF uploads (user-created subjects for AI chat)."""
    __tablename__ = "chat_subjects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)

    user = relationship("User")
    documents = relationship("PDFDocument", back_populates="subject", cascade="all, delete-orphan")


class PDFDocument(Base):
    """PDF documents uploaded for RAG processing — stored in S3."""
    __tablename__ = "pdf_documents"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("chat_subjects.id", ondelete="CASCADE"), nullable=False)
    s3_key = Column(String(500), nullable=False)
    original_filename = Column(String(255), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    subject = relationship("ChatSubject", back_populates="documents")
