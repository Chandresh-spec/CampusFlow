import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_semesters(async_client: AsyncClient):
    response = await async_client.get("/academic/api/semesters/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 8
    sem_numbers = [s["sem_nmbr"] for s in data]
    assert 1 in sem_numbers
    assert 8 in sem_numbers


@pytest.mark.asyncio
async def test_get_semester(async_client: AsyncClient):
    # Get existing semester
    response = await async_client.get("/academic/api/semesters/1/")
    assert response.status_code == 200
    assert response.json()["sem_nmbr"] == 1

    # Non-existent semester
    bad_resp = await async_client.get("/academic/api/semesters/9999/")
    assert bad_resp.status_code == 404


@pytest.mark.asyncio
async def test_list_subjects(async_client: AsyncClient):
    response = await async_client.get("/academic/api/subjects/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_list_subjects_filter_by_semester(async_client: AsyncClient):
    response = await async_client.get("/academic/api/subjects/?semester=1")
    assert response.status_code == 200
    data = response.json()
    assert all(sub["sem"]["sem_nmbr"] == 1 for sub in data if sub.get("sem"))


@pytest.mark.asyncio
async def test_student_auto_filtered_subjects(async_client: AsyncClient, student_headers):
    # Student in sem 1 should automatically receive subjects for semester 1
    response = await async_client.get("/academic/api/subjects/", headers=student_headers)
    assert response.status_code == 200
    data = response.json()
    for sub in data:
        if sub.get("sem"):
            assert sub["sem"]["sem_nmbr"] == 1


@pytest.mark.asyncio
async def test_create_subject_admin_only(async_client: AsyncClient, admin_headers, student_headers):
    payload = {
        "sub_code": "TEST999",
        "sub_name": "Distributed Cloud Systems",
        "sem_id": 1
    }

    # Student forbidden
    student_resp = await async_client.post("/academic/api/subjects/", json=payload, headers=student_headers)
    assert student_resp.status_code == 403

    # Admin allowed
    admin_resp = await async_client.post("/academic/api/subjects/", json=payload, headers=admin_headers)
    assert admin_resp.status_code == 201
    created_id = admin_resp.json()["id"]

    # Retrieve created subject
    get_resp = await async_client.get(f"/academic/api/subjects/{created_id}/")
    assert get_resp.status_code == 200
    assert get_resp.json()["sub_code"] == "TEST999"

    # Update subject as admin
    patch_resp = await async_client.patch(
        f"/academic/api/subjects/{created_id}/",
        json={"sub_name": "Updated Distributed Systems"},
        headers=admin_headers
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["sub_name"] == "Updated Distributed Systems"

    # Delete subject as admin
    del_resp = await async_client.delete(f"/academic/api/subjects/{created_id}/", headers=admin_headers)
    assert del_resp.status_code == 204
