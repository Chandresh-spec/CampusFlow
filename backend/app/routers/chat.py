from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional

from app.database import get_db, async_session_factory
from app.models.chat import AnonChatRoom, AnonMessage, PDFDocument, AIChatSession, AIChatMessage
from app.models.academic import Subject, Sem
from app.models.user import User, UserRole
from app.dependencies import get_current_user, get_optional_current_user
from app.schemas.chat import (
    GenAIRequest, RAGChatRequest, SendMessageRequest,
    CreateSessionRequest
)
from app.services import llm_service, s3_service, rag_service, auth_service

router = APIRouter(prefix="/Genai/api", tags=["chat"])
chat_group_router = APIRouter(prefix="/api/chat", tags=["chat-groups"])

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
@router.post("/ask")
@router.post("/ask/")
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
@router.post("/rag/ask")
@router.post("/rag/ask/")
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

@chat_group_router.post("/genai")
@chat_group_router.post("/genai/")
@chat_group_router.post("/ask")
@chat_group_router.post("/ask/")
async def chat_group_genai_query(req: GenAIRequest, user = Depends(get_optional_current_user), db: AsyncSession = Depends(get_db)):
    return await genai_query(req, user, db)

@chat_group_router.post("/rag/ask")
@chat_group_router.post("/rag/ask/")
@chat_group_router.post("/chat")
@chat_group_router.post("/chat/")
async def chat_group_rag_chat(req: RAGChatRequest, user = Depends(get_optional_current_user), db: AsyncSession = Depends(get_db)):
    return await rag_chat(req, user, db)

# ── Real-Time Semester-Scoped Group Chat & WebSockets ─────────

class ConnectionManager:
    """Manages active WebSocket connections per chat room."""
    def __init__(self):
        self.active_connections: dict[int, set[WebSocket]] = {}

    async def connect(self, room_id: int, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = set()
        self.active_connections[room_id].add(websocket)

    def disconnect(self, room_id: int, websocket: WebSocket):
        if room_id in self.active_connections:
            self.active_connections[room_id].discard(websocket)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast(self, room_id: int, message: dict):
        if room_id in self.active_connections:
            dead_connections = []
            for ws in list(self.active_connections[room_id]):
                try:
                    await ws.send_json(message)
                except Exception:
                    dead_connections.append(ws)
            for dead in dead_connections:
                self.disconnect(room_id, dead)

ws_manager = ConnectionManager()


async def get_and_verify_room_access(room_id: int, user: User, db: AsyncSession) -> tuple[AnonChatRoom, Subject]:
    """
    Verifies user has access to this chat group based on semester.
    If student, strictly enforces that the group belongs to their semester.
    """
    stmt = (
        select(AnonChatRoom)
        .where(AnonChatRoom.id == room_id)
        .options(selectinload(AnonChatRoom.subject).selectinload(Subject.sem))
    )
    res = await db.execute(stmt)
    room = res.scalar_one_or_none()
    if not room or not room.subject:
        raise HTTPException(status_code=404, detail="Chat room not found")

    room_sem = room.subject.sem.sem_nmbr if room.subject.sem else None

    # Strict semester isolation for students:
    if user.role == UserRole.student:
        student_sem = user.sem or 1
        if room_sem is not None and room_sem != student_sem:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. This chat group belongs to Semester {room_sem}, but you are enrolled in Semester {student_sem}."
            )

    return room, room.subject


# ── REST: List Chat Groups (Strictly Filtered by Semester) ────

