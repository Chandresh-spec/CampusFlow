"""
Import all models here so Alembic and Base.metadata can discover them.
"""

from app.models.user import User, UserRole, Profile
from app.models.academic import Sem, Subject
from app.models.resource import Resource, ResourceDownload, FileType, ResourceStatus
from app.models.notice import Notice, NoticeDismiss
from app.models.chat import AnonChatRoom, AnonMessage, ChatSubject, PDFDocument, AIChatSession, AIChatMessage

__all__ = [
    "User", "UserRole", "Profile",
    "Sem", "Subject",
    "Resource", "ResourceDownload", "FileType", "ResourceStatus",
    "Notice", "NoticeDismiss",
    "AnonChatRoom", "AnonMessage", "ChatSubject", "PDFDocument",
    "AIChatSession", "AIChatMessage",
]
