"""
Seed initial semesters, sample subjects, and test accounts for local testing.
Run with: python -m app.seed
"""

import asyncio
from sqlalchemy import select
from app.database import async_session_factory, init_db
from app.models.user import User, UserRole
from app.models.academic import Sem, Subject
from app.services.auth_service import hash_password

async def seed_data():
    print(">>> Initializing database tables...")
    await init_db()

    async with async_session_factory() as session:
        # 1. Seed Semesters 1 to 8
        print(">>> Checking semesters...")
        res = await session.execute(select(Sem))
        existing_sems = res.scalars().all()
        if not existing_sems:
            print(">>> Seeding Semesters 1 through 8...")
            sems = [Sem(sem_nmbr=i) for i in range(1, 9)]
            session.add_all(sems)
            await session.commit()
        else:
            print(">>> Semesters already exist.")

        # 2. Seed Faculty and Student Users
        print(">>> Checking test users...")
        faculty_res = await session.execute(select(User).where(User.username == "prof_sharma"))
        faculty = faculty_res.scalar_one_or_none()
        if not faculty:
            print(">>> Creating sample faculty: prof_sharma / password123")
            faculty = User(
                username="prof_sharma",
                email="faculty@college.edu",
                hashed_password=hash_password("password123"),
                role=UserRole.faculty,
                mobile_number="9876543210"
            )
            session.add(faculty)
            await session.commit()
            await session.refresh(faculty)

        student_res = await session.execute(select(User).where(User.username == "rahul"))
        student = student_res.scalar_one_or_none()
        if not student:
            print(">>> Creating sample student: rahul / password123 (Semester 5)")
            student = User(
                username="rahul",
                email="rahul@college.edu",
                hashed_password=hash_password("password123"),
                role=UserRole.student,
                usn="1CR21CS045",
                sem=5,
                mobile_number="9876543211"
            )
            session.add(student)
            await session.commit()
            await session.refresh(student)

        # 3. Seed Sample Subjects
        print(">>> Checking sample subjects...")
        sub_res = await session.execute(select(Subject))
        if not sub_res.scalars().first():
            sem5_res = await session.execute(select(Sem).where(Sem.sem_nmbr == 5))
            sem5 = sem5_res.scalar_one_or_none()
            if sem5 and faculty:
                print(">>> Seeding sample subjects for Semester 5...")
                subjects = [
                    Subject(sub_code="21CS51", sub_name="Database Management Systems", sem_id=sem5.id, faculty_id=faculty.id),
                    Subject(sub_code="21CS52", sub_name="Computer Networks", sem_id=sem5.id, faculty_id=faculty.id),
                    Subject(sub_code="21CS53", sub_name="Theory of Computation", sem_id=sem5.id, faculty_id=faculty.id),
                    Subject(sub_code="21CS54", sub_name="Artificial Intelligence & Machine Learning", sem_id=sem5.id, faculty_id=faculty.id),
                ]
                session.add_all(subjects)
                await session.commit()

    print("=================================================================")
    print(">>> SEEDING COMPLETE!")
    print("Test Faculty: username: prof_sharma | password: password123")
    print("Test Student: username: rahul       | password: password123")
    print("=================================================================")

if __name__ == "__main__":
    asyncio.run(seed_data())
