"""
Production-Ready Redis & In-Memory OTP Service with Cryptographic Security,
HMAC Storage, Atomic Lua Scripts, and Abuse Prevention.
"""

import hmac
import hashlib
import secrets
import time
import logging
import threading
from enum import IntEnum
from typing import Dict, Tuple, Optional
import redis
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class OTPResult(IntEnum):
    SUCCESS = 1
    INVALID_OTP = 2
    EXPIRED_OR_NOT_FOUND = 3
    MAX_ATTEMPTS_EXCEEDED = 4
    COOLDOWN_ACTIVE = 5
    RATE_LIMIT_EXCEEDED = 6


# ── Lua Scripts ───────────────────────────────────────────────────────────────

# KEYS[1] = code_key
# KEYS[2] = attempts_key
# ARGV[1] = submitted_hmac
# ARGV[2] = max_attempts
# ARGV[3] = attempt_ttl
LUA_VERIFY_OTP = """
local code_key = KEYS[1]
local attempts_key = KEYS[2]
local submitted_hmac = ARGV[1]
local max_attempts = tonumber(ARGV[2])
local attempt_ttl = tonumber(ARGV[3])

local attempts = tonumber(redis.call('GET', attempts_key) or '0')
if attempts >= max_attempts then
    return 4
end

local stored_hmac = redis.call('GET', code_key)
if not stored_hmac then
    return 3
end

local new_attempts = redis.call('INCR', attempts_key)
if new_attempts == 1 then
    redis.call('EXPIRE', attempts_key, attempt_ttl)
end

if stored_hmac == submitted_hmac then
    redis.call('DEL', code_key)
    redis.call('DEL', attempts_key)
    return 1
else
    if new_attempts >= max_attempts then
        return 4
    else
        return 2
    end
end
"""

# KEYS[1] = cooldown_key
# KEYS[2] = sends_key
# KEYS[3] = code_key
# KEYS[4] = attempts_key
# ARGV[1] = otp_hmac
# ARGV[2] = otp_ttl
# ARGV[3] = cooldown_seconds
# ARGV[4] = max_sends
# ARGV[5] = window_seconds
LUA_SEND_OTP = """
local cooldown_key = KEYS[1]
local sends_key = KEYS[2]
local code_key = KEYS[3]
local attempts_key = KEYS[4]

local otp_hmac = ARGV[1]
local otp_ttl = tonumber(ARGV[2])
local cooldown_seconds = tonumber(ARGV[3])
local max_sends = tonumber(ARGV[4])
local window_seconds = tonumber(ARGV[5])

if redis.call('EXISTS', cooldown_key) == 1 then
    return 2
end

local sends = tonumber(redis.call('GET', sends_key) or '0')
if sends >= max_sends then
    return 3
end

redis.call('SETEX', code_key, otp_ttl, otp_hmac)
redis.call('DEL', attempts_key)
redis.call('SETEX', cooldown_key, cooldown_seconds, '1')

local new_sends = redis.call('INCR', sends_key)
if new_sends == 1 then
    redis.call('EXPIRE', sends_key, window_seconds)
end

return 1
"""


# ── Redis Connection Pool Management ──────────────────────────────────────────

_redis_pool: Optional[redis.ConnectionPool] = None
_pool_lock = threading.Lock()


def get_redis_pool() -> Optional[redis.ConnectionPool]:
    global _redis_pool
    if _redis_pool is not None:
        return _redis_pool

    with _pool_lock:
        if _redis_pool is not None:
            return _redis_pool
        current_settings = get_settings()
        if not current_settings.REDIS_URL:
            return None
        try:
            pool = redis.ConnectionPool.from_url(
                current_settings.REDIS_URL,
                decode_responses=True,
                max_connections=20,
                socket_connect_timeout=1.5,
                socket_timeout=2.0,
            )
            # Test ping
            r = redis.Redis(connection_pool=pool)
            r.ping()
            _redis_pool = pool
            return _redis_pool
        except Exception as e:
            logger.debug(f"[OTP SERVICE] Redis pool initialization failed: {e}. Falling back to in-memory store.")
            return None


def get_redis_client() -> Optional[redis.Redis]:
    pool = get_redis_pool()
    if pool is None:
        return None
    try:
        r = redis.Redis(connection_pool=pool)
        return r
    except Exception:
        return None


# ── Thread-Safe In-Memory Store Fallback ───────────────────────────────────────

_mem_lock = threading.Lock()
# {key: (value, expiry_timestamp)}
_in_mem_store: Dict[str, Tuple[str, float]] = {}
# {key: (count, expiry_timestamp)}
_in_mem_counters: Dict[str, Tuple[int, float]] = {}


def _clean_expired_keys():
    now = time.time()
    for k in list(_in_mem_store.keys()):
        val, exp = _in_mem_store[k]
        if now > exp:
            _in_mem_store.pop(k, None)
    for k in list(_in_mem_counters.keys()):
        count, exp = _in_mem_counters[k]
        if now > exp:
            _in_mem_counters.pop(k, None)


# ── Core Helpers ──────────────────────────────────────────────────────────────

