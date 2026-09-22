"""
SQLAlchemy async engine and session factory.
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()

import os

connect_args = {}
engine_kwargs = {"echo": False}

if "sqlite" in settings.DATABASE_URL:
    connect_args["check_same_thread"] = False
    try:
        db_path = settings.DATABASE_URL.split(":///")[-1]
        if db_path and os.path.dirname(db_path):
            os.makedirs(os.path.dirname(db_path), exist_ok=True)
    except Exception:
        pass
else:
    engine_kwargs.update({
        "pool_size": 20,
        "max_overflow": 10,
        "pool_pre_ping": True,
    })

engine = create_async_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    **engine_kwargs
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


async def get_db():
    """FastAPI dependency that yields a DB session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables and seed initial academic data if missing."""
    import app.models.user  # noqa: F401
    import app.models.academic  # noqa: F401
    import app.models.resource  # noqa: F401
    import app.models.notice  # noqa: F401
    import app.models.chat  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_factory() as session:
        try:
            from app.models.academic import Sem, Subject
            from sqlalchemy import select

            sem_res = await session.execute(select(Sem))
            if not sem_res.scalars().first():
                for sem_num in range(1, 9):
                    session.add(Sem(sem_nmbr=sem_num))
                await session.commit()

                sem_res = await session.execute(select(Sem))
                all_sems = {s.sem_nmbr: s.id for s in sem_res.scalars().all()}

                default_subjects = [
                    # Sem 1
                    ("MATH101", "Engineering Mathematics I", 1),
                    ("PHY101", "Engineering Physics", 1),
                    ("CS101", "Python Programming", 1),
                    ("ENG101", "Technical English", 1),
                    # Sem 2
                    ("MATH201", "Engineering Mathematics II", 2),
                    ("CHE201", "Engineering Chemistry", 2),
                    ("CS201", "Data Structures and Algorithms", 2),
                    ("EE201", "Basic Electrical & Electronics", 2),
                    # Sem 3
                    ("CS301", "Object Oriented Programming (Java)", 3),
                    ("CS302", "Computer Organization & Architecture", 3),
                    ("CS303", "Discrete Mathematics", 3),
                    ("CS304", "Digital Logic Design", 3),
                    # Sem 4
                    ("CS401", "Design & Analysis of Algorithms", 4),
                    ("CS402", "Operating Systems", 4),
                    ("CS403", "Database Management Systems", 4),
                    ("CS404", "Theory of Computation", 4),
                    # Sem 5
                    ("CS501", "Computer Networks", 5),
                    ("CS502", "Software Engineering", 5),
                    ("CS503", "Web Technologies & Applications", 5),
                    ("CS504", "Artificial Intelligence", 5),
                    # Sem 6
                    ("CS601", "Machine Learning", 6),
                    ("CS602", "Cloud Computing", 6),
                    ("CS603", "Information & Cyber Security", 6),
                    ("CS604", "Compiler Design", 6),
                    # Sem 7
                    ("CS701", "Big Data Analytics", 7),
                    ("CS702", "Internet of Things (IoT)", 7),
                    ("CS703", "Mobile Application Development", 7),
                    # Sem 8
                    ("CS801", "Deep Learning & Neural Networks", 8),
                    ("CS802", "Major Project & Dissertation", 8),
                ]
                for code, name, sem_num in default_subjects:
                    sub = Subject(sub_code=code, sub_name=name, sem_id=all_sems[sem_num])
                    session.add(sub)
                await session.commit()
                print("[DB] Initial Semesters (1-8) and core Subjects successfully seeded.")
        except Exception as e:
            print(f"[DB] Note on seed: {e}")
