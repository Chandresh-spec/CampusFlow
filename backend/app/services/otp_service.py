import random
import time
import logging
from typing import Dict, Tuple, Optional
import redis
from app.config import get_settings

logger = logging.getLogger(__name__)

# In-memory stores fallback if Redis is unreachable
_otp_store: Dict[str, Tuple[str, float]] = {}
_verified_flags: Dict[str, float] = {}
_redis_client: Optional[redis.Redis] = None

def get_redis_client() -> Optional[redis.Redis]:
    global _redis_client
    if _redis_client is not None:
        try:
            _redis_client.ping()
            return _redis_client
        except Exception:
            _redis_client = None

    settings = get_settings()
    if not settings.REDIS_URL:
        return None

    try:
        r = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=1.5,
            socket_timeout=2.0
        )
        r.ping()
        _redis_client = r
        return _redis_client
    except Exception as e:
        # Fall back gracefully to memory if Redis is not currently running
        return None

def generate_otp() -> str:
    return f"{random.randint(0, 999999):06d}"

def store_otp(key: str, otp: str, ttl: int = 600):
    r = get_redis_client()
    if r:
        try:
            r.setex(f"otp:{key}", ttl, str(otp))
            return
        except Exception as e:
            logger.warning(f"[OTP SERVICE] Redis setex failed: {e}. Falling back to memory.")
    
    expiry = time.time() + ttl
    _otp_store[key] = (str(otp), expiry)

def verify_otp(key: str, otp: str) -> bool:
    r = get_redis_client()
    if r:
        try:
            val = r.get(f"otp:{key}")
            if val is not None:
                return str(val).strip() == str(otp).strip()
        except Exception as e:
            logger.warning(f"[OTP SERVICE] Redis get failed: {e}. Falling back to memory.")

    if key not in _otp_store:
        return False
    stored_otp, expiry = _otp_store[key]
    if time.time() > expiry:
        del _otp_store[key]
        return False
    return str(stored_otp).strip() == str(otp).strip()

def delete_otp(key: str):
    r = get_redis_client()
    if r:
        try:
            r.delete(f"otp:{key}")
        except Exception as e:
            logger.warning(f"[OTP SERVICE] Redis delete failed: {e}")
    _otp_store.pop(key, None)

def set_flag(key: str, ttl: int = 600):
    r = get_redis_client()
    if r:
        try:
            r.setex(f"flag:{key}", ttl, "1")
            return
        except Exception as e:
            logger.warning(f"[OTP SERVICE] Redis set_flag failed: {e}")
    expiry = time.time() + ttl
    _verified_flags[key] = expiry

def check_flag(key: str) -> bool:
    r = get_redis_client()
    if r:
        try:
            val = r.get(f"flag:{key}")
            if val is not None:
                return True
        except Exception as e:
            logger.warning(f"[OTP SERVICE] Redis check_flag failed: {e}")
    if key not in _verified_flags:
        return False
    expiry = _verified_flags[key]
    if time.time() > expiry:
        del _verified_flags[key]
        return False
    return True
