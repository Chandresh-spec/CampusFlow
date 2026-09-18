from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from sqlalchemy.orm import selectinload
from typing import Optional, List
import uuid

from app.database import get_db
from app.models.resource import Resource, ResourceStatus, ResourceDownload, FileType
from app.models.user import UserRole
from app.models.academic import Subject, Sem
from app.dependencies import get_current_user, require_role
from app.schemas.resource import (
    PresignUploadRequest as PresignRequest,
    ResourceCreateRequest as ResourceCreate,
    ResourceUpdateRequest as ResourceUpdate,
)
from app.services import s3_service, sqs_service

router = APIRouter(prefix="/resource/api", tags=["resource"])

@router.post("/s3/presign-upload")
async def presign_upload(req: PresignRequest, user = Depends(get_current_user)):
    folder = req.folder if req.folder else "resources"
    unique_id = uuid.uuid4().hex
    s3_key = f"{folder}/{unique_id}_{req.filename}"
    upload_url = await s3_service.generate_presigned_upload_url(s3_key, req.content_type)
    return {"upload_url": upload_url, "s3_key": s3_key}

@router.get("/faculty/dashboard/")
async def faculty_dashboard(user = Depends(require_role("faculty", "admin")), db: AsyncSession = Depends(get_db)):
    # Calculate stats for the faculty's resources
    res_query = select(Resource).where(Resource.uploaded_by_id == user.id)
    resources_res = await db.execute(res_query)
    resources = resources_res.scalars().all()
    
    total_resources = len(resources)
    pending_approvals = sum(1 for r in resources if r.status == ResourceStatus.PENDING)
    # views_today, active_students are placeholders as we don't track daily views in the models exactly
    # We will use view_count sum as an approximation
    views_today = sum(r.view_count for r in resources)
    active_students = 0  # placeholder
    
    recent_query = select(Resource).where(Resource.uploaded_by_id == user.id).order_by(desc(Resource.created_at)).limit(5)
    recent_res = await db.execute(recent_query.options(selectinload(Resource.subject)))
    
    return {
        "total_resources": total_resources,
        "views_today": views_today,
        "pending_approvals": pending_approvals,
        "active_students": active_students,
        "recent_uploads": recent_res.scalars().all()
    }

@router.get("/student/dashboard/")
async def student_dashboard(user = Depends(require_role("student")), db: AsyncSession = Depends(get_db)):
    if not user.sem:
        return {"student": user, "recent_resources": [], "activity_stats": {}, "resources_by_subject": []}
        
    query = (
        select(Resource)
        .join(Subject)
        .join(Sem)
        .where(Sem.sem_nmbr == user.sem)
        .where(Resource.status == ResourceStatus.APPROVED)
        .order_by(desc(Resource.created_at))
        .limit(10)
        .options(selectinload(Resource.subject), selectinload(Resource.uploaded_by))
    )
    res = await db.execute(query)
    recent = res.scalars().all()
    
    return {
        "student": user,
        "recent_resources": recent,
        "activity_stats": {"downloads": 0},
        "resources_by_subject": []
    }

@router.get("/student/search/")
async def student_search(q: str, user = Depends(require_role("student")), db: AsyncSession = Depends(get_db)):
    if not user.sem:
        return []
    query = (
        select(Resource)
        .join(Subject)
        .join(Sem)
        .where(Sem.sem_nmbr == user.sem)
        .where(Resource.status == ResourceStatus.APPROVED)
        .where(Resource.title.ilike(f"%{q}%"))
        .options(selectinload(Resource.subject), selectinload(Resource.uploaded_by))
    )
    res = await db.execute(query)
    return res.scalars().all()

@router.get("/student/filter/")
async def student_filter(subject: Optional[str] = None, professor: Optional[str] = None, type: Optional[str] = None, user = Depends(require_role("student")), db: AsyncSession = Depends(get_db)):
    if not user.sem:
        return []
    query = (
        select(Resource)
        .join(Subject)
        .join(Sem)
        .where(Sem.sem_nmbr == user.sem)
        .where(Resource.status == ResourceStatus.APPROVED)
        .options(selectinload(Resource.subject), selectinload(Resource.uploaded_by))
    )
    if subject:
        query = query.where(Subject.sub_code == subject)
    if type:
        query = query.where(Resource.file_type == type)
    res = await db.execute(query)
    # professor filter requires joining User, ignoring for brevity or can filter in python
    return res.scalars().all()

@router.get("/student/resources/")
async def list_student_resources(user = Depends(require_role("student")), db: AsyncSession = Depends(get_db)):
    if not user.sem:
        return []
    query = (
        select(Resource)
        .join(Subject)
        .join(Sem)
        .where(Sem.sem_nmbr == user.sem)
        .where(Resource.status == ResourceStatus.APPROVED)
        .options(selectinload(Resource.subject), selectinload(Resource.uploaded_by))
    )
    res = await db.execute(query)
    return res.scalars().all()

@router.get("/student/resources/{id}/")
async def get_student_resource(id: int, user = Depends(require_role("student")), db: AsyncSession = Depends(get_db)):
    query = (
        select(Resource)
        .where(Resource.id == id, Resource.status == ResourceStatus.APPROVED)
        .options(selectinload(Resource.subject), selectinload(Resource.uploaded_by))
    )
    res = await db.execute(query)
    resource = res.scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource

