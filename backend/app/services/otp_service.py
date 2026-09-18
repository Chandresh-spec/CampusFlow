import random
import time
from typing import Dict, Tuple

# In-memory stores
_otp_store: Dict[str, Tuple[str, float]] = {}
_verified_flags: Dict[str, float] = {}

def generate_otp() -> str:
    return f"{random.randint(0, 999999):06d}"

def store_otp(key: str, otp: str, ttl: int = 600):
    expiry = time.time() + ttl
    _otp_store[key] = (otp, expiry)

def verify_otp(key: str, otp: str) -> bool:
    if key not in _otp_store:
        return False
    stored_otp, expiry = _otp_store[key]
    if time.time() > expiry:
        del _otp_store[key]
        return False
    return stored_otp == otp

def delete_otp(key: str):
    _otp_store.pop(key, None)

def set_flag(key: str, ttl: int = 600):
    expiry = time.time() + ttl
    _verified_flags[key] = expiry

def check_flag(key: str) -> bool:
    if key not in _verified_flags:
        return False
    expiry = _verified_flags[key]
    if time.time() > expiry:
        del _verified_flags[key]
        return False
    return True
