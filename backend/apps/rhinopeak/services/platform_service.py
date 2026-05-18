from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.rhinopeak.data.repositories import platform_organizations
from apps.rhinopeak.domain.errors import AppError
from apps.rhinopeak.domain.security import hash_password, hash_token, make_id, new_token, verify_password
from apps.rhinopeak.models import PlatformAdmin, PlatformSession, Workspace
from apps.rhinopeak.services.common import normalize_email, require_email, require_text

PLATFORM_ROLES = {"Platform Owner", "Super Admin", "Support Admin"}


def platform_admin_payload(admin: PlatformAdmin) -> dict[str, Any]:
    return {
        "id": admin.id,
        "name": admin.name,
        "email": admin.email,
        "role": admin.role,
        "status": admin.status,
        "lastActive": admin.last_active,
        "createdBy": admin.created_by,
        "createdAt": admin.created_at.isoformat(timespec="seconds"),
    }


def platform_state() -> dict[str, Any]:
    return {
        "ownerExists": PlatformAdmin.objects.filter(role="Platform Owner").exists(),
        "adminCount": PlatformAdmin.objects.count(),
        "setupRequired": not PlatformAdmin.objects.exists(),
        "setupTokenRequired": bool(settings.PLATFORM_SETUP_TOKEN),
    }


def create_platform_session(admin: PlatformAdmin) -> dict[str, str]:
    now = timezone.now()
    access_token = new_token("rp_platform")
    expires_at = now + timedelta(minutes=settings.SESSION_TTL_MINUTES)
    PlatformSession.objects.create(
        access_token_hash=hash_token(access_token),
        admin=admin,
        expires_at=expires_at,
        created_at=now,
    )
    return {
        "accessToken": access_token,
        "expiresAt": expires_at.isoformat(timespec="seconds"),
    }


def authenticate_platform_token(access_token: str | None) -> PlatformAdmin:
    if not access_token:
        raise AppError(401, "Missing platform bearer token.")
    session = (
        PlatformSession.objects.select_related("admin")
        .filter(access_token_hash=hash_token(access_token))
        .first()
    )
    if session is None or session.revoked_at is not None:
        raise AppError(401, "Invalid platform session.")
    if session.expires_at <= timezone.now():
        raise AppError(401, "Platform session expired.")
    if session.admin.status != "Active":
        raise AppError(403, "Platform admin is not active.")
    session.admin.last_active = timezone.now().isoformat(timespec="seconds")
    session.admin.save(update_fields=["last_active"])
    return session.admin


def platform_bootstrap(admin: PlatformAdmin) -> dict[str, Any]:
    admins = PlatformAdmin.objects.order_by("created_at")
    organizations = platform_organizations()
    mrr = sum(float(item.get("mrr", 0)) for item in organizations)
    return {
        "admin": platform_admin_payload(admin),
        "admins": [platform_admin_payload(item) for item in admins],
        "organizations": organizations,
        "metrics": {
            "mrr": mrr,
            "arr": mrr * 12,
            "tenants": len(organizations),
            "activeTenants": len([item for item in organizations if item.get("status") == "Active"]),
            "trialTenants": len([item for item in organizations if item.get("status") == "Trial"]),
            "riskTenants": len([item for item in organizations if item.get("status") in {"At Risk", "Suspended"}]),
            "users": sum(int(item.get("users", 0)) for item in organizations),
            "salesEntries": sum(int(item.get("salesEntries", 0)) for item in organizations),
        },
    }


