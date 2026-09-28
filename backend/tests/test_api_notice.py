import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_notice_role_permissions(async_client: AsyncClient, student_headers, faculty_headers):
    payload = {
        "title": "Semester Exam Schedule Announced",
        "content": "Final exams begin on the 10th of next month.",
        "semester": 1
    }

    # Student cannot create notice
    student_resp = await async_client.post("/notice/api/notices/", json=payload, headers=student_headers)
    assert student_resp.status_code == 403

    # Faculty can create notice
    faculty_resp = await async_client.post("/notice/api/notices/", json=payload, headers=faculty_headers)
    assert faculty_resp.status_code == 201
    data = faculty_resp.json()
    assert data["title"] == payload["title"]
    assert data["semester"] == 1


@pytest.mark.asyncio
async def test_student_notice_semester_scoping(async_client: AsyncClient, faculty_headers, student_headers, student_sem2_headers):
    # Faculty creates notice for Sem 1
    n1_resp = await async_client.post("/notice/api/notices/", json={
        "title": "Sem 1 Workshop",
        "content": "Python workshop for Sem 1 students",
        "semester": 1
    }, headers=faculty_headers)
    assert n1_resp.status_code == 201
    n1_id = n1_resp.json()["id"]

    # Faculty creates notice for Sem 2
    n2_resp = await async_client.post("/notice/api/notices/", json={
        "title": "Sem 2 Hackathon",
        "content": "Data structures hackathon for Sem 2",
        "semester": 2
    }, headers=faculty_headers)
    assert n2_resp.status_code == 201
    n2_id = n2_resp.json()["id"]

    # Student in Sem 1 sees Sem 1 notice, but NOT Sem 2 notice
    sem1_resp = await async_client.get("/notice/api/notices/", headers=student_headers)
    assert sem1_resp.status_code == 200
    sem1_ids = [n["id"] for n in sem1_resp.json()]
    assert n1_id in sem1_ids
    assert n2_id not in sem1_ids

    # Student in Sem 2 sees Sem 2 notice, but NOT Sem 1 notice
    sem2_resp = await async_client.get("/notice/api/notices/", headers=student_sem2_headers)
    assert sem2_resp.status_code == 200
    sem2_ids = [n["id"] for n in sem2_resp.json()]
    assert n2_id in sem2_ids
    assert n1_id not in sem2_ids


@pytest.mark.asyncio
async def test_dismiss_notice(async_client: AsyncClient, faculty_headers, student_headers):
    # Create a notice for Sem 1
    create_resp = await async_client.post("/notice/api/notices/", json={
        "title": "Notice To Dismiss",
        "content": "This notice will be dismissed by student",
        "semester": 1
    }, headers=faculty_headers)
    notice_id = create_resp.json()["id"]

    # Student dismisses notice
    dismiss_resp = await async_client.post(f"/notice/api/notices/{notice_id}/dismiss/", headers=student_headers)
    assert dismiss_resp.status_code == 200

    # Student checks notices list -> dismissed notice must not appear
    list_resp = await async_client.get("/notice/api/notices/", headers=student_headers)
    active_ids = [n["id"] for n in list_resp.json()]
    assert notice_id not in active_ids


@pytest.mark.asyncio
async def test_update_and_delete_notice(async_client: AsyncClient, faculty_headers, student_headers):
    # Faculty creates notice
    create_resp = await async_client.post("/notice/api/notices/", json={
        "title": "Notice to Update",
        "content": "Initial content",
        "semester": None
    }, headers=faculty_headers)
    notice_id = create_resp.json()["id"]

    # Student cannot update faculty notice
    forbidden_update = await async_client.patch(
        f"/notice/api/notices/{notice_id}/",
        json={"title": "Hacked Title"},
        headers=student_headers
    )
    assert forbidden_update.status_code == 403

    # Faculty author can update
    success_update = await async_client.patch(
        f"/notice/api/notices/{notice_id}/",
        json={"title": "Updated by Faculty"},
        headers=faculty_headers
    )
    assert success_update.status_code == 200
    assert success_update.json()["title"] == "Updated by Faculty"

    # Faculty author can delete
    del_resp = await async_client.delete(f"/notice/api/notices/{notice_id}/", headers=faculty_headers)
    assert del_resp.status_code == 204
