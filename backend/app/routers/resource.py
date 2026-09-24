from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
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

router = APIRouter(tags=["resource"])

@router.post("/upload-direct")
@router.post("/upload-direct/")
async def upload_direct(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    subject_id: int = Form(...),
    file_type: Optional[str] = Form("PDF"),
    user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    content = await file.read()
    file_size = len(content)
    unique_id = uuid.uuid4().hex
    safe_filename = file.filename.replace(" ", "_") if file.filename else "uploaded_file"
    s3_key = f"resources/{unique_id}_{safe_filename}"
    
    content_type = file.content_type or "application/octet-stream"
    try:
        await s3_service.upload_file_bytes(s3_key, content, content_type)
    except Exception as e:
        print(f"[S3] Upload warning (persisted locally): {e}")

    s3_url = ""
    try:
        s3_url = await s3_service.generate_presigned_download_url(s3_key)
    except Exception:
        s3_url = ""

    raw_ft = (file_type or "PDF").upper().strip()
    if raw_ft in ["PDF", "PPT", "DOC", "IMG"]:
        ft_enum = FileType[raw_ft]
    elif "NOTE" in raw_ft or "TXT" in raw_ft or "ASSIGN" in raw_ft or "PYQ" in raw_ft:
        ft_enum = FileType.PDF
    elif "WORD" in raw_ft or "DOC" in raw_ft:
        ft_enum = FileType.DOC
    elif "PRESENT" in raw_ft or "PPT" in raw_ft:
        ft_enum = FileType.PPT
    elif "IMAGE" in raw_ft or "PNG" in raw_ft or "JPG" in raw_ft:
        ft_enum = FileType.IMG
    else:
        ft_enum = FileType.PDF

    user_role_str = (user.role.value if hasattr(user.role, "value") else str(user.role)).lower()
    is_auto_approve = user_role_str in ["faculty", "teacher", "admin"]
    status_val = ResourceStatus.APPROVED if is_auto_approve else ResourceStatus.PENDING

    resource = Resource(
        title=title,
        description=description or "",
        s3_key=s3_key,
        s3_url=s3_url,
        file_type=ft_enum,
        file_size=file_size,
        subject_id=subject_id,
        uploaded_by_id=user.id,
        status=status_val,
        is_official=is_auto_approve
    )
    db.add(resource)
    await db.commit()
    await db.refresh(resource)

    # Save local copy to persistent volume for instant RAG access
    import os
    for base_dir in ["/app/data", "./backend/data", "./data"]:
        try:
            local_target = os.path.join(base_dir, s3_key)
            os.makedirs(os.path.dirname(local_target), exist_ok=True)
            with open(local_target, "wb") as f:
                f.write(content)
            break
        except Exception:
            pass

    if resource.file_type == FileType.PDF and resource.s3_key:
        # Immediate RAG indexing so students can query notes instantly
        try:
            from app.services import rag_service
            await rag_service.index_document(str(resource.subject_id), content, doc_name=resource.title)
        except Exception as e:
            print(f"[RAG] Immediate indexing error on upload: {e}")

        try:
            msg = {
                "action": "index_pdf",
                "s3_key": resource.s3_key,
                "subject_id": resource.subject_id,
                "resource_id": resource.id
            }
            await sqs_service.send_message(msg)
        except Exception:
            pass

    return resource

@router.post("/s3/presign-upload")
@router.post("/s3/presign-upload/")
async def presign_upload(req: PresignRequest, user = Depends(get_current_user)):
    folder = req.folder if req.folder else "resources"
    filename = req.filename or req.file_name or "uploaded_file"
    content_type = req.content_type or req.file_type or "application/octet-stream"
    unique_id = uuid.uuid4().hex
    s3_key = f"{folder}/{unique_id}_{filename}"
    upload_url = await s3_service.generate_presigned_upload_url(s3_key, content_type)
    return {"upload_url": upload_url, "s3_key": s3_key}

@router.get("/faculty/dashboard/")
async def faculty_dashboard(user = Depends(require_role("faculty", "admin")), db: AsyncSession = Depends(get_db)):
    res_query = select(Resource).where(Resource.uploaded_by_id == user.id)
    resources_res = await db.execute(res_query)
    resources = resources_res.scalars().all()
    
    total_resources = len(resources)
    pending_approvals = sum(1 for r in resources if r.status == ResourceStatus.PENDING)
    views_today = sum(r.view_count for r in resources)
    active_students = 0
    
    recent_query = (
        select(Resource)
        .where(Resource.uploaded_by_id == user.id)
        .order_by(desc(Resource.created_at))
        .limit(5)
        .options(selectinload(Resource.subject))
    )
    recent_res = await db.execute(recent_query)
    recent_list = recent_res.scalars().all()
    
    recent_uploads = []
    for r in recent_list:
        recent_uploads.append({
            "id": r.id,
            "title": r.title,
            "subject_name": r.subject.sub_name if r.subject else "General",
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "view_count": r.view_count,
            "views": r.view_count,
            "created_at": r.created_at,
            "s3_url": r.s3_url or "",
            "file_size": r.file_size
        })
    
    return {
        "total_resources": total_resources,
        "views_today": views_today,
        "pending_approvals": pending_approvals,
        "active_students": active_students,
        "recent_uploads": recent_uploads
    }

@router.get("/student/dashboard/")
async def student_dashboard(
    semester: Optional[int] = None,
    user = Depends(require_role("student")),
    db: AsyncSession = Depends(get_db)
):
    target_sem = semester or user.sem or 1
    
    # 1. Fetch all subjects for the target semester
    subs_query = (
        select(Subject)
        .join(Sem, Subject.sem_id == Sem.id)
        .where(Sem.sem_nmbr == target_sem)
        .options(selectinload(Subject.faculty))
        .order_by(Subject.sub_code)
    )
    subs_res = await db.execute(subs_query)
    subjects_list = subs_res.scalars().all()
    
    # 2. Fetch resources for the target semester
    query = (
        select(Resource)
        .join(Subject, Resource.subject_id == Subject.id)
        .join(Sem, Subject.sem_id == Sem.id)
        .where(Sem.sem_nmbr == target_sem)
        .where(or_(Resource.status == ResourceStatus.APPROVED, Resource.uploaded_by_id == user.id))
        .order_by(desc(Resource.created_at))
        .options(selectinload(Resource.subject).selectinload(Subject.faculty), selectinload(Resource.uploaded_by))
    )
    res = await db.execute(query)
    resources = res.scalars().all()
    
    resources_formatted = []
    subject_resource_counts = {}
    for r in resources:
        url = r.s3_url or ""
        if not url and r.s3_key:
            try:
                url = await s3_service.generate_presigned_download_url(r.s3_key)
            except Exception:
                url = ""
        sub_name = r.subject.sub_name if r.subject else "General"
        sub_code = r.subject.sub_code if r.subject else ""
        sub_id = r.subject_id
        
        subject_resource_counts[sub_id] = subject_resource_counts.get(sub_id, 0) + 1
        
        resources_formatted.append({
            "id": r.id,
            "title": r.title,
            "description": r.description or "",
            "subject_id": sub_id,
            "subject_name": sub_name,
            "subject_code": sub_code,
            "faculty_name": r.uploaded_by.username if r.uploaded_by else (r.subject.faculty.username if r.subject and r.subject.faculty else "Faculty"),
            "file_type": r.file_type.value if hasattr(r.file_type, "value") else str(r.file_type),
            "file_size": r.file_size,
            "size": r.file_size,
            "views": r.view_count or 0,
            "view_count": r.view_count or 0,
            "created_at": r.created_at,
            "s3_url": url,
            "status": r.status.value if hasattr(r.status, "value") else str(r.status)
        })
        
    formatted_subjects = []
    for s in subjects_list:
        formatted_subjects.append({
            "id": s.id,
            "sub_code": s.sub_code,
            "sub_name": s.sub_name,
            "sem_id": s.sem_id,
            "faculty_name": s.faculty.username if s.faculty else "Department Faculty",
            "file_count": subject_resource_counts.get(s.id, 0)
        })
        
    return {
        "student": user,
        "current_semester": target_sem,
        "subjects": formatted_subjects,
        "recent_resources": resources_formatted[:10],
        "resources": resources_formatted,
        "total_resources": len(resources_formatted)
    }

@router.get("/student/search/")
async def student_search(q: str, user = Depends(require_role("student")), db: AsyncSession = Depends(get_db)):
    if not user.sem:
        return []
    query = (
        select(Resource)
        .join(Subject, Resource.subject_id == Subject.id)
        .join(Sem, Subject.sem_id == Sem.id)
        .where(Sem.sem_nmbr == user.sem)
        .where(Resource.status == ResourceStatus.APPROVED)
        .where(Resource.title.ilike(f"%{q}%"))
        .options(selectinload(Resource.subject).selectinload(Subject.faculty), selectinload(Resource.uploaded_by))
    )
    res = await db.execute(query)
    return res.scalars().all()

@router.get("/student/filter/")
async def student_filter(subject: Optional[str] = None, professor: Optional[str] = None, type: Optional[str] = None, user = Depends(require_role("student")), db: AsyncSession = Depends(get_db)):
    if not user.sem:
        return []
    query = (
        select(Resource)
        .join(Subject, Resource.subject_id == Subject.id)
        .join(Sem, Subject.sem_id == Sem.id)
        .where(Sem.sem_nmbr == user.sem)
        .where(Resource.status == ResourceStatus.APPROVED)
        .options(selectinload(Resource.subject).selectinload(Subject.faculty), selectinload(Resource.uploaded_by))
    )
    if subject:
        query = query.where(Subject.sub_code == subject)
    if type:
        query = query.where(Resource.file_type == type)
    res = await db.execute(query)
    return res.scalars().all()

@router.get("/student/resources/")
async def list_student_resources(user = Depends(require_role("student")), db: AsyncSession = Depends(get_db)):
    if not user.sem:
        return []
    query = (
        select(Resource)
        .join(Subject, Resource.subject_id == Subject.id)
        .join(Sem, Subject.sem_id == Sem.id)
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
    if resource.s3_key and not resource.s3_url:
        try:
            resource.s3_url = await s3_service.generate_presigned_download_url(resource.s3_key)
        except Exception:
            pass
    return resource

@router.get("/student/resources/{id}/file/")
@router.get("/student/resources/{id}/file")
@router.get("/resources/{id}/file/")
@router.get("/resources/{id}/file")
async def get_resource_file(id: int, db: AsyncSession = Depends(get_db)):
    res_query = select(Resource).where(Resource.id == id)
    result = await db.execute(res_query)
    resource = result.scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    resource.view_count = (resource.view_count or 0) + 1
    await db.commit()
    
    # Determine safe filename and media type
    ext = ".pdf"
    ft_str = resource.file_type.value if hasattr(resource.file_type, "value") else str(resource.file_type or "PDF")
    if "DOC" in ft_str:
        ext = ".docx"
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif "PPT" in ft_str:
        ext = ".pptx"
        media_type = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    elif "IMG" in ft_str or "PNG" in ft_str:
        ext = ".png"
        media_type = "image/png"
    elif "JPG" in ft_str or "JPEG" in ft_str:
        ext = ".jpg"
        media_type = "image/jpeg"
    else:
        ext = ".pdf"
        media_type = "application/pdf"
        
    safe_name = "".join([c if c.isalnum() or c in " ._-" else "_" for c in resource.title]).strip()
    if not safe_name.lower().endswith(ext):
        safe_name = f"{safe_name}{ext}"
        
    # 1. Check local disk cache first (instant response)
    import os
    for base_dir in ["/app/data", "./backend/data", "./data"]:
        if resource.s3_key:
            local_target = os.path.join(base_dir, resource.s3_key)
            if os.path.exists(local_target) and os.path.getsize(local_target) > 0:
                from fastapi.responses import FileResponse
                return FileResponse(
                    path=local_target,
                    filename=safe_name,
                    media_type=media_type,
                    headers={"Content-Disposition": f'inline; filename="{safe_name}"'}
                )
                
    # 2. Stream directly from S3 via boto3 (no S3 CORS issues, no client auth expiration)
    if resource.s3_key:
        try:
            pdf_bytes = await s3_service.download_file_bytes(resource.s3_key)
            if pdf_bytes and len(pdf_bytes) > 0:
                import io
                from fastapi.responses import StreamingResponse
                return StreamingResponse(
                    io.BytesIO(pdf_bytes),
                    media_type=media_type,
                    headers={
                        "Content-Disposition": f'inline; filename="{safe_name}"',
                        "Content-Length": str(len(pdf_bytes))
                    }
                )
        except Exception as e:
            print(f"[FileServe] S3 direct stream warning for {resource.s3_key}: {e}")
            
    # 3. Fallback to presigned S3 URL or reference URL redirect
    presigned_url = None
    if resource.s3_key:
        try:
            presigned_url = await s3_service.generate_presigned_download_url(resource.s3_key, expires_in=86400)
        except Exception:
            pass
    if not presigned_url and resource.s3_url:
        presigned_url = resource.s3_url
    if not presigned_url and resource.reference_url:
        presigned_url = resource.reference_url
        
    if presigned_url:
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=presigned_url, status_code=307)
        
    raise HTTPException(status_code=404, detail="File content not found on server or storage")

@router.post("/student/resources/{id}/download/")
@router.post("/student/resources/{id}/download")
@router.get("/student/resources/{id}/download/")
@router.get("/student/resources/{id}/download")
@router.post("/resources/{id}/download/")
@router.post("/resources/{id}/download")
@router.get("/resources/{id}/download/")
@router.get("/resources/{id}/download")
async def download_student_resource(id: int, user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    res_query = select(Resource).where(Resource.id == id)
    result = await db.execute(res_query)
    resource = result.scalar_one_or_none()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    resource.view_count = (resource.view_count or 0) + 1
    
    dl_query = select(ResourceDownload).where(ResourceDownload.resource_id == id, ResourceDownload.student_id == user.id)
    dl_res = await db.execute(dl_query)
    if not dl_res.scalar_one_or_none():
        dl = ResourceDownload(resource_id=id, student_id=user.id)
        db.add(dl)
        
    await db.commit()
    
    url = ""
    if resource.s3_key:
        try:
            # Generate a fresh 24-hour presigned download URL
            url = await s3_service.generate_presigned_download_url(resource.s3_key, expires_in=86400)
        except Exception:
            pass
    if not url and resource.s3_url and "Expires=" not in resource.s3_url:
        url = resource.s3_url
    if not url and resource.reference_url:
        url = resource.reference_url
        
    backend_file_url = f"/api/student/resources/{resource.id}/file/"
    if not url:
        url = backend_file_url

    return {
        "message": "Downloaded", 
        "url": url, 
        "file_url": backend_file_url,
        "view_count": resource.view_count
    }

@router.get("/resources/")
async def list_resources(
    subject_code: Optional[str] = None,
    semester: Optional[int] = None,
    professor: Optional[str] = None,
    user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Resource).options(
        selectinload(Resource.subject).selectinload(Subject.sem),
        selectinload(Resource.uploaded_by)
    )
    
    if user.role == UserRole.student:
        query = query.where(or_(Resource.status == ResourceStatus.APPROVED, Resource.uploaded_by_id == user.id))
    elif user.role == UserRole.faculty:
        query = query.join(Subject, Resource.subject_id == Subject.id, isouter=True).where(
            or_(Resource.uploaded_by_id == user.id, Subject.faculty_id == user.id)
        )
        
    if subject_code:
        query = query.join(Subject, Resource.subject_id == Subject.id, isouter=True).where(Subject.sub_code == subject_code)
    if semester:
        query = query.join(Subject, Resource.subject_id == Subject.id, isouter=True).join(Sem, Subject.sem_id == Sem.id, isouter=True).where(Sem.sem_nmbr == semester)
        
    query = query.order_by(desc(Resource.created_at))
    res = await db.execute(query)
    resources = res.scalars().all()

    output = []
    for r in resources:
        url = r.s3_url
        if not url and r.s3_key:
            try:
                url = await s3_service.generate_presigned_download_url(r.s3_key)
            except Exception:
                url = ""
        output.append({
            "id": r.id,
            "title": r.title,
            "description": r.description or "",
            "s3_key": r.s3_key,
            "s3_url": url,
            "reference_url": r.reference_url,
            "file_type": r.file_type.value if hasattr(r.file_type, "value") else str(r.file_type),
            "file_size": r.file_size,
            "view_count": r.view_count,
            "views": r.view_count,
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "is_official": r.is_official,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
            "subject": r.subject,
            "subject_name": r.subject.sub_name if r.subject else "",
            "uploaded_by": r.uploaded_by.username if r.uploaded_by else ""
        })
    return output

@router.post("/resources/", status_code=status.HTTP_201_CREATED)
async def create_resource(req: ResourceCreate, user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    is_auto_approve = user.role in [UserRole.faculty, UserRole.admin]
    status_val = ResourceStatus.APPROVED if is_auto_approve else ResourceStatus.PENDING
    is_official = is_auto_approve
    
    target_subject_id = req.subject_id or req.subject
    if not target_subject_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Subject is required")

    # Normalize file_type
    raw_ft = (req.file_type or "PDF").upper().strip()
    if raw_ft in ["PDF", "PPT", "DOC", "IMG"]:
        ft_enum = FileType[raw_ft]
    elif "NOTE" in raw_ft or "TXT" in raw_ft or "ASSIGN" in raw_ft or "PYQ" in raw_ft:
        ft_enum = FileType.PDF
    elif "WORD" in raw_ft or "DOC" in raw_ft:
        ft_enum = FileType.DOC
    elif "PRESENT" in raw_ft or "PPT" in raw_ft:
        ft_enum = FileType.PPT
    elif "IMAGE" in raw_ft or "PNG" in raw_ft or "JPG" in raw_ft:
        ft_enum = FileType.IMG
    else:
        ft_enum = FileType.PDF

    f_size = None
    if req.file_size is not None:
        try:
            f_size = int(req.file_size)
        except (ValueError, TypeError):
            f_size = None

    s3_url = req.s3_url
    if not s3_url and req.s3_key:
        try:
            s3_url = await s3_service.generate_presigned_download_url(req.s3_key)
        except Exception:
            s3_url = ""

    resource = Resource(
        title=req.title,
        description=req.description or "",
        s3_key=req.s3_key,
        s3_url=s3_url,
        reference_url=req.reference_url,
        file_type=ft_enum,
        file_size=f_size,
        subject_id=target_subject_id,
        uploaded_by_id=user.id,
        status=status_val,
        is_official=is_official
    )
    db.add(resource)
    await db.commit()
    await db.refresh(resource)
    
    if resource.file_type == FileType.PDF and resource.s3_key:
        try:
            msg = {
                "action": "index_pdf",
                "s3_key": resource.s3_key,
                "subject_id": resource.subject_id,
                "resource_id": resource.id
            }
            await sqs_service.send_message(msg)
        except Exception as e:
            print(f"[SQS] Note on sending message: {e}")
            
    res_loaded = await db.execute(
        select(Resource)
        .where(Resource.id == resource.id)
        .options(selectinload(Resource.subject).selectinload(Subject.sem), selectinload(Resource.uploaded_by))
    )
    return res_loaded.scalar_one_or_none() or resource

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
