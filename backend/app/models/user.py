"""
User and Profile models — normalized 1-to-1 relationship.
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SAEnum,
)
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
from app.database import Base
import enum


class UserRole(str, enum.Enum):
    student = "student"
    faculty = "faculty"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(150), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.student, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    email_verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)

    # 1-to-1 relationship with Profile
    profile = relationship(
        "Profile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        lazy="joined"
    )

    def __init__(self, **kwargs):
        profile_fields = {"mobile_number", "usn", "sem", "avatar_url", "bio"}
        p_kwargs = {k: kwargs.pop(k) for k in profile_fields if k in kwargs}
        super().__init__(**kwargs)
        if p_kwargs:
            if self.profile is None:
                self.profile = Profile(**p_kwargs)
            else:
                for k, v in p_kwargs.items():
                    setattr(self.profile, k, v)

    # Backward compatibility property accessors delegating to Profile
    @hybrid_property
    def mobile_number(self):
        return self.profile.mobile_number if self.profile else None

    @mobile_number.setter
    def mobile_number(self, val):
        if not self.profile:
            self.profile = Profile(user=self)
        self.profile.mobile_number = val

    @hybrid_property
    def usn(self):
        return self.profile.usn if self.profile else None

    @usn.setter
    def usn(self, val):
        if not self.profile:
            self.profile = Profile(user=self)
        self.profile.usn = val

    @hybrid_property
    def sem(self):
        return self.profile.sem if self.profile else None

    @sem.setter
    def sem(self, val):
        if not self.profile:
            self.profile = Profile(user=self)
        self.profile.sem = val

    @hybrid_property
    def avatar_url(self):
        return self.profile.avatar_url if self.profile else None

    @avatar_url.setter
    def avatar_url(self, val):
        if not self.profile:
            self.profile = Profile(user=self)
        self.profile.avatar_url = val

    @hybrid_property
    def bio(self):
        return self.profile.bio if self.profile else None

    @bio.setter
    def bio(self, val):
        if not self.profile:
            self.profile = Profile(user=self)
        self.profile.bio = val

    def __repr__(self) -> str:
        return f"<User {self.username} ({self.role})>"


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True
    )
    mobile_number = Column(String(15), nullable=True)
    usn = Column(String(20), unique=True, nullable=True, index=True)
    sem = Column(Integer, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    bio = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="profile")

    def __repr__(self) -> str:
        return f"<Profile user_id={self.user_id} usn={self.usn}>"
