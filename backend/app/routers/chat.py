from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.database import get_db
from app.models.chat import AnonChatRoom, AnonMessage, PDFDocument, AIChatSession, AIChatMessage
from app.models.academic import Subject, Sem
from app.models.user import UserRole
from app.dependencies import get_current_user, get_optional_current_user
from app.schemas.chat import (
    GenAIRequest, RAGChatRequest, SendMessageRequest,
    CreateSessionRequest
)
from app.services import llm_service, s3_service, rag_service

router = APIRouter(prefix="/Genai/api", tags=["chat"])

# ── AI Chat Sessions & History ─────────────────────────────────

@router.get("/sessions/")
async def list_sessions(user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AIChatSession)
        .where(AIChatSession.user_id == user.id)
        .order_by(AIChatSession.updated_at.desc())
        .options(selectinload(AIChatSession.subject))
    )
    sessions = result.scalars().all()
    out = []
    for s in sessions:
        msg_count = await db.scalar(
            select(func.count(AIChatMessage.id)).where(AIChatMessage.session_id == s.id)
        )
        out.append({
            "id": s.id,
            "title": s.title,
            "mode": s.mode,
            "subject_id": s.subject_id,
            "subject_name": s.subject.sub_name if s.subject else None,
            "message_count": msg_count or 0,
            "created_at": s.created_at,
            "updated_at": s.updated_at
        })
    return out

@router.post("/sessions/", status_code=status.HTTP_201_CREATED)
async def create_session(req: CreateSessionRequest, user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    session = AIChatSession(
        user_id=user.id,
        title=req.title or "New Chat",
        mode=req.mode or "genai",
        subject_id=req.subject_id
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {
        "id": session.id,
        "title": session.title,
        "mode": session.mode,
        "subject_id": session.subject_id,
        "message_count": 0,
        "created_at": session.created_at,
        "updated_at": session.updated_at
    }

@router.get("/sessions/{session_id}/")
async def get_session(session_id: int, user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AIChatSession)
        .where(AIChatSession.id == session_id, AIChatSession.user_id == user.id)
        .options(selectinload(AIChatSession.messages), selectinload(AIChatSession.subject))
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    messages = [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at
        }
        for m in session.messages
    ]

    return {
        "id": session.id,
        "title": session.title,
        "mode": session.mode,
        "subject_id": session.subject_id,
        "subject_name": session.subject.sub_name if session.subject else None,
        "messages": messages,
        "created_at": session.created_at,
        "updated_at": session.updated_at
    }

@router.delete("/sessions/{session_id}/")
async def delete_session(session_id: int, user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AIChatSession).where(AIChatSession.id == session_id, AIChatSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found")

    await db.delete(session)
    await db.commit()
    return {"message": "Session deleted"}

@router.get("/subject-status/{subject_id}/")
async def get_subject_status(subject_id: str, db: AsyncSession = Depends(get_db)):
    # Auto-index notes for this subject if not already done
    await rag_service.ensure_subject_indexed(subject_id, db)
    return rag_service.get_subject_index_status(subject_id)

# ── Chat Query Endpoints ───────────────────────────────────────

@router.post("/genai")
@router.post("/genai/")
async def genai_query(req: GenAIRequest, user = Depends(get_optional_current_user), db: AsyncSession = Depends(get_db)):
    query = req.question or req.prompt or ""
    answer = await llm_service.ask_llm('', query)

    session_id = req.session_id
    if user:
        session = None
        if session_id:
            s_res = await db.execute(
                select(AIChatSession).where(AIChatSession.id == session_id, AIChatSession.user_id == user.id)
            )
            session = s_res.scalar_one_or_none()

        if not session:
            title = (query[:40].strip() or "General AI Chat")
            session = AIChatSession(user_id=user.id, title=title, mode="genai")
            db.add(session)
            await db.commit()
            await db.refresh(session)
            session_id = session.id
        else:
            session.updated_at = datetime.utcnow()
            if session.title in ["New Chat", "General AI Chat"] and query:
                session.title = query[:40].strip()

        db.add(AIChatMessage(session_id=session.id, role="user", content=query))
        db.add(AIChatMessage(session_id=session.id, role="ai", content=answer))
        await db.commit()

    return {"answer": answer, "response": answer, "session_id": session_id}

@router.post("/upload")
@router.post("/upload/")
async def upload_pdf(subject_id: Optional[str] = Form("1"), file: UploadFile = File(...), user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        content = await file.read()
        safe_filename = file.filename or "uploaded_document"
        await rag_service.index_document(str(subject_id or "1"), content, doc_name=safe_filename)
        return {"message": "PDF uploaded and indexed successfully"}
    except Exception as e:
        print(f"[RAG] Upload error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to process PDF: {str(e)}")

@router.post("/chat")
@router.post("/chat/")
async def rag_chat(req: RAGChatRequest, user = Depends(get_optional_current_user), db: AsyncSession = Depends(get_db)):
    query = (req.question or req.prompt or "").strip()
    if not query:
        return {"answer": "Please ask a question.", "response": "Please ask a question.", "session_id": req.session_id}

    target_subject_id = str(req.subject_id or "1")

    # 1. Automatically ensure subject notes are chunked and indexed from faculty uploads
    await rag_service.ensure_subject_indexed(target_subject_id, db)

    # 2. Check if any document has been loaded for this subject
    if not rag_service.has_document(target_subject_id):
        sub_name = "this subject"
        try:
            sub_res = await db.execute(select(Subject).where(Subject.id == int(target_subject_id)))
            sub_obj = sub_res.scalar_one_or_none()
            if sub_obj:
                sub_name = sub_obj.sub_name
        except Exception:
            pass

        answer = (
            f"No study materials or notes have been uploaded for **{sub_name}** yet by faculty. "
            f"Would you like to switch to **General AI** mode to search online?"
        )
    else:
        # 3. Retrieve relevant chunks matching the question
        chunks = await rag_service.search_chunks(query, target_subject_id, top_k=4)
        if not chunks:
            answer = (
                "The answer to this question is not present in the uploaded document. "
                "Would you like to switch to General AI mode to search online?"
            )
        else:
            # 4. Strictly answer from document context
            context = "\n\n".join(chunks)
            answer = await llm_service.ask_rag(context, query)

    session_id = req.session_id
    if user:
        session = None
        if session_id:
            s_res = await db.execute(
                select(AIChatSession).where(AIChatSession.id == session_id, AIChatSession.user_id == user.id)
            )
            session = s_res.scalar_one_or_none()

        sub_int = int(target_subject_id) if target_subject_id.isdigit() else None
        if not session:
            title = (query[:40].strip() or "RAG Notes Chat")
            session = AIChatSession(user_id=user.id, title=title, mode="rag", subject_id=sub_int)
            db.add(session)
            await db.commit()
            await db.refresh(session)
            session_id = session.id
        else:
            session.updated_at = datetime.utcnow()
            if session.title in ["New Chat", "RAG Notes Chat"] and query:
                session.title = query[:40].strip()

        db.add(AIChatMessage(session_id=session.id, role="user", content=query))
        db.add(AIChatMessage(session_id=session.id, role="ai", content=answer))
        await db.commit()

    return {"answer": answer, "response": answer, "session_id": session_id}

@router.get("/anon-rooms/")
async def list_anon_rooms(user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rooms = []
    if user.role == UserRole.faculty:
        sub_query = select(Subject).where(or_(Subject.faculty_id == user.id, Subject.faculty_id.is_(None)))
    elif user.sem:
        sub_query = select(Subject).join(Sem).where(Sem.sem_nmbr == user.sem)
    else:
        sub_query = select(Subject)
        
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
