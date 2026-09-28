import pytest
from httpx import AsyncClient
from app.services import otp_service, auth_service


@pytest.mark.asyncio
async def test_register_success(async_client: AsyncClient):
    payload = {
        "username": "new_student_01",
        "email": "new_student01@test.com",
        "password": "Password123!",
        "role": "student",
        "sem": 1,
        "usn": "1MS21CS099",
        "mobile_number": "9998887770"
    }
    response = await async_client.post("/api/register/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["message"] == "Registration successful"
    assert "tokens" in data
    assert "access" in data["tokens"]
    assert "refresh" in data["tokens"]
    assert data["user"]["username"] == "new_student_01"
    assert data["user"]["role"] == "student"


@pytest.mark.asyncio
async def test_register_duplicate_user(async_client: AsyncClient):
    payload = {
        "username": "test_student",  # already exists from conftest
        "email": "another_email@test.com",
        "password": "Password123!",
        "role": "student"
    }
    response = await async_client.post("/api/register/", json=payload)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login_success_triggers_otp(async_client: AsyncClient, student_user):
    payload = {
        "username": "test_student",
        "password": "Secret123!"
    }
    response = await async_client.post("/api/login/", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["requires_otp"] is True
    assert data["user_id"] == student_user.id
    assert "@" in data["email"]


@pytest.mark.asyncio
async def test_login_invalid_credentials(async_client: AsyncClient):
    payload = {
        "username": "test_student",
        "password": "IncorrectPassword!"
    }
    response = await async_client.post("/api/login/", json=payload)
    assert response.status_code == 401
    assert "Invalid credentials" in response.json()["detail"]


@pytest.mark.asyncio
async def test_verify_login_otp_flow(async_client: AsyncClient, student_user):
    # Store a known OTP for student_user
    key = f"login_otp_{student_user.id}"
    otp = "123456"
    otp_service.store_otp(key, otp, ttl=300)

    # 1. Incorrect OTP
    bad_resp = await async_client.post("/api/verify-login-otp/", json={
        "user_id": student_user.id,
        "otp": "999999"
    })
    assert bad_resp.status_code == 400

    # 2. Correct OTP
    good_resp = await async_client.post("/api/verify-login-otp/", json={
        "user_id": student_user.id,
        "otp": otp
    })
    assert good_resp.status_code == 200
    data = good_resp.json()
    assert data["message"] == "Login successful"
    assert "tokens" in data
    assert "access" in data["tokens"]
    assert data["user"]["id"] == student_user.id


@pytest.mark.asyncio
async def test_verify_login_otp_nonexistent_user(async_client: AsyncClient):
    resp = await async_client.post("/api/verify-login-otp/", json={
        "user_id": 99999,
        "otp": "123456"
    })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_resend_login_otp(async_client: AsyncClient, student_user):
    resp = await async_client.post("/api/resend-login-otp/", json={
        "user_id": student_user.id
    })
    assert resp.status_code == 200
    assert "sent" in resp.json()["message"]


@pytest.mark.asyncio
async def test_refresh_token(async_client: AsyncClient, student_user):
    valid_refresh = auth_service.create_refresh_token(user_id=student_user.id)

    # Valid refresh token
    resp = await async_client.post("/api/auth/refresh/", json={"refresh": valid_refresh})
    assert resp.status_code == 200
    assert "access" in resp.json()

    # Invalid refresh token
    invalid_resp = await async_client.post("/api/auth/refresh/", json={"refresh": "invalid.jwt.token"})
    assert invalid_resp.status_code == 401


@pytest.mark.asyncio
async def test_forgot_and_reset_password_flow(async_client: AsyncClient, student_user):
    email = student_user.email

    # 1. Forgot password request
    forgot_resp = await async_client.post("/api/forgot-password/", json={"email": email})
    assert forgot_resp.status_code == 200

    # Mock/retrieve stored OTP
    key = f"forgot_otp_{email}"
    otp = "654321"
    otp_service.store_otp(key, otp, ttl=300)

    # 2. Verify OTP
    verify_resp = await async_client.post("/api/verify-otp/", json={"email": email, "otp": otp})
    assert verify_resp.status_code == 200

    # 3. Reset password
    reset_resp = await async_client.post("/api/reset-password/", json={
        "email": email,
        "otp": otp,
        "new_password": "NewSecretPassword123!"
    })
    assert reset_resp.status_code == 200
    assert "successfully" in reset_resp.json()["message"]


@pytest.mark.asyncio
async def test_send_and_verify_register_otp(async_client: AsyncClient):
    email = "register_otp_user@example.com"
    username = "otp_user_99"

    # 1. Send OTP
    send_resp = await async_client.post("/api/send-register-otp/", json={
        "email": email,
        "username": username
    })
    assert send_resp.status_code == 200

    # Store known OTP
    key = f"register_otp_{email}"
    otp = "445566"
    otp_service.store_otp(key, otp, ttl=300)

    # 2. Verify and register
    verify_resp = await async_client.post("/api/verify-register/", json={
        "email": email,
        "username": username,
        "otp": otp,
        "password": "Password123!",
        "role": "student",
        "sem": 1
    })
    assert verify_resp.status_code == 201
    assert "tokens" in verify_resp.json()


@pytest.mark.asyncio
async def test_gmail_login_otp_flow(async_client: AsyncClient):
    gmail_email = "teststudent@gmail.com"

    # 1. Send OTP
    send_resp = await async_client.post("/api/auth/send-gmail-login-otp/", json={"email": gmail_email})
    assert send_resp.status_code == 200

    key = f"gmail_login_{gmail_email}"
    otp = "778899"
    otp_service.store_otp(key, otp, ttl=600)

    # 2. Verify OTP
    verify_resp = await async_client.post("/api/auth/verify-gmail-login/", json={
        "email": gmail_email,
        "otp": otp,
        "role": "student"
    })
    assert verify_resp.status_code == 200
    data = verify_resp.json()
    assert data["message"] == "Gmail login successful"
    assert "tokens" in data
    assert data["user"]["email"] == gmail_email
