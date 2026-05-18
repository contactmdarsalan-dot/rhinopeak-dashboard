from __future__ import annotations

from typing import Any

from django.db import transaction

from apps.rhinopeak.data.repositories import bootstrap_payload, create_audit, put_record
from apps.rhinopeak.domain.errors import AppError
from apps.rhinopeak.models import UserAccount
from apps.rhinopeak.services.common import require_permission


@transaction.atomic
def update_billing_plan(user: UserAccount, payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "billing.manage")
    plan = str(payload.get("plan", "free"))
    billing_cycle = str(payload.get("billingCycle", "monthly"))
    if plan not in {"free", "pro"}:
        raise AppError(400, "Plan must be free or pro.")
    if billing_cycle not in {"monthly", "annual"}:
        raise AppError(400, "Billing cycle must be monthly or annual.")
    user.workspace.plan = plan
    user.workspace.billing_cycle = billing_cycle
    user.workspace.status = "Active"
    user.workspace.save(update_fields=["plan", "billing_cycle", "status"])
    record = payload.get("record")
    if isinstance(record, dict):
        put_record(user.workspace, "billing_history", record)
    create_audit(user.workspace, user.name, "Updated billing", "Billing", f"{plan} {billing_cycle} plan selected.")
    return {"bootstrap": bootstrap_payload(user)}
