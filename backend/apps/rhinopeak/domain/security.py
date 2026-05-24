from __future__ import annotations

import hashlib
import hmac
import secrets

from django.contrib.auth.hashers import check_password, make_password


def make_id(prefix: str) -> str:
    return f"{prefix}-{secrets.token_hex(6)}"


def hash_password(password: str, salt_hex: str | None = None) -> tuple[str, str]:
    # We return the same single hash string for both tuple elements
    # to maintain compatibility with existing call sites that expect two returned values (salt, hash).
    # Since check_password handles the whole string, the 'salt' field in the DB becomes redundant but safe.
    hashed = make_password(password)
    return hashed, hashed


def verify_password(password: str, salt_hex: str, digest_hex: str) -> bool:
    # check_password handles the combined hash format automatically, so we just pass digest_hex.
    return check_password(password, digest_hex)


def new_token(prefix: str) -> str:
    return f"{prefix}_{secrets.token_urlsafe(32)}"


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


import jwt
from django.conf import settings
from datetime import datetime, timezone

def generate_jwt_access_token(payload: dict, expires_at: datetime) -> str:
    """Generate a stateless JWT access token containing the given payload."""
    payload = dict(payload)
    payload["exp"] = expires_at
    payload["iat"] = datetime.now(timezone.utc)
    payload["jti"] = secrets.token_hex(16)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")

def decode_jwt_access_token(token: str) -> dict | None:
    """Decode a stateless JWT access token and return its payload. Returns None if invalid or expired."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        return None
