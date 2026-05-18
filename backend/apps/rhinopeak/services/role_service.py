from __future__ import annotations

from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.rhinopeak.data.repositories import create_audit, role_payload, user_payload
from apps.rhinopeak.domain.errors import AppError
from apps.rhinopeak.domain.security import hash_password, make_id, new_token
from apps.rhinopeak.models import UserAccount, WorkspaceRole
from apps.rhinopeak.services.common import normalize_email, require_email, require_permission, require_text, role_by_name


def create_role(user: UserAccount, payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "roles.manage")
    name = require_text(payload, "name", "Role name")
    permissions = payload.get("permissions")
    if not isinstance(permissions, list) or not permissions:
        raise AppError(400, "Role requires at least one permission.")
    if role_by_name(user.workspace, name):
        raise AppError(409, "Role already exists.")
    role = WorkspaceRole.objects.create(
        id=str(payload.get("id") or make_id("role")),
        workspace=user.workspace,
        name=name,
        description=str(payload.get("description", "")),
        system_role=False,
        permissions=permissions,
        created_at=timezone.now(),
    )
    create_audit(user.workspace, user.name, "Created role", "Team", f"{name} role created.")
    return {"role": role_payload(role)}


@transaction.atomic
def update_role(user: UserAccount, role_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "roles.manage")
    role = WorkspaceRole.objects.filter(id=role_id, workspace=user.workspace).first()
    if role is None:
        raise AppError(404, "Role not found.")
    if role.name == "Owner":
        raise AppError(400, "Owner role cannot be edited.")
    old_name = role.name
    if not role.system_role and patch.get("name"):
        role.name = str(patch["name"]).strip()
    if "description" in patch:
        role.description = str(patch["description"])
    if "permissions" in patch and isinstance(patch["permissions"], list):
        role.permissions = patch["permissions"]
    role.save()
    if role.name != old_name:
        UserAccount.objects.filter(workspace=user.workspace, role=old_name).update(role=role.name)
    create_audit(user.workspace, user.name, "Updated role", "Team", f"{old_name} role changed.")
    return {"role": role_payload(role)}


@transaction.atomic
def delete_role(user: UserAccount, role_id: str) -> dict[str, Any]:
    require_permission(user, "roles.manage")
    role = WorkspaceRole.objects.filter(id=role_id, workspace=user.workspace).first()
    if role is None:
        raise AppError(404, "Role not found.")
    if role.system_role:
        raise AppError(400, "System roles cannot be deleted.")
    fallback = role_by_name(user.workspace, "Staff")
    UserAccount.objects.filter(workspace=user.workspace, role_record=role).update(role="Staff", role_record=fallback)
    role.delete()
    create_audit(user.workspace, user.name, "Deleted role", "Team", f"{role.name} role deleted.")
    return {"ok": True, "fallbackRole": "Staff"}


def invite_user(user: UserAccount, payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "users.invite")
    name = require_text(payload, "name", "Name")
    email = require_email(require_text(payload, "email", "Email"))
    role_name = require_text(payload, "role", "Role")
    if UserAccount.objects.filter(email_normalized=normalize_email(email)).exists():
        raise AppError(409, "A user already exists for this email.")
    role = role_by_name(user.workspace, role_name)
    if role is None:
        raise AppError(400, "Role not found.")
    salt, digest = hash_password(new_token("invite"))
    invited = UserAccount.objects.create(
        id=str(payload.get("id") or make_id("usr")),
        workspace=user.workspace,
        role_record=role,
        name=name,
        email=email,
        email_normalized=normalize_email(email),
        role=role.name,
        status="Invited",
        last_active="Pending invite",
        password_salt=salt,
        password_hash=digest,
        created_at=timezone.now(),
    )
    create_audit(user.workspace, user.name, "Invited user", "Team", f"{email} invited as {role.name}.")
    return {"user": user_payload(invited)}


def update_user_role(user: UserAccount, target_user_id: str, role_name: str) -> dict[str, Any]:
    require_permission(user, "users.manage")
    target = UserAccount.objects.filter(id=target_user_id, workspace=user.workspace).first()
    if target is None:
        raise AppError(404, "User not found.")
    role = role_by_name(user.workspace, role_name)
    if role is None:
        raise AppError(400, "Role not found.")
    target.role = role.name
    target.role_record = role
    target.save(update_fields=["role", "role_record"])
    create_audit(user.workspace, user.name, "Changed user role", "Team", f"{target.email} changed to {role.name}.")
    return {"user": user_payload(target)}
