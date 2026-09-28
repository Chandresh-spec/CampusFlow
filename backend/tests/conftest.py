import os
import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

# Set test environment variables before importing app modules
TEST_DB_FILE = backend_path / "test_smart_college.db"
os.environ["SECRET_KEY"] = "test-secret-key-1234567890-very-secure"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB_FILE}"
os.environ["REDIS_URL"] = ""
os.environ["SQS_QUEUE_URL"] = ""
os.environ["AWS_ACCESS_KEY_ID"] = ""
os.environ["AWS_SECRET_ACCESS_KEY"] = ""
os.environ["S3_BUCKET_NAME"] = "test-bucket"

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

from app.database import Base, get_db
import app.database as app_db
import app.routers.chat as chat_router
from app.main import app
from app.models.user import User, UserRole
from app.models.academic import Sem, Subject
from app.services import auth_service, email_service, s3_service, sqs_service, llm_service

# Create isolated test engine and session factory
test_engine = create_async_engine(
    f"sqlite+aiosqlite:///{TEST_DB_FILE}",
    connect_args={"check_same_thread": False},
    echo=False
)

test_session_factory = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Patch the app's session factories to point to the test database
app_db.engine = test_engine
app_db.async_session_factory = test_session_factory
chat_router.async_session_factory = test_session_factory

async def override_get_db():
    async with test_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_database():
    """Create all tables and seed semesters & core subjects once per test session."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with test_session_factory() as session:
        # Seed semesters 1 to 8
        for sem_num in range(1, 9):
            session.add(Sem(sem_nmbr=sem_num))
        await session.commit()

        # Seed subjects
        sem_res = await session.execute(select(Sem))
        sems = {s.sem_nmbr: s.id for s in sem_res.scalars().all()}

        default_subjects = [
            ("CS101", "Python Programming", 1),
            ("MATH101", "Engineering Mathematics I", 1),
            ("CS201", "Data Structures", 2),
            ("CS301", "Database Systems", 3),
        ]
        for code, name, sem_num in default_subjects:
            session.add(Subject(sub_code=code, sub_name=name, sem_id=sems[sem_num]))
        await session.commit()

    yield

    # Cleanup DB file after session
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass


@pytest_asyncio.fixture
async def db_session():
    """Yield an independent AsyncSession for direct DB assertions or fixtures."""
    async with test_session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def async_client():
    """Async HTTP test client bound to FastAPI app."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        yield client


# ── User Fixtures ──────────────────────────────────────────────

