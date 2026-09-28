import pytest
from httpx import AsyncClient
from sqlalchemy import select
from app.models.academic import Subject


@pytest.fixture
async def sample_subject_sem1(db_session) -> Subject:
    res = await db_session.execute(select(Subject).where(Subject.sub_code == "CS101"))
    return res.scalar_one()


@pytest.fixture
async def sample_subject_sem2(db_session) -> Subject:
    res = await db_session.execute(select(Subject).where(Subject.sub_code == "CS201"))
    return res.scalar_one()


@pytest.mark.asyncio
async def test_resource_upload_permissions_and_status(
    async_client: AsyncClient,
    student_headers,
    faculty_headers,
    sample_subject_sem1
):
    # 1. Student uploads -> status PENDING
    student_payload = {
        "title": "Student Handwritten Notes",
        "description": "Notes for Unit 1",
        "subject_id": sample_subject_sem1.id,
        "file_type": "PDF",
        "s3_key": "resources/student_notes.pdf"
    }
    s_resp = await async_client.post("/api/resources/", json=student_payload, headers=student_headers)
    assert s_resp.status_code == 201
    s_data = s_resp.json()
    assert s_data["status"] == "PENDING"
    assert s_data["is_official"] is False
    resource_id = s_data["id"]

    # 2. Student cannot approve resource
    forbidden_approve = await async_client.post(f"/api/resources/{resource_id}/approve/", headers=student_headers)
    assert forbidden_approve.status_code == 403

    # 3. Faculty can approve resource
    faculty_approve = await async_client.post(f"/api/resources/{resource_id}/approve/", headers=faculty_headers)
    assert faculty_approve.status_code == 200
    assert faculty_approve.json()["status"] == "APPROVED"

    # 4. Faculty uploads -> status APPROVED immediately
    faculty_payload = {
        "title": "Official Professor Lecture Slides",
        "description": "Lecture 1 slides",
        "subject_id": sample_subject_sem1.id,
        "file_type": "PPT",
        "s3_key": "resources/prof_slides.ppt"
    }
    f_resp = await async_client.post("/api/resources/", json=faculty_payload, headers=faculty_headers)
    assert f_resp.status_code == 201
    f_data = f_resp.json()
    assert f_data["status"] == "APPROVED"
    assert f_data["is_official"] is True


@pytest.mark.asyncio
async def test_student_and_faculty_dashboards(async_client: AsyncClient, student_headers, faculty_headers):
    # Student accesses student dashboard
    student_dash = await async_client.get("/api/student/dashboard/", headers=student_headers)
    assert student_dash.status_code == 200
    assert "subjects" in student_dash.json()
    assert "current_semester" in student_dash.json()

    # Student cannot access faculty dashboard
    forbidden_fac_dash = await async_client.get("/api/faculty/dashboard/", headers=student_headers)
    assert forbidden_fac_dash.status_code == 403

    # Faculty accesses faculty dashboard
    fac_dash = await async_client.get("/api/faculty/dashboard/", headers=faculty_headers)
    assert fac_dash.status_code == 200
    assert "total_resources" in fac_dash.json()

    # Faculty cannot access student dashboard
    forbidden_stu_dash = await async_client.get("/api/student/dashboard/", headers=faculty_headers)
    assert forbidden_stu_dash.status_code == 403


@pytest.mark.asyncio
async def test_student_cross_semester_isolation(
    async_client: AsyncClient,
    faculty_headers,
    student_headers,
    student_user,
    sample_subject_sem2,
    db_session
):
    # Ensure student is enrolled in Sem 1
    student_user.sem = 1
    db_session.add(student_user)
    await db_session.commit()

    # Faculty creates approved material for Sem 2
    res_resp = await async_client.post("/api/resources/", json={
        "title": "Sem 2 Data Structures Guide",
        "subject_id": sample_subject_sem2.id,
        "file_type": "PDF",
        "s3_key": "resources/sem2_guide.pdf"
    }, headers=faculty_headers)
    assert res_resp.status_code == 201
    sem2_res_id = res_resp.json()["id"]

    # Student enrolled in Sem 1 attempts to access Sem 2 resource
    forbidden_access = await async_client.get(
        f"/api/student/resources/{sem2_res_id}/",
        headers=student_headers
    )
    assert forbidden_access.status_code == 403
    assert "enrolled semester" in forbidden_access.json()["detail"]


@pytest.mark.asyncio
async def test_resource_download(
    async_client: AsyncClient,
    faculty_headers,
    student_headers,
    sample_subject_sem1
):
    # Create approved resource for Sem 1
    res_resp = await async_client.post("/api/resources/", json={
        "title": "Python Basics Cheat Sheet",
        "subject_id": sample_subject_sem1.id,
        "file_type": "PDF",
        "s3_key": "resources/python_cheat_sheet.pdf"
    }, headers=faculty_headers)
    res_id = res_resp.json()["id"]

    # Student downloads resource
    dl_resp = await async_client.post(
        f"/api/student/resources/{res_id}/download/",
        headers=student_headers
    )
    assert dl_resp.status_code == 200
    data = dl_resp.json()
    assert data["message"] == "Downloaded"
    assert "url" in data
    assert data["view_count"] >= 1


@pytest.mark.asyncio
async def test_presign_upload(async_client: AsyncClient, student_headers):
    payload = {
        "filename": "assignment_report.pdf",
        "content_type": "application/pdf",
        "folder": "assignments"
    }
    resp = await async_client.post("/api/s3/presign-upload/", json=payload, headers=student_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "upload_url" in data
    assert "s3_key" in data
    assert data["s3_key"].startswith("assignments/")


@pytest.mark.asyncio
async def test_direct_file_upload(async_client: AsyncClient, faculty_headers, sample_subject_sem1):
    files = {"file": ("lecture_summary.txt", b"Summary of lecture 1", "text/plain")}
    data = {
        "title": "Lecture 1 Summary",
        "description": "Short notes",
        "subject_id": sample_subject_sem1.id,
        "file_type": "PDF"
    }
    resp = await async_client.post("/api/upload-direct/", data=data, files=files, headers=faculty_headers)
    assert resp.status_code == 200
    res_data = resp.json()
    assert res_data["title"] == "Lecture 1 Summary"
    assert res_data["status"] == "APPROVED"


@pytest.mark.asyncio
async def test_delete_resource(async_client: AsyncClient, faculty_headers, sample_subject_sem1):
    res_resp = await async_client.post("/api/resources/", json={
        "title": "Resource To Be Deleted",
        "subject_id": sample_subject_sem1.id,
        "file_type": "PDF",
        "s3_key": "resources/to_delete.pdf"
    }, headers=faculty_headers)
    res_id = res_resp.json()["id"]

    del_resp = await async_client.delete(f"/api/resources/{res_id}/", headers=faculty_headers)
    assert del_resp.status_code == 204

    # Confirm it is gone
    get_resp = await async_client.get(f"/api/resources/{res_id}/")
    assert get_resp.status_code == 404