def get_hmac_secret() -> str:
    s = get_settings()
    secret = (s.OTP_SECRET_KEY or s.SECRET_KEY or "smart-college-fallback-otp-secret").strip()
    return secret


def hash_identifier(identifier: str) -> str:
    """Hash raw email or username to prevent key exposure in logs and Redis keys."""
    norm = identifier.strip().lower()
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()[:24]


def compute_otp_hmac(otp: str, secret: Optional[str] = None) -> str:
    """Compute keyed HMAC-SHA256 of the OTP."""
    sec = secret or get_hmac_secret()
    return hmac.new(
        sec.encode("utf-8"),
        otp.strip().encode("utf-8"),
        hashlib.sha256
    ).hexdigest()


def generate_otp(length: int = 6) -> str:
    """Cryptographically secure numeric OTP."""
    digits = [secrets.choice("0123456789") for _ in range(length)]
    return "".join(digits)


def make_keys(purpose: str, identifier: str) -> dict:
    h_id = hash_identifier(identifier)
    return {
        "code": f"otp:code:{purpose}:{h_id}",
        "attempts": f"otp:attempts:{purpose}:{h_id}",
        "cooldown": f"otp:cooldown:{purpose}:{h_id}",
        "sends": f"otp:sends:{purpose}:{h_id}",
    }


# ── Atomic OTP Issuance and Verification (Lua + In-Memory) ────────────────────

def issue_otp(
    identifier: str,
    purpose: str = "register",
    ttl: Optional[int] = None,
    cooldown: Optional[int] = None,
    max_sends: Optional[int] = None,
    window_seconds: Optional[int] = None,
) -> Tuple[str, OTPResult]:
    """
    Atomically issue an OTP with cooldown and rate-limit enforcement.
    Returns (otp_plaintext, OTPResult).
    The plaintext OTP is only returned to the caller so it can be sent via email,
    while Redis stores ONLY the keyed HMAC.
    """
    s = get_settings()
    ttl = ttl or s.OTP_EXPIRE_SECONDS
    cooldown = cooldown or s.OTP_RESEND_COOLDOWN_SECONDS
    max_sends = max_sends or s.OTP_MAX_SENDS_PER_WINDOW
    window_seconds = window_seconds or s.OTP_RATE_LIMIT_WINDOW_SECONDS

    otp = generate_otp(6)
    otp_hmac = compute_otp_hmac(otp)
    keys = make_keys(purpose, identifier)

    r = get_redis_client()
    if r:
        try:
            res = r.eval(
                LUA_SEND_OTP,
                4,
                keys["cooldown"],
                keys["sends"],
                keys["code"],
                keys["attempts"],
                otp_hmac,
                ttl,
                cooldown,
                max_sends,
                window_seconds,
            )
            code = int(res)
            if code == 1:
                return otp, OTPResult.SUCCESS
            elif code == 2:
                return "", OTPResult.COOLDOWN_ACTIVE
            elif code == 3:
                return "", OTPResult.RATE_LIMIT_EXCEEDED
        except Exception as e:
            logger.warning(f"[OTP SERVICE] Redis issue_otp failed: {e}. Using in-memory fallback.")

    # In-memory atomic fallback
    with _mem_lock:
        _clean_expired_keys()
        now = time.time()

        # 1. Cooldown check
        cd_exp = _in_mem_store.get(keys["cooldown"])
        if cd_exp and now < cd_exp[1]:
            return "", OTPResult.COOLDOWN_ACTIVE

        # 2. Send rate limit check
        sends_data = _in_mem_counters.get(keys["sends"])
        if sends_data:
            sends_count, sends_exp = sends_data
            if now < sends_exp and sends_count >= max_sends:
                return "", OTPResult.RATE_LIMIT_EXCEEDED

        # 3. Store OTP HMAC
        _in_mem_store[keys["code"]] = (otp_hmac, now + ttl)
        _in_mem_counters.pop(keys["attempts"], None)

        # 4. Set cooldown
        _in_mem_store[keys["cooldown"]] = ("1", now + cooldown)

        # 5. Increment sends
        if sends_data and now < sends_data[1]:
            _in_mem_counters[keys["sends"]] = (sends_data[0] + 1, sends_data[1])
        else:
            _in_mem_counters[keys["sends"]] = (1, now + window_seconds)

        return otp, OTPResult.SUCCESS


