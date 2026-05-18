from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from apps.rhinopeak.data.repositories import permissions_for_user, today_string
from apps.rhinopeak.domain.errors import AppError
from apps.rhinopeak.models import UserAccount, Workspace, WorkspaceRole

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(email: str) -> str:
    return email.strip().lower()


def require_text(data: dict[str, Any], key: str, label: str | None = None) -> str:
    value = str(data.get(key, "")).strip()
    if not value:
        raise AppError(400, f"{label or key} is required.")
    return value


def require_email(email: str) -> str:
    if not EMAIL_RE.match(email):
        raise AppError(400, "Enter a valid email address.")
    return email


def require_permission(user: UserAccount, permission: str) -> None:
    if permission not in permissions_for_user(user):
        raise AppError(403, f"Permission required: {permission}")


def role_by_name(workspace: Workspace, name: str) -> WorkspaceRole | None:
    return WorkspaceRole.objects.filter(workspace=workspace, name__iexact=name).first()


def stock_status(stock: int, reorder_level: int) -> str:
    if stock <= 0:
        return "Out of Stock"
    if stock <= reorder_level:
        return "Low Stock"
    return "In Stock"


def sale_total(items: list[dict[str, Any]], status: str) -> float:
    if status == "Refunded":
        return 0
    total = 0.0
    for item in items:
        total += float(item.get("quantity", 0)) * float(item.get("unitPrice", 0))
        total -= float(item.get("discount", 0))
        total += float(item.get("tax", 0))
    return round(total, 2)


def days_between(start: str, end: str) -> int:
    try:
        start_dt = datetime.fromisoformat(start[:10])
        end_dt = datetime.fromisoformat(end[:10])
        return (end_dt - start_dt).days
    except ValueError:
        return 0


def customer_segment(total_spent: float, orders: int, last_order: str) -> str:
    if total_spent >= 200000 or orders >= 6:
        return "VIP"
    if last_order and days_between(last_order, today_string()) > 21:
        return "At-Risk"
    if orders >= 3:
        return "Regular"
    return "Occasional"
