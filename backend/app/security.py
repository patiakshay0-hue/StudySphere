"""Password hashing (PBKDF2) and JWT token helpers — minimal dependencies."""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from app import config

_ITERATIONS = 200_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), _ITERATIONS)
    return f"pbkdf2_sha256${_ITERATIONS}${salt}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iters, salt, digest = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(iters))
        return hmac.compare_digest(dk.hex(), digest)
    except (ValueError, AttributeError):
        return False


def create_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(days=config.JWT_EXPIRES_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGO)


def decode_token(token: str) -> int:
    """Return the user_id from a valid token, or raise jwt exceptions."""
    payload = jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGO])
    return int(payload["sub"])
