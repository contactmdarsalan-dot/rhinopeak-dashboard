from __future__ import annotations

from typing import Any

from django.db import transaction

from apps.rhinopeak.data.repositories import create_audit, settings_payload
from apps.rhinopeak.models import UserAccount, WorkspaceSettings
from apps.rhinopeak.services.common import require_permission


@transaction.atomic
def update_settings(user: UserAccount, patch: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "settings.manage")
    settings, _ = WorkspaceSettings.objects.get_or_create(workspace=user.workspace)
    field_map = {
        "businessName": "business_name",
        "currency": "currency",
        "fiscalYearStart": "fiscal_year_start",
        "compactTables": "compact_tables",
        "lowStockAlerts": "low_stock_alerts",
        "dailySalesSummary": "daily_sales_summary",
        "newCustomerSignup": "new_customer_signup",
        "twoFactorEnabled": "two_factor_enabled",
        "scheduledReports": "scheduled_reports",
    }
    update_fields: list[str] = []
    for api_key, model_field in field_map.items():
        if api_key in patch:
            setattr(settings, model_field, patch[api_key])
            update_fields.append(model_field)
    if update_fields:
        settings.save(update_fields=update_fields)
    if "businessName" in patch:
        user.workspace.name = str(patch["businessName"])
        user.workspace.save(update_fields=["name"])
    create_audit(user.workspace, user.name, "Updated settings", "Settings", "Business settings changed.")
    return {"settings": settings_payload(settings)}
