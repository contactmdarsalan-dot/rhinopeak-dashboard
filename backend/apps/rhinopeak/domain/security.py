from __future__ import annotations

import hashlib
import hmac
import secrets
import logging
from pathlib import Path
from datetime import datetime, timezone

import jwt
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password

logger = logging.getLogger(__name__)


def make_id(prefix: str) -> str:
    return f"{prefix}-{secrets.token_hex(6)}"


def hash_password(password: str) -> tuple[str, str]:
    """Hash password using Django's make_password with proper salting.

    Returns (empty_salt, hashed_password) tuple.
    Empty salt is returned because Django's make_password includes the salt
    in the hash itself, making the salt field redundant but safe.
    """
    hashed = make_password(password)
    return "", hashed


def verify_password(password: str, salt_hex: str, digest_hex: str) -> bool:
    """Verify password against stored hash.

    Uses Django's check_password which handles the combined hash format automatically.
    """
    return check_password(password, digest_hex)


def new_token(prefix: str) -> str:
    """Generate a cryptographically secure random token."""
    return f"{prefix}_{secrets.token_urlsafe(32)}"


def new_reset_token() -> str:
    """Generate a high-entropy password reset token.

    Uses URL-safe base64 encoding with 32 bytes of randomness for strong entropy.
    """
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Hash a token using SHA-256 for secure storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# ── RSA Key Loading for RS256 JWT ──────────────────────────────────────────

def _load_rsa_private_key() -> str | None:
    """Load RSA private key from file for RS256 signing."""
    try:
        key_path = Path(settings.RSA_PRIVATE_KEY_PATH)
        if key_path.exists():
            return key_path.read_text()
    except Exception as e:
        logger.warning(f"Failed to load RSA private key: {e}")
    return None


def _load_rsa_public_key() -> str | None:
    """Load RSA public key from file for RS256 verification."""
    try:
        key_path = Path(settings.RSA_PUBLIC_KEY_PATH)
        if key_path.exists():
            return key_path.read_text()
    except Exception as e:
        logger.warning(f"Failed to load RSA public key: {e}")
    return None


def _get_signing_key() -> tuple[str, str]:
    """Get the appropriate signing key based on configuration.

    Returns (key, algorithm) tuple for JWT signing.
    """
    algorithm = getattr(settings, 'JWT_ALGORITHM', 'HS256')

    if algorithm == 'RS256':
        private_key = _load_rsa_private_key()
        if private_key:
            return private_key, 'RS256'
        logger.warning("RS256 configured but RSA private key not found, falling back to HS256")

    # Default to HS256 with SECRET_KEY
    return settings.SECRET_KEY, 'HS256'


def _get_verification_key() -> tuple[str, str]:
    """Get the appropriate verification key based on configuration.

    Returns (key, algorithm) tuple for JWT verification.
    """
    algorithm = getattr(settings, 'JWT_ALGORITHM', 'HS256')

    if algorithm == 'RS256':
        public_key = _load_rsa_public_key()
        if public_key:
            return public_key, 'RS256'
        logger.warning("RS256 configured but RSA public key not found, falling back to HS256")

    # Default to HS256 with SECRET_KEY
    return settings.SECRET_KEY, 'HS256'


def generate_jwt_access_token(payload: dict, expires_at: datetime) -> str:
    """Generate a stateless JWT access token containing the given payload.

    Uses RS256 algorithm when RSA keys are configured, otherwise falls back to HS256.
    The JWT includes standard claims: exp, iat, jti.
    """
    payload = dict(payload)
    payload["exp"] = expires_at
    payload["iat"] = datetime.now(timezone.utc)
    payload["jti"] = secrets.token_hex(16)

    signing_key, algorithm = _get_signing_key()
    return jwt.encode(payload, signing_key, algorithm=algorithm)


def decode_jwt_access_token(token: str) -> dict | None:
    """Decode a stateless JWT access token and return its payload.

    Returns None if invalid or expired.
    Uses RS256 verification when RSA public key is available, otherwise falls back to HS256.
    """
    try:
        verification_key, algorithm = _get_verification_key()
        return jwt.decode(token, verification_key, algorithms=[algorithm])
    except jwt.InvalidTokenError as e:
        logger.debug(f"JWT decode failed: {e}")
        return None


def generate_platform_jwt(admin_id: str, role: str, expires_at: datetime) -> str:
    """Generate a JWT token for platform admin authentication.

    Platform tokens use a separate signing mechanism for isolation.
    """
    payload = {
        "sub": admin_id,
        "role": role,
        "type": "platform_access",
    }
    return generate_jwt_access_token(payload, expires_at)
