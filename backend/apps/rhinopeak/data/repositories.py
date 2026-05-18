from __future__ import annotations

from typing import Any

from django.db import connection
from django.utils import timezone

from apps.rhinopeak.domain.constants import EMPTY_SETTINGS
from apps.rhinopeak.domain.security import make_id
from apps.rhinopeak.models import (
    Business,
    UserAccount,
    Workspace,
    WorkspaceRecord,
    WorkspaceRole,
    WorkspaceSettings,
)


def iso_now() -> str:
    return timezone.now().isoformat(timespec="seconds")


def today_string() -> str:
    return timezone.localdate().isoformat()


def table_counts() -> dict[str, int]:
    return {
        "workspaces": Workspace.objects.count(),
        "users": UserAccount.objects.count(),
        "roles": WorkspaceRole.objects.count(),
        "businesses": Business.objects.count(),
        "records": WorkspaceRecord.objects.count(),
        "sessions": _table_count("rp_sessions"),
        "password_reset_tokens": _table_count("rp_password_reset_tokens"),
    }


def _table_count(table: str) -> int:
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        return int(cursor.fetchone()[0])


def role_payload(role: WorkspaceRole) -> dict[str, Any]:
    return {
        "id": role.id,
        "name": role.name,
        "description": role.description,
        "systemRole": role.system_role,
        "permissions": role.permissions or [],
        "createdAt": role.created_at.isoformat(timespec="seconds"),
    }


def business_payload(business: Business) -> dict[str, str]:
    return {
        "id": business.id,
        "name": business.name,
        "category": business.category,
        "address": business.address,
    }


def settings_payload(settings: WorkspaceSettings | None) -> dict[str, Any]:
    if settings is None:
        return dict(EMPTY_SETTINGS)
    return {
        "businessName": settings.business_name,
        "currency": settings.currency,
        "fiscalYearStart": settings.fiscal_year_start,
        "compactTables": settings.compact_tables,
        "lowStockAlerts": settings.low_stock_alerts,
        "dailySalesSummary": settings.daily_sales_summary,
        "newCustomerSignup": settings.new_customer_signup,
        "twoFactorEnabled": settings.two_factor_enabled,
        "scheduledReports": settings.scheduled_reports,
    }


def permissions_for_user(user: UserAccount) -> list[str]:
    role = user.role_record
    if role is None:
        role = WorkspaceRole.objects.filter(workspace=user.workspace, name__iexact=user.role).first()
    return role.permissions if role else []


def user_payload(user: UserAccount) -> dict[str, Any]:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "roleId": user.role_record_id,
        "permissions": permissions_for_user(user),
        "status": user.status,
        "lastActive": user.last_active,
    }


def current_user_payload(user: UserAccount) -> dict[str, str]:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
    }


def put_record(workspace: Workspace, kind: str, payload: dict[str, Any]) -> dict[str, Any]:
    record_payload = dict(payload)
    record_payload["id"] = str(record_payload.get("id") or make_id(kind[:3].upper()))
    now = timezone.now()
    deleted_at = record_payload.get("deletedAt")
    record, created = WorkspaceRecord.objects.get_or_create(
        workspace=workspace,
        kind=kind,
        id=record_payload["id"],
        defaults={
            "payload": record_payload,
            "created_at": now,
            "updated_at": now,
            "deleted_at": deleted_at,
        },
    )
    if not created:
        record.payload = record_payload
        record.updated_at = now
        record.deleted_at = deleted_at
        record.save(update_fields=["payload", "updated_at", "deleted_at"])
    return record_payload


def get_record(workspace: Workspace, kind: str, record_id: str) -> dict[str, Any] | None:
    row = WorkspaceRecord.objects.filter(workspace=workspace, kind=kind, id=record_id).first()
    return dict(row.payload) if row else None


def list_records(workspace: Workspace, kind: str) -> list[dict[str, Any]]:
    return [
        dict(row.payload)
        for row in WorkspaceRecord.objects.filter(workspace=workspace, kind=kind).order_by("-created_at")
    ]


def patch_record(workspace: Workspace, kind: str, record_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
    existing = get_record(workspace, kind, record_id)
    if existing is None:
        return None
    return put_record(workspace, kind, {**existing, **patch, "id": record_id})


def create_audit(workspace: Workspace, user_name: str, action: str, module: str, detail: str) -> None:
    put_record(
        workspace,
        "audit_logs",
        {
            "id": make_id("AUD"),
            "user": user_name,
            "action": action,
            "module": module,
            "detail": detail,
            "createdAt": iso_now(),
        },
    )


def bootstrap_payload(user: UserAccount) -> dict[str, Any]:
    workspace = user.workspace
    businesses = [business_payload(row) for row in workspace.businesses.order_by("created_at")]
    settings = getattr(workspace, "settings", None)
    return {
        "plan": workspace.plan,
        "billingCycle": workspace.billing_cycle,
        "trialEndsAt": workspace.trial_ends_at.isoformat(),
        "activeBusinessId": businesses[0]["id"] if businesses else "",
        "businesses": businesses,
        "teamMembers": [user_payload(row) for row in workspace.users.select_related("role_record").order_by("created_at")],
        "roleDefinitions": [role_payload(row) for row in workspace.roles.order_by("-system_role", "created_at")],
        "sales": list_records(workspace, "sales"),
        "customers": list_records(workspace, "customers"),
        "inventory": list_records(workspace, "inventory"),
        "inventoryMovements": list_records(workspace, "inventory_movements"),
        "reports": list_records(workspace, "reports"),
        "auditLogs": list_records(workspace, "audit_logs"),
        "billingHistory": list_records(workspace, "billing_history"),
        "platformOrganizations": [],
        "featureFlags": list_records(workspace, "feature_flags"),
        "supportTickets": list_records(workspace, "support_tickets"),
        "settings": settings_payload(settings),
    }


def platform_organizations() -> list[dict[str, Any]]:
    organizations: list[dict[str, Any]] = []
    for workspace in Workspace.objects.prefetch_related("users", "records").order_by("-created_at"):
        users = list(workspace.users.all())
        owner = next((item for item in users if item.role == "Owner"), users[0] if users else None)
        sales_entries = WorkspaceRecord.objects.filter(workspace=workspace, kind="sales").count()
        record_count = WorkspaceRecord.objects.filter(workspace=workspace).count()
        open_tickets = [
            item for item in list_records(workspace, "support_tickets")
            if item.get("status") != "Resolved"
        ]
        last_seen = max((item.last_active for item in users), default=workspace.created_at.isoformat(timespec="seconds"))
        suspended_penalty = 45 if workspace.status == "Suspended" else 0
        health = max(0, min(100, 100 - len(open_tickets) * 12 - suspended_penalty))
        organizations.append(
            {
                "id": workspace.id,
                "name": workspace.name,
                "owner": owner.name if owner else "",
                "email": owner.email if owner else "",
                "market": workspace.address or "Unspecified",
                "category": workspace.category or "General",
                "plan": workspace.plan,
                "status": workspace.status,
                "mrr": 1499 if workspace.plan == "pro" else 0,
                "users": len(users),
                "salesEntries": sales_entries,
                "storageGb": round(record_count * 0.002, 3),
                "healthScore": health,
                "lastSeen": last_seen,
                "joinedAt": workspace.created_at.date().isoformat(),
            }
        )
    return organizations
