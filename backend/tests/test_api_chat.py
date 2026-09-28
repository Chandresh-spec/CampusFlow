import pytest
from httpx import AsyncClient
from sqlalchemy import select
from app.models.academic import Subject
from app.models.chat import AnonChatRoom


@pytest.fixture
async def sem1_subject(db_session) -> Subject:
    res = await db_session.execute(select(Subject).where(Subject.sub_code == "CS101"))
    return res.scalar_one()


@pytest.fixture
async def sem2_subject(db_session) -> Subject:
    res = await db_session.execute(select(Subject).where(Subject.sub_code == "CS201"))
    return res.scalar_one()


@pytest.mark.asyncio
async def test_ai_chat_session_lifecycle(async_client: AsyncClient, student_headers):
    # 1. Create AI chat session
    create_resp = await async_client.post(
        "/Genai/api/sessions/",
        json={"title": "Python Questions", "mode": "genai"},
        headers=student_headers
    )
    assert create_resp.status_code == 201
    session_data = create_resp.json()
    assert session_data["title"] == "Python Questions"
    session_id = session_data["id"]

    # 2. List sessions
    list_resp = await async_client.get("/Genai/api/sessions/", headers=student_headers)
    assert list_resp.status_code == 200
    sessions = list_resp.json()
    assert any(s["id"] == session_id for s in sessions)

    # 3. Get session details
    detail_resp = await async_client.get(f"/Genai/api/sessions/{session_id}/", headers=student_headers)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["id"] == session_id

    # 4. Delete session
    del_resp = await async_client.delete(f"/Genai/api/sessions/{session_id}/", headers=student_headers)
    assert del_resp.status_code == 200
    assert "deleted" in del_resp.json()["message"]


@pytest.mark.asyncio
async def test_genai_query(async_client: AsyncClient, student_headers, monkeypatch):
    # Mock ask_llm
    async def mock_ask_llm(context: str, query: str):
        return "Recursion is a method where the solution depends on solutions to smaller instances of the same problem."

    from app.services import llm_service
    monkeypatch.setattr(llm_service, "ask_llm", mock_ask_llm)

    payload = {"question": "What is recursion?"}
    resp = await async_client.post("/Genai/api/genai/", json=payload, headers=student_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "Recursion is a method" in data["answer"]
    assert "session_id" in data


@pytest.mark.asyncio
async def test_rag_query_no_docs(async_client: AsyncClient, student_headers):
    payload = {
        "question": "What is the schedule for lab exams?",
        "subject_id": 9999
    }
    resp = await async_client.post("/Genai/api/chat/", json=payload, headers=student_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "No study materials or notes have been uploaded" in data["answer"]


@pytest.mark.asyncio
async def test_chat_group_listing_semester_isolation(
    async_client: AsyncClient,
    student_headers,
    faculty_headers
):
    # Student in Sem 1 only sees groups for Semester 1
    student_groups_resp = await async_client.get("/Genai/api/groups/", headers=student_headers)
    assert student_groups_resp.status_code == 200
    groups = student_groups_resp.json()
    assert len(groups) > 0
    assert all(g["semester"] == 1 for g in groups)

    # Faculty can see all groups
    faculty_groups_resp = await async_client.get("/Genai/api/groups/", headers=faculty_headers)
    assert faculty_groups_resp.status_code == 200
    fac_groups = faculty_groups_resp.json()
    semesters_in_fac = {g["semester"] for g in fac_groups}
    assert 1 in semesters_in_fac
    assert 2 in semesters_in_fac


@pytest.mark.asyncio
async def test_chat_group_message_access_isolation(
    async_client: AsyncClient,
    db_session,
    student_headers,
    student_sem2_headers,
    sem1_subject,
    sem2_subject
):
    # Ensure chat rooms exist for both subjects
    r1 = (await db_session.execute(select(AnonChatRoom).where(AnonChatRoom.subject_id == sem1_subject.id))).scalar_one_or_none()
    if not r1:
        r1 = AnonChatRoom(subject_id=sem1_subject.id)
        db_session.add(r1)

    r2 = (await db_session.execute(select(AnonChatRoom).where(AnonChatRoom.subject_id == sem2_subject.id))).scalar_one_or_none()
    if not r2:
        r2 = AnonChatRoom(subject_id=sem2_subject.id)
        db_session.add(r2)

    await db_session.commit()
    await db_session.refresh(r1)
    await db_session.refresh(r2)

    # Student 1 (Sem 1) sends message to Room 1 (Sem 1) -> Allowed
    send_resp = await async_client.post(
        f"/Genai/api/groups/{r1.id}/messages/",
        json={"content": "Hello classmates from Sem 1!"},
        headers=student_headers
    )
    assert send_resp.status_code == 201
    assert send_resp.json()["content"] == "Hello classmates from Sem 1!"

    # Student 1 (Sem 1) tries to send message to Room 2 (Sem 2) -> 403 Forbidden
    forbidden_send = await async_client.post(
        f"/Genai/api/groups/{r2.id}/messages/",
        json={"content": "Trying to post to another semester!"},
        headers=student_headers
    )
    assert forbidden_send.status_code == 403

    # Student 1 (Sem 1) tries to read Room 2 (Sem 2) messages -> 403 Forbidden
    forbidden_read = await async_client.get(
        f"/Genai/api/groups/{r2.id}/messages/",
        headers=student_headers
    )
    assert forbidden_read.status_code == 403

    # Student 2 (Sem 2) can read Room 2 -> Allowed
    allowed_read = await async_client.get(
        f"/Genai/api/groups/{r2.id}/messages/",
        headers=student_sem2_headers
    )
    assert allowed_read.status_code == 200
