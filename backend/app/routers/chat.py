from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.database import get_db
from app.models.chat import AnonChatRoom, AnonMessage, PDFDocument
from app.models.academic import Subject, Sem
from app.models.user import UserRole
from app.dependencies import get_current_user
from app.schemas.chat import GenAIRequest, RAGChatRequest, SendMessageRequest
from app.services import llm_service, s3_service, rag_service

router = APIRouter(prefix="/Genai/api", tags=["chat"])

@router.post("/genai")
@router.post("/genai/")
async def genai_query(req: GenAIRequest, user = Depends(get_current_user)):
    query = req.question or req.prompt or ""
    answer = await llm_service.ask_llm('', query)
    return {"answer": answer, "response": answer}

@router.post("/upload")
@router.post("/upload/")
async def upload_pdf(subject_id: Optional[str] = Form("1"), file: UploadFile = File(...), user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        content = await file.read()
        await rag_service.index_document(str(subject_id or "1"), content)
        return {"message": "PDF uploaded and indexed successfully"}
    except Exception as e:
        print(f"[RAG] Upload error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to process PDF: {str(e)}")

@router.post("/chat")
@router.post("/chat/")
async def rag_chat(req: RAGChatRequest, user = Depends(get_current_user)):
    query = req.question or req.prompt or ""
    target_subject_id = str(req.subject_id or "1")
    chunks = await rag_service.search_chunks(query, target_subject_id, top_k=4)
    context = "\n\n".join(chunks)
    answer = await llm_service.ask_llm(context, query)
    return {"answer": answer, "response": answer}

@router.get("/anon-rooms/")
async def list_anon_rooms(user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rooms = []
    if user.role == UserRole.faculty:
        sub_query = select(Subject).where(Subject.faculty_id == user.id)
    else:
        sub_query = select(Subject).join(Sem).where(Sem.sem_nmbr == user.sem)
        
    subjects_res = await db.execute(sub_query)
    subjects = subjects_res.scalars().all()
    
    for subject in subjects:
        room_query = select(AnonChatRoom).where(AnonChatRoom.subject_id == subject.id)
        room_res = await db.execute(room_query)
        room = room_res.scalar_one_or_none()
        
        if not room:
            room = AnonChatRoom(subject_id=subject.id)
            db.add(room)
            await db.commit()
            await db.refresh(room)
            
        msg_count = await db.scalar(select(func.count(AnonMessage.id)).where(AnonMessage.room_id == room.id))
        last_msg = await db.execute(select(AnonMessage).where(AnonMessage.room_id == room.id).order_by(AnonMessage.created_at.desc()).limit(1))
        lm = last_msg.scalar_one_or_none()
        
        rooms.append({
            "id": room.id,
            "subject_id": subject.id,
            "subject_name": subject.sub_name,
            "subject_code": subject.sub_code,
            "last_message": lm.content if lm else None,
            "last_time": lm.created_at if lm else None,
            "message_count": msg_count
        })
        
    return rooms

@router.get("/anon-rooms/{room_id}/messages/")
async def list_messages(room_id: int, user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    query = select(AnonMessage).where(AnonMessage.room_id == room_id).order_by(AnonMessage.created_at).options(selectinload(AnonMessage.sender))
    res = await db.execute(query)
    messages = res.scalars().all()
    
    out = []
    for m in messages:
        out.append({
            "id": m.id,
            "sender_alias": m.anon_alias,
            "content": m.content,
            "is_faculty": m.sender.role == UserRole.faculty,
            "is_me": m.sender_id == user.id,
            "created_at": m.created_at
        })
    return out

@router.post("/anon-rooms/{room_id}/messages/", status_code=status.HTTP_201_CREATED)
async def send_message(room_id: int, req: SendMessageRequest, user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.role == UserRole.faculty:
        alias = f"Prof. {user.username}"
    else:
        # Check if they already have an alias in this room
        existing_res = await db.execute(select(AnonMessage).where(AnonMessage.room_id == room_id, AnonMessage.sender_id == user.id).limit(1))
        existing = existing_res.scalar_one_or_none()
        if existing:
            alias = existing.anon_alias
        else:
            # Generate next number
            # simplistic approach, could do count distinct students in room
            alias = f"Student #{user.id}"
            
    msg = AnonMessage(
        room_id=room_id,
        sender_id=user.id,
        content=req.content,
        anon_alias=alias
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    
    return {
        "id": msg.id,
        "sender_alias": msg.anon_alias,
        "content": msg.content,
        "is_faculty": user.role == UserRole.faculty,
        "is_me": True,
        "created_at": msg.created_at
    }