@pytest_asyncio.fixture
async def student_user(db_session: AsyncSession) -> User:
    """Pre-created student in semester 1."""
    res = await db_session.execute(select(User).where(User.username == "test_student"))
    user = res.scalar_one_or_none()
    if not user:
        user = User(
            username="test_student",
            email="student@example.com",
            hashed_password=auth_service.hash_password("Secret123!"),
            role=UserRole.student,
            sem=1,
            usn="1MS21CS001",
            mobile_number="9876543210",
            is_active=True
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def student_sem2_user(db_session: AsyncSession) -> User:
    """Pre-created student in semester 2 (for semester isolation tests)."""
    res = await db_session.execute(select(User).where(User.username == "test_student_sem2"))
    user = res.scalar_one_or_none()
    if not user:
        user = User(
            username="test_student_sem2",
            email="student_sem2@example.com",
            hashed_password=auth_service.hash_password("Secret123!"),
            role=UserRole.student,
            sem=2,
            usn="1MS21CS002",
            mobile_number="9876543211",
            is_active=True
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def faculty_user(db_session: AsyncSession) -> User:
    """Pre-created faculty member."""
    res = await db_session.execute(select(User).where(User.username == "test_faculty"))
    user = res.scalar_one_or_none()
    if not user:
        user = User(
            username="test_faculty",
            email="faculty@example.com",
            hashed_password=auth_service.hash_password("Faculty123!"),
            role=UserRole.faculty,
            mobile_number="9876543212",
            is_active=True
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Pre-created admin user."""
    res = await db_session.execute(select(User).where(User.username == "test_admin"))
    user = res.scalar_one_or_none()
    if not user:
        user = User(
            username="test_admin",
            email="admin@example.com",
            hashed_password=auth_service.hash_password("Admin123!"),
            role=UserRole.admin,
            mobile_number="9876543213",
            is_active=True
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
    return user


# ── Tokens and Auth Headers Fixtures ──────────────────────────

@pytest.fixture
def student_token(student_user: User) -> str:
    return auth_service.create_access_token(user_id=student_user.id)


@pytest.fixture
def student_headers(student_token: str) -> dict:
    return {"Authorization": f"Bearer {student_token}"}


@pytest.fixture
def student_sem2_token(student_sem2_user: User) -> str:
    return auth_service.create_access_token(user_id=student_sem2_user.id)


@pytest.fixture
def student_sem2_headers(student_sem2_token: str) -> dict:
    return {"Authorization": f"Bearer {student_sem2_token}"}


@pytest.fixture
def faculty_token(faculty_user: User) -> str:
    return auth_service.create_access_token(user_id=faculty_user.id)


@pytest.fixture
def faculty_headers(faculty_token: str) -> dict:
    return {"Authorization": f"Bearer {faculty_token}"}


@pytest.fixture
def admin_token(admin_user: User) -> str:
    return auth_service.create_access_token(user_id=admin_user.id)


@pytest.fixture
def admin_headers(admin_token: str) -> dict:
    return {"Authorization": f"Bearer {admin_token}"}


# ── External Services Mocks ───────────────────────────────────

@pytest.fixture(autouse=True)
def mock_external_services(monkeypatch):
    """Automatically mock external third-party network calls during tests."""
    sent_emails = []

    async def fake_send_email(to: str, subject: str, body: str):
        sent_emails.append({"to": to, "subject": subject, "body": body})
        return True

    async def fake_upload_file_bytes(s3_key: str, file_bytes: bytes, content_type: str = "application/octet-stream"):
        return s3_key

    async def fake_generate_presigned_download_url(s3_key: str, expires_in: int = 86400):
        return f"https://mock-s3.amazonaws.com/{s3_key}?presigned=true"

    async def fake_generate_presigned_upload_url(s3_key: str, content_type: str, expires_in: int = 3600):
        return f"https://mock-s3.amazonaws.com/{s3_key}?upload=true"

    async def fake_delete_object(s3_key: str):
        import glob
        for base_dir in ["/app/data", "./backend/data", "./data", ".", "data"]:
            local_path = os.path.join(base_dir, s3_key)
            if os.path.exists(local_path):
                try:
                    os.remove(local_path)
                except Exception:
                    pass
            if "avatars/" in s3_key:
                avatars_dir = os.path.join(base_dir, "avatars")
                if os.path.exists(avatars_dir):
                    for match in glob.glob(os.path.join(avatars_dir, "*")):
                        try:
                            os.remove(match)
                        except Exception:
                            pass
        return None

    async def fake_download_file_bytes(s3_key: str):
        return b"%PDF-1.4 Mock PDF binary content"

    async def fake_send_sqs_message(msg: dict):
        return None

    monkeypatch.setattr(email_service, "send_email", fake_send_email)
    monkeypatch.setattr(s3_service, "upload_file_bytes", fake_upload_file_bytes)
    monkeypatch.setattr(s3_service, "generate_presigned_download_url", fake_generate_presigned_download_url)
    monkeypatch.setattr(s3_service, "generate_presigned_upload_url", fake_generate_presigned_upload_url)
    monkeypatch.setattr(s3_service, "delete_object", fake_delete_object)
    monkeypatch.setattr(s3_service, "download_file_bytes", fake_download_file_bytes)
    monkeypatch.setattr(sqs_service, "send_message", fake_send_sqs_message)

    return {"sent_emails": sent_emails}