@transaction.atomic
def setup_platform_owner(data: dict[str, Any]) -> dict[str, Any]:
    if PlatformAdmin.objects.exists():
        raise AppError(409, "Platform owner has already been created.")
    setup_token = str(data.get("setupToken", "")).strip()
    if settings.PLATFORM_SETUP_TOKEN and setup_token != settings.PLATFORM_SETUP_TOKEN:
        raise AppError(403, "Invalid platform setup code.")
    name = require_text(data, "name", "Platform owner name")
    email = require_email(require_text(data, "email", "Email"))
    password = require_text(data, "password", "Password")
    if len(password) < 10:
        raise AppError(400, "Platform password must be at least 10 characters.")
    salt, digest = hash_password(password)
    now = timezone.now()
    admin = PlatformAdmin.objects.create(
        id=make_id("padm"),
        name=name,
        email=email,
        email_normalized=normalize_email(email),
        role="Platform Owner",
        status="Active",
        last_active=now.isoformat(timespec="seconds"),
        password_salt=salt,
        password_hash=digest,
        created_by="system",
        created_at=now,
    )
    return {
        "session": create_platform_session(admin),
        "bootstrap": platform_bootstrap(admin),
    }


def login_platform_admin(data: dict[str, Any]) -> dict[str, Any]:
    email = require_text(data, "email", "Email")
    password = require_text(data, "password", "Password")
    admin = PlatformAdmin.objects.filter(email_normalized=normalize_email(email)).first()
    if admin is None or not verify_password(password, admin.password_salt, admin.password_hash):
        raise AppError(401, "Invalid platform email or password.")
    if admin.status != "Active":
        raise AppError(403, "Platform admin is not active.")
    admin.last_active = timezone.now().isoformat(timespec="seconds")
    admin.save(update_fields=["last_active"])
    return {
        "session": create_platform_session(admin),
        "bootstrap": platform_bootstrap(admin),
    }


def logout_platform_admin(access_token: str | None) -> dict[str, bool]:
    if access_token:
        PlatformSession.objects.filter(access_token_hash=hash_token(access_token)).update(revoked_at=timezone.now())
    return {"ok": True}


def create_platform_admin(actor: PlatformAdmin, data: dict[str, Any]) -> dict[str, Any]:
    if actor.role != "Platform Owner":
        raise AppError(403, "Only the platform owner can create platform admins.")
    name = require_text(data, "name", "Admin name")
    email = require_email(require_text(data, "email", "Email"))
    password = require_text(data, "password", "Temporary password")
    role = str(data.get("role", "Super Admin")).strip() or "Super Admin"
    if role not in PLATFORM_ROLES or role == "Platform Owner":
        raise AppError(400, "Choose Super Admin or Support Admin.")
    if len(password) < 10:
        raise AppError(400, "Temporary password must be at least 10 characters.")
    if PlatformAdmin.objects.filter(email_normalized=normalize_email(email)).exists():
        raise AppError(409, "A platform admin already exists for this email.")
    salt, digest = hash_password(password)
    now = timezone.now()
    admin = PlatformAdmin.objects.create(
        id=make_id("padm"),
        name=name,
        email=email,
        email_normalized=normalize_email(email),
        role=role,
        status="Active",
        last_active="Never",
        password_salt=salt,
        password_hash=digest,
        created_by=actor.email,
        created_at=now,
    )
    return {"admin": platform_admin_payload(admin), "bootstrap": platform_bootstrap(actor)}


def patch_platform_organization(actor: PlatformAdmin, org_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    if actor.role not in {"Platform Owner", "Super Admin"}:
        raise AppError(403, "Platform organization controls require Super Admin access.")
    workspace = Workspace.objects.filter(id=org_id).first()
    if workspace is None:
        raise AppError(404, "Organization not found.")
    allowed = {
        "plan": "plan",
        "status": "status",
        "name": "name",
        "category": "category",
        "address": "address",
    }
    update_fields: list[str] = []
    for api_key, model_field in allowed.items():
        if api_key in patch:
            setattr(workspace, model_field, patch[api_key])
            update_fields.append(model_field)
    if update_fields:
        workspace.save(update_fields=update_fields)
    organization = next((item for item in platform_organizations() if item["id"] == org_id), None)
    return {"organization": organization, "bootstrap": platform_bootstrap(actor)}
