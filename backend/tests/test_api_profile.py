import pytest
import io
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_profile_unauthorized(async_client: AsyncClient):
    response = await async_client.get("/api/profile/")
    assert response.status_code in [401, 403]


@pytest.mark.asyncio
async def test_get_profile_authenticated(async_client: AsyncClient, student_headers, student_user):
    response = await async_client.get("/api/profile/", headers=student_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == student_user.id
    assert data["username"] == student_user.username
    assert data["role"] == "student"


@pytest.mark.asyncio
async def test_update_profile(async_client: AsyncClient, student_headers):
    payload = {
        "bio": "Passionate CS Student and open-source enthusiast",
        "mobile_number": "9123456789",
        "sem": 1
    }
    response = await async_client.patch("/api/profile/", json=payload, headers=student_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["bio"] == payload["bio"]
    assert data["mobile_number"] == payload["mobile_number"]
    assert data["sem"] == 1


@pytest.mark.asyncio
async def test_upload_avatar_valid(async_client: AsyncClient, student_headers):
    # Create fake image bytes
    fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
    files = {"file": ("avatar.png", fake_png, "image/png")}

    response = await async_client.post("/api/profile/avatar/", files=files, headers=student_headers)
    assert response.status_code == 200
    data = response.json()
    assert "avatar_url" in data
    assert "Profile photo updated successfully" in data["message"]


@pytest.mark.asyncio
async def test_upload_avatar_invalid_file_type(async_client: AsyncClient, student_headers):
    files = {"file": ("script.sh", b"#!/bin/bash", "application/x-sh")}
    response = await async_client.post("/api/profile/avatar/", files=files, headers=student_headers)
    assert response.status_code == 400
    assert "Only image files" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_avatar(async_client: AsyncClient, student_headers):
    response = await async_client.delete("/api/profile/avatar/", headers=student_headers)
    assert response.status_code == 200
    data = response.json()
    assert "Avatar removed successfully" in data["message"]
    assert data["user"]["avatar_url"] is None


@pytest.mark.asyncio
async def test_get_avatar_nonexistent_user(async_client: AsyncClient):
    response = await async_client.get("/api/profile/avatar/999999/")
    assert response.status_code == 404
