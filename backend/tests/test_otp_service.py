import time
import pytest
from app.services import otp_service


def test_generate_otp():
    otp = otp_service.generate_otp()
    assert isinstance(otp, str)
    assert len(otp) == 6
    assert otp.isdigit()


def test_store_and_verify_otp():
    key = "test_user_123"
    otp = "654321"

    otp_service.store_otp(key, otp, ttl=60)
    assert otp_service.verify_otp(key, "654321") is True
    assert otp_service.verify_otp(key, "000000") is False


def test_verify_nonexistent_otp():
    assert otp_service.verify_otp("non_existent_key_999", "123456") is False


def test_delete_otp():
    key = "test_user_delete"
    otp = "112233"

    otp_service.store_otp(key, otp, ttl=60)
    assert otp_service.verify_otp(key, otp) is True

    otp_service.delete_otp(key)
    assert otp_service.verify_otp(key, otp) is False


def test_otp_expiration():
    key = "test_user_expired"
    otp = "998877"

    # Set very short TTL (1 second), wait for expiry
    otp_service.store_otp(key, otp, ttl=1)
    time.sleep(1.2)
    assert otp_service.verify_otp(key, otp) is False


def test_set_and_check_flag():
    key = "verified_email_test@example.com"

    assert otp_service.check_flag(key) is False

    otp_service.set_flag(key, ttl=60)
    assert otp_service.check_flag(key) is True


def test_flag_expiration():
    key = "flag_expire_test"

    otp_service.set_flag(key, ttl=1)
    assert otp_service.check_flag(key) is True
    time.sleep(1.2)
    assert otp_service.check_flag(key) is False
