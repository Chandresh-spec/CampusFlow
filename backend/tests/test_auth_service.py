import pytest
from datetime import datetime, timedelta, timezone
from jose import jwt

from app.config import get_settings
from app.services import auth_service

settings = get_settings()


def test_hash_and_verify_password():
    password = "MySecurePassword123!"
    hashed = auth_service.hash_password(password)

    assert hashed != password
    assert hashed.startswith("$2")  # standard bcrypt hash prefix
    assert auth_service.verify_password(password, hashed) is True
    assert auth_service.verify_password("WrongPassword!", hashed) is False


def test_hash_password_unique_salt():
    password = "SamePassword123"
    hash1 = auth_service.hash_password(password)
    hash2 = auth_service.hash_password(password)

    # Different salts must yield different hashes
    assert hash1 != hash2
    assert auth_service.verify_password(password, hash1) is True
    assert auth_service.verify_password(password, hash2) is True


def test_create_and_decode_access_token():
    user_id = 42
    token = auth_service.create_access_token(user_id=user_id)
    assert isinstance(token, str)

    decoded_id = auth_service.decode_access_token(token)
    assert decoded_id == user_id


def test_create_and_decode_refresh_token():
    user_id = 99
    token = auth_service.create_refresh_token(user_id=user_id)
    assert isinstance(token, str)

    decoded_id = auth_service.decode_refresh_token(token)
    assert decoded_id == user_id


def test_token_type_mismatch():
    user_id = 7
    access_token = auth_service.create_access_token(user_id=user_id)
    refresh_token = auth_service.create_refresh_token(user_id=user_id)

    # Cannot decode access token with decode_refresh_token
    with pytest.raises(ValueError, match="Invalid token type"):
        auth_service.decode_refresh_token(access_token)

    # Cannot decode refresh token with decode_access_token
    with pytest.raises(ValueError, match="Invalid token type"):
        auth_service.decode_access_token(refresh_token)


def test_decode_invalid_signature():
    fake_token = jwt.encode(
        {"sub": "1", "type": "access"},
        "wrong-secret-key",
        algorithm=settings.ALGORITHM
    )

    with pytest.raises(ValueError):
        auth_service.decode_access_token(fake_token)


def test_decode_expired_token():
    expired_time = datetime.now(timezone.utc) - timedelta(minutes=10)
    expired_token = jwt.encode(
        {"sub": "1", "type": "access", "exp": expired_time},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )

    with pytest.raises(ValueError):
        auth_service.decode_access_token(expired_token)
