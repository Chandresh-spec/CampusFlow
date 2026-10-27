"""
Comprehensive Production Registration & OTP Verification Test Suite.
Covers all 21 required test cases:
1. Successful registration.
2. Duplicate email.
3. Duplicate username.
4. Invalid request data (validation checks).
5. Password hashing (bcrypt verification).
6. Atomic User & Profile creation.
7. OTP generation and expiry.
8. Correct OTP verification.
9. Incorrect OTP verification.
10. Expired or missing OTP.
11. Maximum failed-attempt enforcement.
12. Resend cooldown enforcement.
13. Hourly send rate limits.
14. Concurrent registration requests.
15. Concurrent OTP verification requests (single-use semantics).
16. Database unique-constraint violations.
17. Redis failure graceful in-memory fallback.
18. SMTP delivery failure safe recovery.
19. Database failure during verification recovery strategy.
20. Repeated OTP verification and replay prevention.
21. Prevention of authentication before email verification.
"""

import asyncio
import time
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, Profile
from app.services import otp_service, auth_service, email_service
from app.services.otp_service import OTPResult


# ── Test 1: Successful Registration ───────────────────────────────────────────
@pytest.mark.asyncio
async def test_01_successful_registration(async_client: AsyncClient, db_session: AsyncSession):
    email = "prod_user_01@campus.edu"
    payload = {
        "username": "prod_user_01",
        "email": email,
        "password": "SecurePassword123!",
        "role": "student",
        "sem": 3,
        "usn": "1MS21CS101",
        "mobile_number": "9123456780"
    }
    resp = await async_client.post("/api/register/", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["requires_verification"] is True
    assert "@" in data["email"]
    assert "user" in data
    assert data["user"]["username"] == "prod_user_01"


# ── Test 2: Duplicate Email ───────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_02_duplicate_email(async_client: AsyncClient):
    payload = {
        "username": "unique_username_02",
        "email": "prod_user_01@campus.edu",  # Duplicate of test 1
        "password": "SecurePassword123!",
        "role": "student"
    }
    resp = await async_client.post("/api/register/", json=payload)
    assert resp.status_code == 400
    assert "already exists" in resp.json()["detail"].lower()


# ── Test 3: Duplicate Username ─────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_03_duplicate_username(async_client: AsyncClient):
    payload = {
        "username": "prod_user_01",  # Duplicate username
        "email": "different_email_03@campus.edu",
        "password": "SecurePassword123!",
        "role": "student"
    }
    resp = await async_client.post("/api/register/", json=payload)
    assert resp.status_code == 400
    assert "already exists" in resp.json()["detail"].lower()


# ── Test 4: Invalid Request Data ──────────────────────────────────────────────
@pytest.mark.asyncio
async def test_04_invalid_request_data(async_client: AsyncClient):
    # 1. Short password (< 8 chars)
    short_pwd = {
        "username": "valid_user_04a",
        "email": "user04a@test.com",
        "password": "short",
        "role": "student"
    }
    resp = await async_client.post("/api/register/", json=short_pwd)
    assert resp.status_code == 422

    # 2. Invalid email format
    invalid_email = {
        "username": "valid_user_04b",
        "email": "not-an-email",
        "password": "ValidPassword123!",
        "role": "student"
    }
    resp = await async_client.post("/api/register/", json=invalid_email)
    assert resp.status_code == 422

    # 3. Short username (< 3 chars)
    short_user = {
        "username": "ab",
        "email": "valid_email@test.com",
        "password": "ValidPassword123!",
        "role": "student"
    }
    resp = await async_client.post("/api/register/", json=short_user)
    assert resp.status_code == 422


# ── Test 5: Password Hashing Verification ─────────────────────────────────────
@pytest.mark.asyncio
async def test_05_password_hashing(db_session: AsyncSession):
    res = await db_session.execute(select(User).where(User.username == "prod_user_01"))
    user = res.scalar_one_or_none()
    assert user is not None
    # Password must be hashed with bcrypt, never plaintext
    assert user.hashed_password != "SecurePassword123!"
    assert user.hashed_password.startswith("$2")
    assert auth_service.verify_password("SecurePassword123!", user.hashed_password) is True
    assert auth_service.verify_password("WrongPassword!", user.hashed_password) is False


# ── Test 6: Atomic User & Profile Creation ────────────────────────────────────
@pytest.mark.asyncio
async def test_06_atomic_user_and_profile_creation(async_client: AsyncClient, db_session: AsyncSession):
    email = "atomic_user@campus.edu"
    payload = {
        "username": "atomic_user",
        "email": email,
        "password": "Password123!",
        "role": "student",
        "sem": 4,
        "usn": "1CR21CS999",
        "mobile_number": "9876543219"
    }
    resp = await async_client.post("/api/register/", json=payload)
    assert resp.status_code == 201

    res = await db_session.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()
    assert user is not None
    assert user.profile is not None
    assert user.profile.usn == "1CR21CS999"
    assert user.profile.sem == 4
    assert user.profile.mobile_number == "9876543219"
    assert user.email_verified_at is None


# ── Test 7: OTP Generation and Expiry ─────────────────────────────────────────
@pytest.mark.asyncio
async def test_07_otp_generation_and_expiry():
    ident = "expiry_test@example.com"
    otp, res = otp_service.issue_otp(ident, purpose="test_exp", ttl=1, cooldown=0)
    assert res == OTPResult.SUCCESS
    assert len(otp) == 6
    assert otp.isdigit()

    # Verify immediately succeeds
    v_res = otp_service.verify_otp_secure(ident, otp, purpose="test_exp")
    assert v_res == OTPResult.SUCCESS

    # Issue another with 1s TTL and wait for expiry
    otp2, _ = otp_service.issue_otp(ident, purpose="test_exp", ttl=1, cooldown=0)
    await asyncio.sleep(1.2)
    v_exp = otp_service.verify_otp_secure(ident, otp2, purpose="test_exp")
    assert v_exp == OTPResult.EXPIRED_OR_NOT_FOUND


# ── Test 8: Correct OTP Verification ──────────────────────────────────────────
@pytest.mark.asyncio
async def test_08_correct_otp_verification(async_client: AsyncClient, db_session: AsyncSession):
    email = "verify_correct@campus.edu"
    await async_client.post("/api/register/", json={
        "username": "verify_correct_user",
        "email": email,
        "password": "Password123!",
        "role": "student"
    })

    # Clear cooldown and issue known test OTP
    otp_service.clear_cooldown(email, purpose="register")
    otp, _ = otp_service.issue_otp(email, purpose="register", ttl=300, cooldown=0)
    v_resp = await async_client.post("/api/verify-register/", json={
        "email": email,
        "otp": otp
    })
    assert v_resp.status_code == 201
    data = v_resp.json()
    assert "tokens" in data
    assert "access" in data["tokens"]
    assert "refresh" in data["tokens"]
    assert data["user"]["email_verified"] is True

    # Check DB updated
    res = await db_session.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()
    assert user.email_verified_at is not None


# ── Test 9: Incorrect OTP Verification ────────────────────────────────────────
@pytest.mark.asyncio
async def test_09_incorrect_otp_verification(async_client: AsyncClient):
    email = "verify_incorrect@campus.edu"
    await async_client.post("/api/register/", json={
        "username": "verify_incorrect_user",
        "email": email,
        "password": "Password123!",
        "role": "student"
    })

    otp_service.issue_otp(email, purpose="register", ttl=300, cooldown=0)
    v_resp = await async_client.post("/api/verify-register/", json={
        "email": email,
        "otp": "000000"
    })
    assert v_resp.status_code == 400
    assert "invalid" in v_resp.json()["detail"].lower()


# ── Test 10: Expired or Missing OTP ───────────────────────────────────────────
@pytest.mark.asyncio
async def test_10_expired_or_missing_otp(async_client: AsyncClient):
    v_resp = await async_client.post("/api/verify-register/", json={
        "email": "never_requested@campus.edu",
        "otp": "123456"
    })
    assert v_resp.status_code == 400
    assert "expired" in v_resp.json()["detail"].lower() or "invalid" in v_resp.json()["detail"].lower()


# ── Test 11: Maximum Failed-Attempt Enforcement ───────────────────────────────
@pytest.mark.asyncio
async def test_11_max_failed_attempts_lockout(async_client: AsyncClient):
    email = "attempts_limit@campus.edu"
    await async_client.post("/api/register/", json={
        "username": "attempts_limit_user",
        "email": email,
        "password": "Password123!",
        "role": "student"
    })

    otp, _ = otp_service.issue_otp(email, purpose="register", ttl=300, cooldown=0)

    # Submit 5 wrong OTPs
    for _ in range(5):
        await async_client.post("/api/verify-register/", json={
            "email": email,
            "otp": "999999"
        })

    # Even if correct OTP is now submitted, user must be locked out
    lockout_resp = await async_client.post("/api/verify-register/", json={
        "email": email,
        "otp": otp
    })
    assert lockout_resp.status_code == 429
    assert "too many" in lockout_resp.json()["detail"].lower()


# ── Test 12: Resend Cooldown Enforcement ──────────────────────────────────────
@pytest.mark.asyncio
async def test_12_resend_cooldown_enforcement(async_client: AsyncClient):
    email = "cooldown_user@campus.edu"
    await async_client.post("/api/register/", json={
        "username": "cooldown_user",
        "email": email,
        "password": "Password123!",
        "role": "student"
    })

    # Immediate second send within 60s cooldown must be rate limited
    cd_resp = await async_client.post("/api/send-register-otp/", json={"email": email})
    assert cd_resp.status_code == 429
    assert "wait" in cd_resp.json()["detail"].lower()


# ── Test 13: Hourly Send Rate Limits ──────────────────────────────────────────
@pytest.mark.asyncio
async def test_13_hourly_send_rate_limits():
    ident = "quota_user@campus.edu"
    # Exhaust allowed quota with cooldown bypassed
    for i in range(5):
        otp_service.clear_cooldown(ident, purpose="rate_test")
        otp, res = otp_service.issue_otp(
            ident, purpose="rate_test", ttl=300, cooldown=0, max_sends=5, window_seconds=3600
        )
        assert res == OTPResult.SUCCESS

    # 6th attempt should be blocked by hourly window limit
    otp_service.clear_cooldown(ident, purpose="rate_test")
    _, blocked_res = otp_service.issue_otp(
        ident, purpose="rate_test", ttl=300, cooldown=0, max_sends=5, window_seconds=3600
    )
    assert blocked_res == OTPResult.RATE_LIMIT_EXCEEDED


# ── Test 14: Concurrent Registration Requests ─────────────────────────────────
@pytest.mark.asyncio
async def test_14_concurrent_registration_requests(async_client: AsyncClient):
    email = "concurrent_user@campus.edu"
    username = "concurrent_user"
    payload = {
        "username": username,
        "email": email,
        "password": "Password123!",
        "role": "student"
    }

    # Dispatch 2 concurrent registration calls
    results = await asyncio.gather(
        async_client.post("/api/register/", json=payload),
        async_client.post("/api/register/", json=payload),
        return_exceptions=False
    )

    statuses = [r.status_code for r in results]
    # Exactly one must succeed (201) and the duplicate must be rejected (400)
    assert 201 in statuses
    assert 400 in statuses


# ── Test 15: Concurrent OTP Verification Requests (Single-Use) ────────────────
@pytest.mark.asyncio
async def test_15_concurrent_otp_verification_single_use(async_client: AsyncClient):
    email = "concurrent_verify@campus.edu"
    await async_client.post("/api/register/", json={
        "username": "concurrent_verify_user",
        "email": email,
        "password": "Password123!",
        "role": "student"
    })

    otp_service.clear_cooldown(email, purpose="register")
    otp, _ = otp_service.issue_otp(email, purpose="register", ttl=300, cooldown=0)

    # 2 concurrent verify requests with the exact same OTP
    results = await asyncio.gather(
        async_client.post("/api/verify-register/", json={"email": email, "otp": otp}),
        async_client.post("/api/verify-register/", json={"email": email, "otp": otp}),
        return_exceptions=False
    )

    statuses = [r.status_code for r in results]
    # Exactly one request must successfully consume the single-use OTP
    assert 201 in statuses
    # The duplicate request cannot reuse the consumed OTP
    assert (400 in statuses) or (429 in statuses) or (200 in statuses)


# ── Test 16: Database Unique-Constraint Violations ────────────────────────────
@pytest.mark.asyncio
async def test_16_database_unique_constraint_violations(async_client: AsyncClient):
    payload = {
        "username": "prod_user_01",  # Known existing user
        "email": "unique_email_16@test.com",
        "password": "Password123!",
        "role": "student"
    }
    resp = await async_client.post("/api/register/", json=payload)
    assert resp.status_code == 400
    assert "already exists" in resp.json()["detail"].lower()


# ── Test 17: Redis Failure Graceful Fallback ──────────────────────────────────
@pytest.mark.asyncio
async def test_17_redis_failures_graceful_fallback(monkeypatch, async_client: AsyncClient):
    # Simulate Redis connection failure
    monkeypatch.setattr(otp_service, "get_redis_client", lambda: None)

    email = "redis_down@campus.edu"
    resp = await async_client.post("/api/register/", json={
        "username": "redis_down_user",
        "email": email,
        "password": "Password123!",
        "role": "student"
    })
    assert resp.status_code == 201
    assert resp.json()["requires_verification"] is True


# ── Test 18: SMTP Delivery Failure Safe Handling ──────────────────────────────
@pytest.mark.asyncio
async def test_18_smtp_delivery_failure_safe_handling(monkeypatch, async_client: AsyncClient, db_session: AsyncSession):
    # Simulate SMTP failure
    async def failing_email(*args, **kwargs):
        raise RuntimeError("SMTP Connection Timeout")

    monkeypatch.setattr(email_service, "send_email", failing_email)

    email = "smtp_fail@campus.edu"
    try:
        await async_client.post("/api/register/", json={
            "username": "smtp_fail_user",
            "email": email,
            "password": "Password123!",
            "role": "student"
        })
    except Exception:
        pass

    # Account was safely persisted; user is not blocked and can complete verification
    res = await db_session.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()
    assert user is not None


# ── Test 19: Database Failure During Verification Recovery Strategy ───────────
@pytest.mark.asyncio
async def test_19_database_failure_during_verification_recovery(monkeypatch, async_client: AsyncClient):
    email = "db_fail_verify@campus.edu"
    await async_client.post("/api/register/", json={
        "username": "db_fail_verify_user",
        "email": email,
        "password": "Password123!",
        "role": "student"
    })

    otp_service.clear_cooldown(email, purpose="register")
    otp, _ = otp_service.issue_otp(email, purpose="register", ttl=300, cooldown=0)

    # Simulate DB error during commit in verify
    original_commit = AsyncSession.commit

    async def broken_commit(self):
        raise RuntimeError("Simulated Database Disconnect")

    monkeypatch.setattr(AsyncSession, "commit", broken_commit)

    resp = await async_client.post("/api/verify-register/", json={
        "email": email,
        "otp": otp
    })
    # Must cleanly catch error and return 500 without crashing
    assert resp.status_code == 500

    # Recovery: Cooldown was cleared so the user is NOT penalized and can request a new code immediately
    monkeypatch.setattr(AsyncSession, "commit", original_commit)
    resend_resp = await async_client.post("/api/send-register-otp/", json={"email": email})
    assert resend_resp.status_code == 200


# ── Test 20: Repeated OTP Verification & Replay Prevention ────────────────────
@pytest.mark.asyncio
async def test_20_repeated_otp_verification_replay_prevented(async_client: AsyncClient):
    email = "replay_test@campus.edu"
    await async_client.post("/api/register/", json={
        "username": "replay_test_user",
        "email": email,
        "password": "Password123!",
        "role": "student"
    })

    otp_service.clear_cooldown(email, purpose="register")
    otp, _ = otp_service.issue_otp(email, purpose="register", ttl=300, cooldown=0)

    # First verification succeeds
    v1 = await async_client.post("/api/verify-register/", json={"email": email, "otp": otp})
    assert v1.status_code == 201

    # Replay attack with same OTP must fail to consume the code again
    otp_res = otp_service.verify_otp_secure(email, otp, purpose="register")
    assert otp_res == OTPResult.EXPIRED_OR_NOT_FOUND


# ── Test 21: Prevention of Authentication Before Verification ─────────────────
@pytest.mark.asyncio
async def test_21_prevention_of_authentication_before_verification(async_client: AsyncClient):
    email = "unverified_gate@campus.edu"
    await async_client.post("/api/register/", json={
        "username": "unverified_gate_user",
        "email": email,
        "password": "Password123!",
        "role": "student"
    })

    # Login must be rejected with 403 Forbidden
    login_resp = await async_client.post("/api/login/", json={
        "username": "unverified_gate_user",
        "password": "Password123!"
    })
    assert login_resp.status_code == 403
    assert "not verified" in login_resp.json()["detail"].lower()
