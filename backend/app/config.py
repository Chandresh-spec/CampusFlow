"""
Application configuration loaded from environment variables.
"""

from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── JWT ──────────────────────────────────────────
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 50
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Database (PostgreSQL / SQLite) ───────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./smart_college.db"

    # ── Redis (OTP & Cache) ──────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── AWS S3 ───────────────────────────────────────
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-southeast-2"
    S3_BUCKET_NAME: str = ""

    # ── AWS SQS ──────────────────────────────────────
    SQS_QUEUE_URL: str = ""

    # ── Email (SMTP) ─────────────────────────────────
    EMAIL_HOST_USER: str = ""
    EMAIL_HOST_PASSWORD: str = ""
    DEFAULT_FROM_EMAIL: str = ""

    # ── OTP & Registration Abuse Protection ───────────
    OTP_SECRET_KEY: str = ""
    OTP_EXPIRE_SECONDS: int = 300
    OTP_RESEND_COOLDOWN_SECONDS: int = 60
    OTP_MAX_SENDS_PER_WINDOW: int = 5
    OTP_RATE_LIMIT_WINDOW_SECONDS: int = 3600
    OTP_MAX_VERIFY_ATTEMPTS: int = 5
    OTP_ATTEMPT_LOCKOUT_SECONDS: int = 900

    # ── AI Providers (Groq = Blazing Fast <0.4s, Gemini = Fast <1s, OpenRouter, HuggingFace) ──
    GROQ_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    HUGGINGFACE_API_KEY: str = ""

    # ── CORS ─────────────────────────────────────────
    FRONTEND_URL: str = "http://localhost:3000"

    # ── Google OAuth ─────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    model_config = {
        "env_file": [str(Path(__file__).resolve().parent.parent / ".env"), ".env"],
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
