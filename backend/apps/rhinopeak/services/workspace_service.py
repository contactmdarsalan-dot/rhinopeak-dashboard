from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.db import transaction
from django.utils import timezone

from apps.rhinopeak.data.repositories import bootstrap_payload, create_audit
from apps.rhinopeak.domain.constants import EMPTY_SETTINGS, SYSTEM_ROLES
from apps.rhinopeak.domain.security import make_id
from apps.rhinopeak.models import Business, UserAccount, Workspace, WorkspaceRole, WorkspaceSettings


def create_default_roles(workspace: Workspace) -> dict[str, WorkspaceRole]:
    now = timezone.now()
    roles: dict[str, WorkspaceRole] = {}
    for item in SYSTEM_ROLES:
        role = WorkspaceRole.objects.create(
            id=f"{workspace.id}-role-{item['slug']}",
            workspace=workspace,
            name=item["name"],
            description=item["description"],
            system_role=True,
            permissions=item["permissions"],
            created_at=now,
        )
        roles[role.name] = role
    return roles


@transaction.atomic
def create_workspace_with_owner(
    *,
    owner_name: str,
    owner_email: str,
    password_salt: str,
    password_hash: str,
    business_name: str,
) -> UserAccount:
    now = timezone.now()
    workspace = Workspace.objects.create(
        id=make_id("ws"),
        name=business_name,
        category="General",
        address="",
        plan="free",
        billing_cycle="monthly",
        status="Trial",
        trial_ends_at=timezone.localdate() + timedelta(days=14),
        created_at=now,
    )
    roles = create_default_roles(workspace)
    Business.objects.create(
        id=make_id("biz"),
        workspace=workspace,
        name=business_name,
        category="General",
        address="",
        created_at=now,
    )
    settings = {**EMPTY_SETTINGS, "businessName": business_name}
    WorkspaceSettings.objects.create(
        workspace=workspace,
        business_name=settings["businessName"],
        currency=settings["currency"],
        fiscal_year_start=settings["fiscalYearStart"],
        compact_tables=settings["compactTables"],
        low_stock_alerts=settings["lowStockAlerts"],
        daily_sales_summary=settings["dailySalesSummary"],
        new_customer_signup=settings["newCustomerSignup"],
        two_factor_enabled=settings["twoFactorEnabled"],
        scheduled_reports=settings["scheduledReports"],
    )
    user = UserAccount.objects.create(
        id=make_id("usr"),
        workspace=workspace,
        role_record=roles["Owner"],
        name=owner_name,
        email=owner_email,
        email_normalized=owner_email.lower(),
        role="Owner",
        status="Active",
        last_active=now.isoformat(timespec="seconds"),
        password_salt=password_salt,
        password_hash=password_hash,
        created_at=now,
    )
    create_audit(workspace, owner_name, "Created workspace", "Auth", f"{business_name} workspace was created.")
    return user


def bootstrap_for_user(user: UserAccount) -> dict[str, Any]:
    return bootstrap_payload(user)