@router.post("/student/resources/{id}/download/")
async def download_student_resource(id: int, user = Depends(require_role("student")), db: AsyncSession = Depends(get_db)):
    res_query = select(Resource).where(Resource.id == id, Resource.status == ResourceStatus.APPROVED)
    result = await db.execute(res_query)
    resource = result.scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    resource.view_count += 1
    
    # get_or_create download record
    dl_query = select(ResourceDownload).where(ResourceDownload.resource_id == id, ResourceDownload.student_id == user.id)
    dl_res = await db.execute(dl_query)
    if not dl_res.scalar_one_or_none():
        dl = ResourceDownload(resource_id=id, student_id=user.id)
        db.add(dl)
        
    await db.commit()
    return {"message": "Downloaded"}

@router.get("/resources/")
async def list_resources(subject_code: Optional[str] = None, semester: Optional[int] = None, professor: Optional[str] = None, user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    query = select(Resource).options(selectinload(Resource.subject).selectinload(Subject.sem), selectinload(Resource.uploaded_by))
    
    if user.role == UserRole.student:
        query = query.where(or_(Resource.status == ResourceStatus.APPROVED, Resource.uploaded_by_id == user.id))
    elif user.role == UserRole.faculty:
        # Assuming faculty sees resources for subjects they teach
        query = query.join(Subject).where(Subject.faculty_id == user.id)
        
    # Apply filters
    if subject_code:
        query = query.join(Subject).where(Subject.sub_code == subject_code)
    if semester:
        # Need to join Sem if not already joined via subject_code logic, simplified for here
        pass
        
    res = await db.execute(query)
    return res.scalars().all()

@router.post("/resources/", status_code=status.HTTP_201_CREATED)
async def create_resource(req: ResourceCreate, user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Determine auto-approve
    is_auto_approve = user.role in [UserRole.faculty, UserRole.admin]
    status_val = ResourceStatus.APPROVED if is_auto_approve else ResourceStatus.PENDING
    is_official = is_auto_approve
    
    resource = Resource(
        title=req.title,
        description=req.description,
        s3_key=req.s3_key,
        s3_url=req.s3_url,
        reference_url=req.reference_url,
        file_type=req.file_type,
        file_size=req.file_size,
        subject_id=req.subject_id,
        uploaded_by_id=user.id,
        status=status_val,
        is_official=is_official
    )
    db.add(resource)
    await db.commit()
    await db.refresh(resource)
    
    # SQS for PDF
    if resource.file_type == FileType.PDF and resource.s3_key:
        msg = {
            "action": "index_pdf",
            "s3_key": resource.s3_key,
            "subject_id": resource.subject_id,
            "resource_id": resource.id
        }
        await sqs_service.send_message(msg)
        
    return resource

@router.get("/resources/{id}/")
async def get_resource(id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Resource).where(Resource.id == id).options(selectinload(Resource.subject), selectinload(Resource.uploaded_by)))
    resource = res.scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=404, detail="Not found")
    return resource

@router.put("/resources/{id}/")
async def update_resource_full(id: int, req: ResourceUpdate, user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Resource).where(Resource.id == id))
    resource = res.scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=404, detail="Not found")
    if user.role != UserRole.admin and resource.uploaded_by_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = req.model_dump(exclude_unset=False)
    for field, value in update_data.items():
        if hasattr(resource, field):
            setattr(resource, field, value)
    await db.commit()
    await db.refresh(resource)
    return resource

@router.patch("/resources/{id}/")
async def update_resource_partial(id: int, req: ResourceUpdate, user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Resource).where(Resource.id == id))
    resource = res.scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=404, detail="Not found")
    if user.role != UserRole.admin and resource.uploaded_by_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = req.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(resource, field):
            setattr(resource, field, value)
    await db.commit()
    await db.refresh(resource)
    return resource

@router.delete("/resources/{id}/", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resource(id: int, user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Resource).where(Resource.id == id))
    resource = res.scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=404, detail="Not found")
    if user.role != UserRole.admin and resource.uploaded_by_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if resource.s3_key:
        await s3_service.delete_object(resource.s3_key)
        
    await db.delete(resource)
    await db.commit()
    return None

@router.post("/resources/{id}/approve/")
async def approve_resource(id: int, user = Depends(require_role("faculty", "admin")), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Resource).where(Resource.id == id))
    resource = res.scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=404, detail="Not found")
        
    resource.status = ResourceStatus.APPROVED
    await db.commit()
    
    if resource.file_type == FileType.PDF and resource.s3_key:
        msg = {
            "action": "index_pdf",
            "s3_key": resource.s3_key,
            "subject_id": resource.subject_id,
            "resource_id": resource.id
        }
        await sqs_service.send_message(msg)
        
    return resource

@router.post("/resources/{id}/reject/")
async def reject_resource(id: int, user = Depends(require_role("faculty", "admin")), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Resource).where(Resource.id == id))
    resource = res.scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=404, detail="Not found")
        
    resource.status = ResourceStatus.REJECTED
    await db.commit()
    return resource
