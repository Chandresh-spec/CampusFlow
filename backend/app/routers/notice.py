from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.notice import Notice, NoticeDismiss
from app.models.user import UserRole
from app.dependencies import get_current_user
from app.schemas.notice import NoticeCreate, NoticeUpdate

router = APIRouter(prefix="/notice/api", tags=["notice"])

@router.get("/notices/")
async def list_notices(user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.role == UserRole.student:
        # Get dismissed notice IDs
        dismiss_subq = select(NoticeDismiss.notice_id).where(NoticeDismiss.student_id == user.id)
        dismiss_res = await db.execute(dismiss_subq)
        dismissed_ids = [row[0] for row in dismiss_res.all()]
        
        query = select(Notice).where(
            or_(Notice.semester == None, Notice.semester == user.sem)
        )
        if dismissed_ids:
            query = query.where(Notice.id.notin_(dismissed_ids))
            
    elif user.role == UserRole.faculty:
        query = select(Notice).where(Notice.posted_by_id == user.id)
    else:
        query = select(Notice)
        
    query = query.order_by(Notice.created_at.desc()).options(selectinload(Notice.posted_by))
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/notices/", status_code=status.HTTP_201_CREATED)
async def create_notice(req: NoticeCreate, user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.role not in [UserRole.faculty, UserRole.admin]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
    notice = Notice(
        title=req.title,
        content=req.content,
        semester=req.semester,
        posted_by_id=user.id
    )
    db.add(notice)
    await db.commit()
    await db.refresh(notice)
    return notice

@router.get("/notices/{id}/")
async def get_notice(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Notice).where(Notice.id == id).options(selectinload(Notice.posted_by)))
    notice = result.scalar_one_or_none()
    if not notice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notice not found")
    return notice

@router.put("/notices/{id}/")
async def update_notice_full(id: int, req: NoticeCreate, user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Notice).where(Notice.id == id))
    notice = result.scalar_one_or_none()
    if not notice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notice not found")
    if user.role != UserRole.admin and notice.posted_by_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
    notice.title = req.title
    notice.content = req.content
    notice.semester = req.semester
    await db.commit()
    await db.refresh(notice)
    return notice

@router.patch("/notices/{id}/")
async def update_notice_partial(id: int, req: NoticeUpdate, user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Notice).where(Notice.id == id))
    notice = result.scalar_one_or_none()
    if not notice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notice not found")
    if user.role != UserRole.admin and notice.posted_by_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
    if req.title is not None: notice.title = req.title
    if req.content is not None: notice.content = req.content
    if req.semester is not None: notice.semester = req.semester
    await db.commit()
    await db.refresh(notice)
    return notice

@router.delete("/notices/{id}/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notice(id: int, user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Notice).where(Notice.id == id))
    notice = result.scalar_one_or_none()
    if not notice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notice not found")
    if user.role != UserRole.admin and notice.posted_by_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
        
    await db.delete(notice)
    await db.commit()
    return None

@router.post("/notices/{id}/dismiss/")
async def dismiss_notice(id: int, user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(NoticeDismiss).where(
        NoticeDismiss.notice_id == id,
        NoticeDismiss.student_id == user.id
    ))
    if not result.scalar_one_or_none():
        dismissal = NoticeDismiss(notice_id=id, student_id=user.id)
        db.add(dismissal)
        await db.commit()
    return {"message": "Notice dismissed"}