def verify_otp_secure(
    identifier: str,
    submitted_otp: str,
    purpose: str = "register",
    max_attempts: Optional[int] = None,
    attempt_ttl: Optional[int] = None,
) -> OTPResult:
    """
    Atomically verify a submitted OTP against the stored HMAC.
    Enforces maximum attempts and deletes the OTP upon successful match.
    """
    s = get_settings()
    max_attempts = max_attempts or s.OTP_MAX_VERIFY_ATTEMPTS
    attempt_ttl = attempt_ttl or s.OTP_ATTEMPT_LOCKOUT_SECONDS

    submitted_hmac = compute_otp_hmac(submitted_otp)
    keys = make_keys(purpose, identifier)

    r = get_redis_client()
    if r:
        try:
            res = r.eval(
                LUA_VERIFY_OTP,
                2,
                keys["code"],
                keys["attempts"],
                submitted_hmac,
                max_attempts,
                attempt_ttl,
            )
            code = int(res)
            if code == 1:
                return OTPResult.SUCCESS
            elif code == 2:
                return OTPResult.INVALID_OTP
            elif code == 3:
                return OTPResult.EXPIRED_OR_NOT_FOUND
            elif code == 4:
                return OTPResult.MAX_ATTEMPTS_EXCEEDED
        except Exception as e:
            logger.warning(f"[OTP SERVICE] Redis verify_otp_secure failed: {e}. Using in-memory fallback.")

    # In-memory fallback
    with _mem_lock:
        _clean_expired_keys()
        now = time.time()

        # Check attempts
        attempts_data = _in_mem_counters.get(keys["attempts"])
        attempts = 0
        if attempts_data:
            if now < attempts_data[1]:
                attempts = attempts_data[0]
            else:
                _in_mem_counters.pop(keys["attempts"], None)

        if attempts >= max_attempts:
            return OTPResult.MAX_ATTEMPTS_EXCEEDED

        # Check OTP existence
        code_data = _in_mem_store.get(keys["code"])
        if not code_data or now > code_data[1]:
            _in_mem_store.pop(keys["code"], None)
            return OTPResult.EXPIRED_OR_NOT_FOUND

        stored_hmac = code_data[0]
        new_attempts = attempts + 1
        exp_time = attempts_data[1] if (attempts_data and now < attempts_data[1]) else (now + attempt_ttl)
        _in_mem_counters[keys["attempts"]] = (new_attempts, exp_time)

        # Constant time comparison
        if hmac.compare_digest(stored_hmac, submitted_hmac):
            # Success: delete code and attempts
            _in_mem_store.pop(keys["code"], None)
            _in_mem_counters.pop(keys["attempts"], None)
            return OTPResult.SUCCESS
        else:
            if new_attempts >= max_attempts:
                return OTPResult.MAX_ATTEMPTS_EXCEEDED
            return OTPResult.INVALID_OTP


def clear_cooldown(identifier: str, purpose: str = "register"):
    """Clear cooldown to allow immediate resend during error recovery."""
    keys = make_keys(purpose, identifier)
    r = get_redis_client()
    if r:
        try:
            r.delete(keys["cooldown"])
        except Exception:
            pass
    with _mem_lock:
        _in_mem_store.pop(keys["cooldown"], None)


# ── Legacy Compatibility Wrappers ─────────────────────────────────────────────

def store_otp(key: str, otp: str, ttl: int = 600):
    """Legacy helper: stores OTP (using HMAC for security)."""
    otp_hmac = compute_otp_hmac(otp)
    r = get_redis_client()
    if r:
        try:
            r.setex(f"otp:{key}", ttl, otp_hmac)
            return
        except Exception as e:
            logger.warning(f"[OTP SERVICE] Redis setex failed: {e}. Falling back to memory.")

    with _mem_lock:
        _in_mem_store[key] = (otp_hmac, time.time() + ttl)


def verify_otp(key: str, otp: str) -> bool:
    """Legacy helper: verifies submitted OTP against stored HMAC."""
    submitted_hmac = compute_otp_hmac(otp)
    r = get_redis_client()
    if r:
        try:
            stored = r.get(f"otp:{key}")
            if stored is not None:
                # Accept both raw (legacy) and HMAC formats
                return hmac.compare_digest(stored.strip(), submitted_hmac) or (stored.strip() == otp.strip())
        except Exception as e:
            logger.warning(f"[OTP SERVICE] Redis get failed: {e}. Falling back to memory.")

    with _mem_lock:
        data = _in_mem_store.get(key)
        if not data:
            return False
        stored, exp = data
        if time.time() > exp:
            _in_mem_store.pop(key, None)
            return False
        return hmac.compare_digest(stored.strip(), submitted_hmac) or (stored.strip() == otp.strip())


def delete_otp(key: str):
    """Legacy helper: deletes stored OTP."""
    r = get_redis_client()
    if r:
        try:
            r.delete(f"otp:{key}")
        except Exception as e:
            logger.warning(f"[OTP SERVICE] Redis delete failed: {e}")
    with _mem_lock:
        _in_mem_store.pop(key, None)


def set_flag(key: str, ttl: int = 600):
    r = get_redis_client()
    if r:
        try:
            r.setex(f"flag:{key}", ttl, "1")
            return
        except Exception as e:
            logger.warning(f"[OTP SERVICE] Redis set_flag failed: {e}")
    with _mem_lock:
        _in_mem_store[f"flag:{key}"] = ("1", time.time() + ttl)


def check_flag(key: str) -> bool:
    r = get_redis_client()
    if r:
        try:
            val = r.get(f"flag:{key}")
            if val is not None:
                return True
        except Exception as e:
            logger.warning(f"[OTP SERVICE] Redis check_flag failed: {e}")
    with _mem_lock:
        data = _in_mem_store.get(f"flag:{key}")
        if not data:
            return False
        if time.time() > data[1]:
            _in_mem_store.pop(f"flag:{key}", None)
            return False
        return True
