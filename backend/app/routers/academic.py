from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional

from app.database import get_db
from app.models.academic import Sem, Subject
from app.models.user import User
from app.dependencies import get_current_user, require_role, get_optional_current_user
from app.schemas.academic import SubjectCreate, SubjectUpdate

router = APIRouter(prefix="/academic/api", tags=["academic"])

@router.get("/semesters/")
async def list_semesters(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Sem).order_by(Sem.sem_nmbr))
    return result.scalars().all()

@router.get("/semesters/{id}/")
async def get_semester(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Sem).where(Sem.id == id))
    sem = result.scalar_one_or_none()
    if not sem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Semester not found")
    return sem

@router.get("/subjects/")
async def list_subjects(
    semester: Optional[int] = None,
    user: Optional[User] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Subject).options(selectinload(Subject.sem), selectinload(Subject.faculty))
    target_sem = semester
    if user:
        user_role = str(getattr(user.role, 'value', user.role)).lower()
        if user_role == "student":
            target_sem = user.sem or 1

    if target_sem is not None:
        query = query.join(Sem).where(Sem.sem_nmbr == target_sem)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/subjects/", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_role("admin"))])
async def create_subject(req: SubjectCreate, db: AsyncSession = Depends(get_db)):
    subject = Subject(
        sub_code=req.sub_code,
        sub_name=req.sub_name,
        sem_id=req.sem_id,
        faculty_id=req.faculty_id
    )
    db.add(subject)
    try:
        await db.commit()
        await db.refresh(subject)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Error creating subject. Check relations and uniqueness.")
    return subject

@router.get("/subjects/{id}/")
async def get_subject(id: int, db: AsyncSession = Depends(get_db)):
    query = select(Subject).where(Subject.id == id).options(selectinload(Subject.sem), selectinload(Subject.faculty))
    result = await db.execute(query)
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
    return subject

@router.put("/subjects/{id}/", dependencies=[Depends(require_role("admin"))])
async def update_subject_full(id: int, req: SubjectCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Subject).where(Subject.id == id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
        
    subject.sub_code = req.sub_code
    subject.sub_name = req.sub_name
    subject.sem_id = req.sem_id
    subject.faculty_id = req.faculty_id
    
    await db.commit()
    await db.refresh(subject)
    return subject

@router.patch("/subjects/{id}/", dependencies=[Depends(require_role("admin"))])
async def update_subject_partial(id: int, req: SubjectUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Subject).where(Subject.id == id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
        
    if req.sub_code is not None:
        subject.sub_code = req.sub_code
    if req.sub_name is not None:
        subject.sub_name = req.sub_name
    if req.sem_id is not None:
        subject.sem_id = req.sem_id
    if req.faculty_id is not None:
        subject.faculty_id = req.faculty_id
        
    await db.commit()
    await db.refresh(subject)
    return subject

@router.delete("/subjects/{id}/", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_role("admin"))])
async def delete_subject(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Subject).where(Subject.id == id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
        
    await db.delete(subject)
    await db.commit()
    return None
