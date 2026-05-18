from __future__ import annotations

import secrets
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.rhinopeak.data.repositories import create_audit, current_user_payload
from apps.rhinopeak.domain.errors import AppError
from apps.rhinopeak.domain.security import hash_password, hash_token, make_id, new_token, verify_password
from apps.rhinopeak.models import PasswordResetToken, SessionToken, UserAccount
from apps.rhinopeak.services.common import normalize_email, require_email, require_text
from apps.rhinopeak.services.workspace_service import bootstrap_for_user, create_workspace_with_owner


def create_session(user: UserAccount) -> dict[str, str]:
    now = timezone.now()
    access_token = new_token("rp_access")
    refresh_token = new_token("rp_refresh")
    expires_at = now + timedelta(minutes=settings.SESSION_TTL_MINUTES)
    refresh_expires_at = now + timedelta(days=settings.REFRESH_TTL_DAYS)
    SessionToken.objects.create(
        access_token_hash=hash_token(access_token),
        refresh_token_hash=hash_token(refresh_token),
        user=user,
        expires_at=expires_at,
        refresh_expires_at=refresh_expires_at,
        created_at=now,
    )
    return {
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "expiresAt": expires_at.isoformat(timespec="seconds"),
    }


def authenticate_access_token(access_token: str | None) -> UserAccount:
    if not access_token:
        raise AppError(401, "Missing access token.")
    session = (
        SessionToken.objects.select_related("user", "user__workspace", "user__role_record")
        .filter(access_token_hash=hash_token(access_token))
        .first()
    )
    if session is None or session.revoked_at is not None:
        raise AppError(401, "Invalid session.")
    if session.expires_at <= timezone.now():
        raise AppError(401, "Session expired.")
    session.user.last_active = timezone.now().isoformat(timespec="seconds")
    session.user.save(update_fields=["last_active"])
    return session.user


def auth_response(user: UserAccount, session: dict[str, str]) -> dict[str, Any]:
    return {
        "user": current_user_payload(user),
        "session": session,
        "bootstrap": bootstrap_for_user(user),
    }


def register_user(data: dict[str, Any]) -> dict[str, Any]:
    name = require_text(data, "name", "Owner name")
    email = require_email(require_text(data, "email", "Email"))
    password = require_text(data, "password", "Password")
    business_name = require_text(data, "businessName", "Business name")
    if len(password) < 8:
        raise AppError(400, "Password must be at least 8 characters.")
    email_normalized = normalize_email(email)
    if UserAccount.objects.filter(email_normalized=email_normalized).exists():
        raise AppError(409, "An account already exists for this email.")
    salt, digest = hash_password(password)
    user = create_workspace_with_owner(
        owner_name=name,
        owner_email=email,
        password_salt=salt,
        password_hash=digest,
        business_name=business_name,
    )
    return auth_response(user, create_session(user))


def login_user(data: dict[str, Any]) -> dict[str, Any]:
    email = require_text(data, "email", "Email")
    password = require_text(data, "password", "Password")
    user = (
        UserAccount.objects.select_related("workspace", "role_record")
        .filter(email_normalized=normalize_email(email))
        .first()
    )
    if user is None or not verify_password(password, user.password_salt, user.password_hash):
        raise AppError(401, "Invalid email or password.")
    if user.status != "Active":
        raise AppError(403, "Your account is not active yet.")
    user.last_active = timezone.now().isoformat(timespec="seconds")
    user.save(update_fields=["last_active"])
    create_audit(user.workspace, user.name, "Logged in", "Auth", f"{user.email} signed in.")
    return auth_response(user, create_session(user))


@transaction.atomic
def refresh_session(data: dict[str, Any]) -> dict[str, Any]:
    refresh_token = require_text(data, "refreshToken", "Refresh token")
    session = (
        SessionToken.objects.select_related("user", "user__workspace", "user__role_record")
        .filter(refresh_token_hash=hash_token(refresh_token))
        .first()
    )
    if session is None or session.revoked_at is not None:
        raise AppError(401, "Invalid refresh token.")
    if session.refresh_expires_at <= timezone.now():
        raise AppError(401, "Refresh token expired.")
    session.revoked_at = timezone.now()
    session.save(update_fields=["revoked_at"])
    return auth_response(session.user, create_session(session.user))


def logout(access_token: str | None, data: dict[str, Any]) -> dict[str, bool]:
    now = timezone.now()
    if access_token:
        SessionToken.objects.filter(access_token_hash=hash_token(access_token)).update(revoked_at=now)
    refresh_token = data.get("refreshToken")
    if refresh_token:
        SessionToken.objects.filter(refresh_token_hash=hash_token(str(refresh_token))).update(revoked_at=now)
    return {"ok": True}


def request_password_reset(data: dict[str, Any]) -> dict[str, Any]:
    email = require_text(data, "email", "Email")
    response: dict[str, Any] = {"ok": True, "message": "If the email exists, a reset code has been issued."}
    user = UserAccount.objects.filter(email_normalized=normalize_email(email)).first()
    if user is None:
        return response
    token = f"{secrets.randbelow(1_000_000):06d}"
    PasswordResetToken.objects.create(
        id=make_id("rst"),
        user=user,
        token_hash=hash_token(token),
        expires_at=timezone.now() + timedelta(minutes=settings.PASSWORD_RESET_TTL_MINUTES),
        created_at=timezone.now(),
    )
    if settings.EXPOSE_RESET_TOKEN:
        response["resetToken"] = token
    return response


@transaction.atomic
def reset_password(data: dict[str, Any]) -> dict[str, Any]:
    email = require_text(data, "email", "Email")
    token = require_text(data, "token", "Reset code")
    password = require_text(data, "password", "Password")
    if len(password) < 8:
        raise AppError(400, "Password must be at least 8 characters.")
    user = UserAccount.objects.select_related("workspace").filter(email_normalized=normalize_email(email)).first()
    if user is None:
        raise AppError(400, "Invalid reset request.")
    reset_token = (
        PasswordResetToken.objects.filter(user=user, token_hash=hash_token(token), used_at__isnull=True)
        .order_by("-created_at")
        .first()
    )
    if reset_token is None or reset_token.expires_at <= timezone.now():
        raise AppError(400, "Reset code is invalid or expired.")
    salt, digest = hash_password(password)
    user.password_salt = salt
    user.password_hash = digest
    user.status = "Active"
    user.save(update_fields=["password_salt", "password_hash", "status"])
    reset_token.used_at = timezone.now()
    reset_token.save(update_fields=["used_at"])
    SessionToken.objects.filter(user=user).update(revoked_at=timezone.now())
    create_audit(user.workspace, user.name, "Reset password", "Auth", f"{user.email} changed password.")
    return {"ok": True, "message": "Password updated."}