@router.get("/groups/")
@router.get("/anon-rooms/")
@chat_group_router.get("/groups/")
async def list_chat_groups(
    sem: Optional[int] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns class chat groups.
    If student: strictly returns ONLY chat groups of their enrolled semester.
    If faculty: returns all groups or filtered by query parameter sem.
    """
    if user.role == UserRole.student:
        student_sem = user.sem or 1
        sub_query = (
            select(Subject)
            .join(Sem, Subject.sem_id == Sem.id)
            .where(Sem.sem_nmbr == student_sem)
            .options(selectinload(Subject.sem))
            .order_by(Subject.sub_name)
        )
    else:
        # Faculty / Admin
        if sem:
            sub_query = (
                select(Subject)
                .join(Sem, Subject.sem_id == Sem.id)
                .where(Sem.sem_nmbr == sem)
                .options(selectinload(Subject.sem))
                .order_by(Subject.sub_name)
            )
        else:
            sub_query = (
                select(Subject)
                .options(selectinload(Subject.sem))
                .order_by(Subject.sem_id, Subject.sub_name)
            )

    subjects_res = await db.execute(sub_query)
    subjects = subjects_res.scalars().all()

    rooms = []
    for subject in subjects:
        room_query = select(AnonChatRoom).where(AnonChatRoom.subject_id == subject.id)
        room_res = await db.execute(room_query)
        room = room_res.scalar_one_or_none()

        if not room:
            room = AnonChatRoom(subject_id=subject.id)
            db.add(room)
            await db.commit()
            await db.refresh(room)

        msg_count = await db.scalar(
            select(func.count(AnonMessage.id)).where(AnonMessage.room_id == room.id)
        )
        last_msg = (
            await db.execute(
                select(AnonMessage)
                .where(AnonMessage.room_id == room.id)
                .order_by(AnonMessage.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

        rooms.append({
            "id": room.id,
            "subject_id": subject.id,
            "subject_name": subject.sub_name,
            "subject_code": subject.sub_code,
            "semester": subject.sem.sem_nmbr if subject.sem else None,
            "last_message": last_msg.content if last_msg else None,
            "last_time": last_msg.created_at.isoformat() if last_msg else None,
            "message_count": msg_count or 0
        })

    return rooms

# ── REST: List Messages with Semester Verification ───────────

@router.get("/groups/{room_id}/messages/")
@router.get("/anon-rooms/{room_id}/messages/")
@chat_group_router.get("/groups/{room_id}/messages/")
async def list_messages(
    room_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns all messages in a group after verifying student semester access."""
    await get_and_verify_room_access(room_id, user, db)

    query = (
        select(AnonMessage)
        .where(AnonMessage.room_id == room_id)
        .order_by(AnonMessage.created_at)
        .options(selectinload(AnonMessage.sender))
    )
    res = await db.execute(query)
    messages = res.scalars().all()

    out = []
    for m in messages:
        sender_role_str = (
            m.sender.role.value if hasattr(m.sender.role, "value") else str(m.sender.role)
        ) if m.sender else "student"
        sender_name = m.sender.username if m.sender else (m.anon_alias or "Student")

        out.append({
            "id": m.id,
            "room_id": room_id,
            "sender_id": m.sender_id,
            "sender_name": sender_name,
            "sender_role": sender_role_str,
            "content": m.content,
            "is_faculty": sender_role_str == "faculty",
            "is_me": m.sender_id == user.id,
            "created_at": m.created_at.isoformat() if m.created_at else None
        })
    return out


# ── REST: Send Message (and Broadcast to WebSocket) ──────────

@router.post("/groups/{room_id}/messages/", status_code=status.HTTP_201_CREATED)
@router.post("/anon-rooms/{room_id}/messages/", status_code=status.HTTP_201_CREATED)
@chat_group_router.post("/groups/{room_id}/messages/", status_code=status.HTTP_201_CREATED)
async def send_message(
    room_id: int,
    req: SendMessageRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Sends a message via HTTP, persists to DB, and broadcasts to active WebSockets."""
    await get_and_verify_room_access(room_id, user, db)

    msg = AnonMessage(
        room_id=room_id,
        sender_id=user.id,
        content=req.content,
        anon_alias=user.username
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    sender_role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    created_at_iso = msg.created_at.isoformat() if msg.created_at else None

    payload = {
        "type": "new_message",
        "message": {
            "id": msg.id,
            "room_id": room_id,
            "sender_id": user.id,
            "sender_name": user.username,
            "sender_role": sender_role_str,
            "content": msg.content,
            "is_faculty": user.role == UserRole.faculty,
            "created_at": created_at_iso
        }
    }
    await ws_manager.broadcast(room_id, payload)

    return {
        "id": msg.id,
        "room_id": room_id,
        "sender_id": user.id,
        "sender_name": user.username,
        "sender_role": sender_role_str,
        "content": msg.content,
        "is_faculty": user.role == UserRole.faculty,
        "is_me": True,
        "created_at": created_at_iso
    }


# ── Real-Time WebSocket Endpoint ─────────────────────────────

async def handle_websocket_connection(websocket: WebSocket, room_id: int):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Authentication token required")
        return

    try:
        user_id = auth_service.decode_access_token(token)
    except Exception:
        await websocket.close(code=4001, reason="Invalid authentication token")
        return

    async with async_session_factory() as db:
        user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
        if not user or not user.is_active:
            await websocket.close(code=4001, reason="User inactive or not found")
            return

        stmt = (
            select(AnonChatRoom)
            .where(AnonChatRoom.id == room_id)
            .options(selectinload(AnonChatRoom.subject).selectinload(Subject.sem))
        )
        room = (await db.execute(stmt)).scalar_one_or_none()
        if not room or not room.subject:
            await websocket.close(code=4004, reason="Chat room not found")
            return

        room_sem = room.subject.sem.sem_nmbr if room.subject.sem else None
        if user.role == UserRole.student:
            student_sem = user.sem or 1
            if room_sem is not None and room_sem != student_sem:
                await websocket.close(
                    code=4003,
                    reason=f"Access denied: Room is Semester {room_sem}, you are in Semester {student_sem}"
                )
                return

        user_name = user.username
        user_role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
        is_faculty = user.role == UserRole.faculty

    await ws_manager.connect(room_id, websocket)

    try:
        await websocket.send_json({
            "type": "connected",
            "room_id": room_id,
            "user": {
                "id": user_id,
                "username": user_name,
                "role": user_role_str
            }
        })
    except Exception:
        ws_manager.disconnect(room_id, websocket)
        return

    try:
        while True:
            data = await websocket.receive_json()
            content = (data.get("content") or "").strip()
            if not content:
                continue

            async with async_session_factory() as db:
                msg = AnonMessage(
                    room_id=room_id,
                    sender_id=user_id,
                    content=content,
                    anon_alias=user_name
                )
                db.add(msg)
                await db.commit()
                await db.refresh(msg)
                msg_id = msg.id
                created_at_iso = msg.created_at.isoformat() if msg.created_at else None

            broadcast_payload = {
                "type": "new_message",
                "message": {
                    "id": msg_id,
                    "room_id": room_id,
                    "sender_id": user_id,
                    "sender_name": user_name,
                    "sender_role": user_role_str,
                    "content": content,
                    "is_faculty": is_faculty,
                    "created_at": created_at_iso
                }
            }
            await ws_manager.broadcast(room_id, broadcast_payload)
    except WebSocketDisconnect:
        ws_manager.disconnect(room_id, websocket)
    except Exception as e:
        print(f"[WS ERROR] room {room_id}: {e}")
        ws_manager.disconnect(room_id, websocket)


@router.websocket("/ws/{room_id}/")
async def ws_chat_genai(websocket: WebSocket, room_id: int):
    await handle_websocket_connection(websocket, room_id)


@chat_group_router.websocket("/ws/{room_id}/")
async def ws_chat_api(websocket: WebSocket, room_id: int):
    await handle_websocket_connection(websocket, room_id)
