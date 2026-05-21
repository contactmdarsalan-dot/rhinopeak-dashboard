from __future__ import annotations

import secrets
import re
from datetime import datetime, timedelta
from typing import Any

from django.conf import settings
from django.utils import timezone
from pymongo.errors import DuplicateKeyError

from apps.rhinopeak.data.mongo import collection, mongo_counts, ping_mongo, strip_mongo_id
from apps.rhinopeak.domain.constants import EMPTY_SETTINGS, SYSTEM_ROLES
from apps.rhinopeak.domain.errors import AppError
from apps.rhinopeak.domain.security import hash_password, hash_token, make_id, new_token, verify_password
from apps.rhinopeak.models.mongo_schema import ENTITY_SCHEMAS, RECORD_SCHEMA_BY_KIND

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

PLATFORM_FEATURE_FLAG_DEFAULTS = [
    {
        "id": "pf-tenant-invites",
        "name": "Tenant self-service invites",
        "area": "Platform",
        "description": "Allow tenant owners to invite teammates without platform support.",
        "enabled": True,
        "rollout": 100,
        "risk": "Low",
    },
    {
        "id": "pf-nepali-localization",
        "name": "Nepali localization",
        "area": "Platform",
        "description": "Expose Nepali website, auth, dashboard labels, and local formats.",
        "enabled": True,
        "rollout": 100,
        "risk": "Low",
    },
    {
        "id": "pf-mobile-api",
        "name": "Mobile API access",
        "area": "Security",
        "description": "Enable mobile bootstrap and token-based API access for workspace apps.",
        "enabled": True,
        "rollout": 75,
        "risk": "Medium",
    },
    {
        "id": "pf-advanced-reports",
        "name": "Advanced reports",
        "area": "Reports",
        "description": "Roll out scheduled reports, exports, and executive report templates.",
        "enabled": False,
        "rollout": 35,
        "risk": "Medium",
    },
    {
        "id": "pf-billing-automation",
        "name": "Billing automation",
        "area": "Billing",
        "description": "Automate subscription state, payment reminders, and plan enforcement.",
        "enabled": False,
        "rollout": 20,
        "risk": "High",
    },
]

PLATFORM_ADMIN_ROLES = {"Platform Owner", "Super Admin", "Support Admin"}
PLATFORM_ADMIN_STATUSES = {"Active", "Invited", "Suspended"}
PLATFORM_ORG_STATUSES = {"Active", "Trial", "At Risk", "Suspended", "Expired"}
PLATFORM_PLANS = {"free", "pro"}
SUPPORT_PRIORITIES = {"Low", "Medium", "High", "Critical"}
SUPPORT_STATUSES = {"Open", "Watching", "Resolved"}
FEATURE_AREAS = {"Billing", "Reports", "Analytics", "Security", "Platform"}
FEATURE_RISKS = {"Low", "Medium", "High"}
DEFAULT_PLATFORM_FLAG_IDS = {item["id"] for item in PLATFORM_FEATURE_FLAG_DEFAULTS}


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


def stock_status(stock: float, reorder_level: float) -> str:
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


def normalize_sale_items(user: dict[str, Any], items: Any) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    if not isinstance(items, list):
        return normalized
    for item in items:
        if not isinstance(item, dict):
            continue
        product_id = str(item.get("productId", "")).strip()
        product = get_record(user["workspaceId"], "inventory", product_id) if product_id else None
        normalized.append(
            {
                "productId": product_id,
                "productName": str(item.get("productName") or (product or {}).get("name", "")).strip(),
                "sku": str(item.get("sku") or (product or {}).get("sku", "")).strip(),
                "quantity": float(item.get("quantity", 0)),
                "unit": str(item.get("unit") or (product or {}).get("unit", "pcs")).strip() or "pcs",
                "unitPrice": float(item.get("unitPrice", (product or {}).get("price", 0))),
                "costPrice": float(item.get("costPrice", (product or {}).get("costPrice", 0))),
                "discount": float(item.get("discount", 0)),
                "tax": float(item.get("tax", 0)),
            }
        )
    return normalized


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


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "item"


def active_business_id_for(user: dict[str, Any]) -> str:
    business = collection("businesses").find_one({"workspaceId": user["workspaceId"], "isPrimary": True})
    if not business:
        business = collection("businesses").find_one({"workspaceId": user["workspaceId"]})
    return str((business or {}).get("id", ""))


def normalize_record_payload(kind: str, payload: dict[str, Any], existing_payload: dict[str, Any] | None = None) -> dict[str, Any]:
    now = iso_now()
    record = dict(payload)
    if existing_payload and existing_payload.get("createdAt") and not record.get("createdAt"):
        record["createdAt"] = existing_payload["createdAt"]

    if kind == "sales":
        record.setdefault("invoiceNo", f"RP-{record.get('id', make_id('SALE'))}")
        record.setdefault("businessId", "")
        record.setdefault("customerId", "")
        record.setdefault("customer", "Walk-in customer")
        record.setdefault("products", "")
        record.setdefault("items", [])
        normalized_items = []
        for item in record.get("items", []):
            if not isinstance(item, dict):
                continue
            quantity = float(item.get("quantity", 0))
            unit_price = float(item.get("unitPrice", 0))
            discount = float(item.get("discount", 0))
            tax = float(item.get("tax", 0))
            normalized_items.append(
                {
                    "productId": str(item.get("productId", "")),
                    "productName": str(item.get("productName", "")),
                    "sku": str(item.get("sku", "")),
                    "quantity": quantity,
                    "unit": str(item.get("unit", "pcs")) or "pcs",
                    "unitPrice": unit_price,
                    "costPrice": float(item.get("costPrice", 0)),
                    "discount": discount,
                    "tax": tax,
                    "lineTotal": round(quantity * unit_price - discount + tax, 2),
                }
            )
        record["items"] = normalized_items
        record.setdefault("subtotal", round(sum(item["quantity"] * item["unitPrice"] for item in normalized_items), 2))
        record.setdefault("discountTotal", round(sum(item["discount"] for item in normalized_items), 2))
        record.setdefault("taxTotal", round(sum(item["tax"] for item in normalized_items), 2))
        record.setdefault("taxableAmount", round(record["subtotal"] - record["discountTotal"], 2))
        record.setdefault("vatAmount", record["taxTotal"])
        record.setdefault("amount", round(record["subtotal"] - record["discountTotal"] + record["taxTotal"], 2))
        record.setdefault("currency", "NPR")
        record.setdefault("payment", "Cash")
        record.setdefault("status", "Completed")
        record.setdefault("date", today_string())
        record.setdefault("invoiceType", "Tax Invoice")
        record.setdefault("buyerPan", "")
        record.setdefault("creditDueDate", "")
        record.setdefault("creditClearedAt", "")
        record.setdefault("notes", "")
        record.setdefault("createdBy", "")
        record.setdefault("auditTrail", [])

    if kind == "customers":
        record.setdefault("name", "Customer")
        record.setdefault("company", "")
        record.setdefault("email", "")
        record.setdefault("phone", "")
        record.setdefault("address", "")
        record.setdefault("source", "Manual")
        record.setdefault("taxId", "")
        record.setdefault("notes", "")
        record.setdefault("tags", [])
        record.setdefault("creditLimit", 0)
        record.setdefault("balance", 0)
        record.setdefault("totalSpent", 0)
        record.setdefault("orders", 0)
        record.setdefault("lastOrder", "")
        record.setdefault("segment", "Occasional")
        record.setdefault("birthday", "")
        record.setdefault("preferredLanguage", "en")

    if kind == "suppliers":
        record.setdefault("name", "Supplier")
        record.setdefault("phone", "")
        record.setdefault("email", "")
        record.setdefault("address", "")
        record.setdefault("pan", "")
        record.setdefault("contactPerson", "")
        record.setdefault("payableBalance", 0)
        record.setdefault("notes", "")

    if kind == "credit_ledger":
        record.setdefault("customerId", "")
        record.setdefault("customerName", "")
        record.setdefault("saleId", "")
        record.setdefault("invoiceNo", "")
        record.setdefault("type", "Credit Sale")
        record.setdefault("amount", 0)
        record.setdefault("date", today_string())
        record.setdefault("dueDate", "")
        record.setdefault("paymentMethod", "Cash")
        record.setdefault("note", "")
        record.setdefault("createdBy", "")

    if kind == "parties":
        record.setdefault("name", "Party")
        record.setdefault("type", "Customer")
        record.setdefault("phone", "")
        record.setdefault("email", "")
        record.setdefault("address", "")
        record.setdefault("pan", "")
        record.setdefault("openingBalance", 0)
        record.setdefault("creditLimit", 0)
        record.setdefault("dueDays", 0)
        record.setdefault("notes", "")
        record.setdefault("balance", float(record.get("openingBalance", 0)))

    if kind == "party_ledger":
        record.setdefault("partyId", "")
        record.setdefault("partyName", "")
        record.setdefault("direction", "Receivable")
        record.setdefault("type", "Sale Credit")
        record.setdefault("amount", 0)
        record.setdefault("date", today_string())
        record.setdefault("dueDate", "")
        record.setdefault("referenceId", "")
        record.setdefault("note", "")
        record.setdefault("createdBy", "")

    if kind == "purchases":
        record.setdefault("supplierId", "")
        record.setdefault("supplierName", "Supplier")
        record.setdefault("billNo", f"PB-{record.get('id', make_id('PUR'))}")
        record.setdefault("date", today_string())
        record.setdefault("dueDate", "")
        normalized_items = []
        for item in record.get("items", []):
            if not isinstance(item, dict):
                continue
            quantity = float(item.get("quantity", 0))
            unit_cost = float(item.get("unitCost", 0))
            discount = float(item.get("discount", 0))
            tax = float(item.get("tax", 0))
            normalized_items.append(
                {
                    "productId": str(item.get("productId", "")),
                    "productName": str(item.get("productName", "")),
                    "quantity": quantity,
                    "unit": str(item.get("unit", "pcs")) or "pcs",
                    "unitCost": unit_cost,
                    "discount": discount,
                    "tax": tax,
                    "lineTotal": round(quantity * unit_cost - discount + tax, 2),
                }
            )
        record["items"] = normalized_items
        record.setdefault("subtotal", round(sum(item["quantity"] * item["unitCost"] for item in normalized_items), 2))
        record.setdefault("discountTotal", round(sum(item["discount"] for item in normalized_items), 2))
        record.setdefault("taxTotal", round(sum(item["tax"] for item in normalized_items), 2))
        record.setdefault("amount", round(record["subtotal"] - record["discountTotal"] + record["taxTotal"], 2))
        record.setdefault("payment", "Cash")
        record.setdefault("status", "Received")
        record.setdefault("notes", "")
        record.setdefault("attachmentIds", [])
        record.setdefault("createdBy", "")

    if kind == "expenses":
        record.setdefault("category", "Miscellaneous")
        record.setdefault("vendor", "")
        record.setdefault("amount", 0)
        record.setdefault("taxAmount", 0)
        record.setdefault("paymentAccountId", "")
        record.setdefault("paymentMethod", "Cash")
        record.setdefault("date", today_string())
        record.setdefault("recurring", False)
        record.setdefault("note", "")
        record.setdefault("attachmentIds", [])
        record.setdefault("createdBy", "")

    if kind == "cash_bank_accounts":
        record.setdefault("name", "Cash")
        record.setdefault("type", "Cash")
        record.setdefault("institution", "")
        record.setdefault("accountNumber", "")
        record.setdefault("openingBalance", 0)
        record.setdefault("balance", float(record.get("openingBalance", 0)))
        record.setdefault("active", True)

    if kind == "money_movements":
        record.setdefault("accountId", "")
        record.setdefault("accountName", "")
        record.setdefault("type", "Receipt")
        record.setdefault("amount", 0)
        record.setdefault("date", today_string())
        record.setdefault("partyId", "")
        record.setdefault("partyName", "")
        record.setdefault("referenceId", "")
        record.setdefault("note", "")
        record.setdefault("createdBy", "")

    if kind == "journal_entries":
        record.setdefault("date", today_string())
        record.setdefault("source", "Adjustment")
        record.setdefault("sourceId", "")
        record.setdefault("memo", "")
        record.setdefault("lines", [])
        record.setdefault("locked", False)
        record.setdefault("createdBy", "")

    if kind == "documents":
        record.setdefault("name", "Document")
        record.setdefault("recordType", "Other")
        record.setdefault("recordId", "")
        record.setdefault("fileName", "")
        record.setdefault("mimeType", "application/octet-stream")
        record.setdefault("size", 0)
        record.setdefault("dataUrl", "")
        record.setdefault("uploadedBy", "")

    if kind == "reminder_templates":
        record.setdefault("name", "Credit reminder")
        record.setdefault("channel", "WhatsApp")
        record.setdefault("language", "en")
        record.setdefault("message", "")
        record.setdefault("daysOffset", 0)
        record.setdefault("active", True)

    if kind == "reminder_logs":
        record.setdefault("partyId", "")
        record.setdefault("partyName", "")
        record.setdefault("channel", "Manual")
        record.setdefault("message", "")
        record.setdefault("amount", 0)
        record.setdefault("dueDate", "")
        record.setdefault("status", "Draft")
        record.setdefault("createdBy", "")

    if kind == "sync_operations":
        record.setdefault("operationKey", record.get("id", make_id("SYN")))
        record.setdefault("entity", "")
        record.setdefault("entityId", "")
        record.setdefault("action", "create")
        record.setdefault("payload", {})
        record.setdefault("status", "Pending")
        record.setdefault("error", "")
        record.setdefault("syncedAt", "")

    if kind == "inventory":
        record.setdefault("name", "Untitled product")
        record.setdefault("description", "")
        record.setdefault("sku", make_id("SKU"))
        record.setdefault("barcode", "")
        record.setdefault("brand", "")
        record.setdefault("category", "General")
        record.setdefault("unit", "pcs")
        record.setdefault("stock", 0)
        record.setdefault("reorderLevel", 0)
        record.setdefault("price", 0)
        record.setdefault("costPrice", 0)
        record.setdefault("taxRate", 13)
        record.setdefault("supplier", "")
        record.setdefault("location", "")
        record.setdefault("status", stock_status(float(record.get("stock", 0)), float(record.get("reorderLevel", 0))))
        record.setdefault("active", True)

    if kind == "inventory_movements":
        record.setdefault("businessId", "")
        record.setdefault("productId", "")
        record.setdefault("productName", "")
        record.setdefault("delta", 0)
        record.setdefault("stockBefore", 0)
        record.setdefault("stockAfter", 0)
        record.setdefault("reason", "Correction")
        record.setdefault("referenceId", "")
        record.setdefault("note", "")
        record.setdefault("user", "")

    if kind in {"inventory_categories", "expense_categories"}:
        record.setdefault("name", "General")
        record.setdefault("createdBy", "")

    if kind == "reports":
        record.setdefault("title", "Untitled report")
        record.setdefault("type", "Executive")
        record.setdefault("template", "Executive")
        record.setdefault("range", "Custom")
        record.setdefault("status", "Ready")
        record.setdefault("format", "HTML")
        record.setdefault("createdBy", "")
        record.setdefault("downloadUrl", "")
        record.setdefault("scheduledAt", "")

    if kind == "audit_logs":
        record.setdefault("actorId", "")
        record.setdefault("user", "")
        record.setdefault("action", "")
        record.setdefault("module", "")
        record.setdefault("detail", "")
        record.setdefault("ipAddress", "")
        record.setdefault("metadata", {})

    if kind == "billing_history":
        record.setdefault("description", "")
        record.setdefault("gateway", "Stripe")
        record.setdefault("plan", "free")
        record.setdefault("billingCycle", "monthly")
        record.setdefault("amount", 0)
        record.setdefault("currency", "NPR")
        record.setdefault("invoiceNo", f"BILL-{record.get('id', make_id('BILL'))}")
        record.setdefault("date", today_string())
        record.setdefault("paidAt", "")
        record.setdefault("status", "Pending")

    if kind == "feature_flags":
        record.setdefault("name", "")
        record.setdefault("description", "")
        record.setdefault("area", "Platform")
        record.setdefault("enabled", False)
        record.setdefault("rollout", 0)
        record.setdefault("risk", "Low")

    if kind == "support_tickets":
        record.setdefault("orgId", "")
        record.setdefault("orgName", "")
        record.setdefault("subject", "")
        record.setdefault("priority", "Medium")
        record.setdefault("status", "Open")
        record.setdefault("assignedTo", "")
        record.setdefault("channel", "Portal")
        record.setdefault("lastUpdatedAt", now)

    record.setdefault("createdAt", now)
    record["updatedAt"] = now if kind in {
        "sales",
        "customers",
        "suppliers",
        "parties",
        "purchases",
        "expenses",
        "expense_categories",
        "cash_bank_accounts",
        "inventory",
        "inventory_categories",
        "feature_flags",
    } else record.get("updatedAt", now)
    return record


def iso_now() -> str:
    return timezone.now().isoformat(timespec="seconds")


def today_string() -> str:
    return timezone.localdate().isoformat()


def future_iso(**kwargs: int) -> str:
    return (timezone.now() + timedelta(**kwargs)).isoformat(timespec="seconds")


def subscription_status_for_workspace_status(status: str) -> str:
    normalized = status.strip()
    if normalized == "Active":
        return "active"
    if normalized == "Trial":
        return "trial"
    if normalized == "Expired":
        return "expired"
    if normalized == "Suspended":
        return "suspended"
    if normalized == "At Risk":
        return "past_due"
    return normalized.lower().replace(" ", "_")


def health_payload() -> dict[str, Any]:
    ping_mongo()
    return {
        "ok": True,
        "database": "mongodb",
        "databaseName": settings.MONGO_DB_NAME,
        "counts": mongo_counts(),
    }


def table_counts() -> dict[str, int]:
    return mongo_counts()


def permissions_for_user(user: dict[str, Any]) -> list[str]:
    role = user.get("roleRecord")
    if not role:
        role = collection("roles").find_one({"workspaceId": user["workspaceId"], "name": {"$regex": f"^{user.get('role', '')}$", "$options": "i"}})
    return list(role.get("permissions", [])) if role else []


def require_permission(user: dict[str, Any], permission: str) -> None:
    if user.get("role") == "Owner":
        return
    if permission not in permissions_for_user(user):
        raise AppError(403, f"Permission required: {permission}")


def workspace_for(user: dict[str, Any]) -> dict[str, Any]:
    workspace = user.get("workspace") or collection("workspaces").find_one({"id": user["workspaceId"]})
    if not workspace:
        raise AppError(404, "Workspace not found.")
    return strip_mongo_id(workspace) or {}


def role_by_name(workspace_id: str, name: str) -> dict[str, Any] | None:
    return strip_mongo_id(collection("roles").find_one({"workspaceId": workspace_id, "name": {"$regex": f"^{name}$", "$options": "i"}}))


def hydrate_user(user: dict[str, Any] | None) -> dict[str, Any] | None:
    user = strip_mongo_id(user)
    if not user:
        return None
    user["workspace"] = strip_mongo_id(collection("workspaces").find_one({"id": user["workspaceId"]}))
    user["roleRecord"] = strip_mongo_id(collection("roles").find_one({"id": user.get("roleId")}))
    return user


def role_payload(role: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": role["id"],
        "name": role["name"],
        "slug": role.get("slug", slugify(role.get("name", ""))),
        "description": role.get("description", ""),
        "systemRole": bool(role.get("systemRole", False)),
        "permissions": list(role.get("permissions", [])),
        "createdBy": role.get("createdBy", "system"),
        "createdAt": role.get("createdAt", ""),
        "updatedAt": role.get("updatedAt", role.get("createdAt", "")),
    }


def business_payload(business: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": business["id"],
        "name": business.get("name", ""),
        "category": business.get("category", ""),
        "address": business.get("address", ""),
        "phone": business.get("phone", ""),
        "email": business.get("email", ""),
        "taxId": business.get("taxId", ""),
        "currency": business.get("currency", "NPR"),
        "isPrimary": bool(business.get("isPrimary", False)),
        "createdAt": business.get("createdAt", ""),
        "updatedAt": business.get("updatedAt", business.get("createdAt", "")),
    }


def settings_payload(settings_doc: dict[str, Any] | None) -> dict[str, Any]:
    if not settings_doc:
        return dict(EMPTY_SETTINGS)
    return {
        "businessName": settings_doc.get("businessName", ""),
        "panVatNumber": settings_doc.get("panVatNumber", ""),
        "currency": settings_doc.get("currency", "NPR"),
        "language": settings_doc.get("language", "en"),
        "timezone": settings_doc.get("timezone", "Asia/Kathmandu"),
        "fiscalYearStart": settings_doc.get("fiscalYearStart", "July"),
        "dateFormat": settings_doc.get("dateFormat", "YYYY-MM-DD"),
        "numberFormat": settings_doc.get("numberFormat", "en-NP"),
        "taxRate": float(settings_doc.get("taxRate", 13)),
        "invoicePrefix": settings_doc.get("invoicePrefix", "RP"),
        "receiptFooter": settings_doc.get("receiptFooter", "Thank you for your business."),
        "defaultPaymentMethod": settings_doc.get("defaultPaymentMethod", "Cash"),
        "compactTables": bool(settings_doc.get("compactTables", False)),
        "lowStockAlerts": bool(settings_doc.get("lowStockAlerts", True)),
        "dailySalesSummary": bool(settings_doc.get("dailySalesSummary", False)),
        "newCustomerSignup": bool(settings_doc.get("newCustomerSignup", False)),
        "twoFactorEnabled": bool(settings_doc.get("twoFactorEnabled", False)),
        "scheduledReports": bool(settings_doc.get("scheduledReports", False)),
    }


def user_payload(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": user["id"],
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "role": user.get("role", ""),
        "roleId": user.get("roleId"),
        "permissions": permissions_for_user(user),
        "status": user.get("status", "Active"),
        "lastActive": user.get("lastActive", ""),
        "phone": user.get("phone", ""),
        "avatarUrl": user.get("avatarUrl", ""),
        "locale": user.get("locale", "en-NP"),
        "isEmailVerified": bool(user.get("isEmailVerified", False)),
        "invitedBy": user.get("invitedBy", ""),
        "lastLoginAt": user.get("lastLoginAt", ""),
        "createdAt": user.get("createdAt", ""),
        "updatedAt": user.get("updatedAt", user.get("createdAt", "")),
    }


def current_user_payload(user: dict[str, Any]) -> dict[str, str]:
    return {
        "id": user["id"],
        "name": user.get("name", ""),
        "email": user.get("email", ""),
        "role": user.get("role", ""),
    }


def put_record(workspace_id: str, kind: str, payload: dict[str, Any]) -> dict[str, Any]:
    record_payload = dict(payload)
    record_payload["id"] = str(record_payload.get("id") or make_id(kind[:3].upper()))
    now = iso_now()
    existing = collection("records").find_one({"workspaceId": workspace_id, "kind": kind, "id": record_payload["id"]})
    record_payload = normalize_record_payload(kind, record_payload, dict(existing.get("payload", {})) if existing else None)
    collection("records").update_one(
        {"workspaceId": workspace_id, "kind": kind, "id": record_payload["id"]},
        {
            "$set": {
                "workspaceId": workspace_id,
                "kind": kind,
                "id": record_payload["id"],
                "payload": record_payload,
                "updatedAt": now,
                "deletedAt": record_payload.get("deletedAt"),
            },
            "$setOnInsert": {"createdAt": now},
        },
        upsert=True,
    )
    return record_payload if not existing else dict(record_payload)


def get_record(workspace_id: str, kind: str, record_id: str) -> dict[str, Any] | None:
    record = collection("records").find_one({"workspaceId": workspace_id, "kind": kind, "id": record_id})
    return dict(record.get("payload", {})) if record else None


def list_records(workspace_id: str, kind: str) -> list[dict[str, Any]]:
    return [
        dict(row.get("payload", {}))
        for row in collection("records").find({"workspaceId": workspace_id, "kind": kind}).sort("createdAt", -1)
    ]


DETAIL_ROUTE_KINDS = {
    "sales": "sales",
    "customers": "customers",
    "suppliers": "suppliers",
    "credit-ledger": "credit_ledger",
    "parties": "parties",
    "party-ledger": "party_ledger",
    "purchases": "purchases",
    "expenses": "expenses",
    "cash-bank-accounts": "cash_bank_accounts",
    "money-movements": "money_movements",
    "journal-entries": "journal_entries",
    "documents": "documents",
    "reminder-templates": "reminder_templates",
    "reminders": "reminder_logs",
    "sync-operations": "sync_operations",
    "inventory": "inventory",
    "inventory-movements": "inventory_movements",
    "reports": "reports",
    "audit-logs": "audit_logs",
    "billing-history": "billing_history",
    "feature-flags": "feature_flags",
    "support-tickets": "support_tickets",
}


def detail_payload(user: dict[str, Any], entity: str, record_id: str) -> dict[str, Any]:
    workspace_id = user["workspaceId"]
    kind = DETAIL_ROUTE_KINDS.get(entity)
    if not kind:
        raise AppError(404, "Detail route not found.")
    record = get_record(workspace_id, kind, record_id)
    if record is None:
        raise AppError(404, "Record not found.")
    related = related_records_for_detail(workspace_id, kind, record)
    return {
        "entity": entity,
        "kind": kind,
        "id": record_id,
        "record": record,
        "related": related,
    }


def related_records_for_detail(workspace_id: str, kind: str, record: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    record_id = str(record.get("id", ""))
    customer_id = str(record.get("customerId", ""))
    party_id = str(record.get("partyId", ""))
    product_id = str(record.get("productId", ""))
    if kind == "inventory":
        product_id = record_id
    supplier_name = str(record.get("supplier", "")).strip().lower()
    return {
        key: value
        for key, value in {
            "sales": _related_sales(workspace_id, kind, record, record_id, customer_id, product_id),
            "creditLedger": _filter_records(workspace_id, "credit_ledger", customerId=customer_id, saleId=record_id),
            "partyLedger": _filter_records(workspace_id, "party_ledger", partyId=party_id),
            "purchases": _related_purchases(workspace_id, kind, record, record_id, party_id, product_id, supplier_name),
            "expenses": _filter_records(workspace_id, "expenses", paymentAccountId=record_id),
            "moneyMovements": _filter_records(workspace_id, "money_movements", accountId=record_id, referenceId=record_id),
            "journalEntries": _filter_records(workspace_id, "journal_entries", sourceId=record_id),
            "inventoryMovements": _filter_records(workspace_id, "inventory_movements", productId=product_id or record_id, referenceId=record_id),
            "documents": _filter_records(workspace_id, "documents", referenceId=record_id),
            "reminders": _filter_records(workspace_id, "reminder_logs", partyId=party_id, customerId=customer_id),
            "auditLogs": _audit_records(workspace_id, record_id),
        }.items()
        if value
    }


def _filter_records(workspace_id: str, kind: str, **matches: str) -> list[dict[str, Any]]:
    wanted = {key: value for key, value in matches.items() if value}
    if not wanted:
        return []
    return [
        item
        for item in list_records(workspace_id, kind)
        if any(str(item.get(key, "")) == value for key, value in wanted.items())
    ][:25]


def _related_sales(workspace_id: str, kind: str, record: dict[str, Any], record_id: str, customer_id: str, product_id: str) -> list[dict[str, Any]]:
    if kind == "sales":
        return []
    customer_name = str(record.get("name", "")).strip().lower()
    sales = list_records(workspace_id, "sales")
    return [
        sale
        for sale in sales
        if (customer_id and str(sale.get("customerId", "")) == customer_id)
        or (customer_name and str(sale.get("customer", "")).strip().lower() == customer_name)
        or (product_id and any(str(item.get("productId", "")) == product_id for item in sale.get("items", [])))
        or (kind == "customers" and str(sale.get("customerId", "")) == record_id)
    ][:25]


def _related_purchases(workspace_id: str, kind: str, record: dict[str, Any], record_id: str, party_id: str, product_id: str, supplier_name: str) -> list[dict[str, Any]]:
    if kind == "purchases":
        return []
    purchases = list_records(workspace_id, "purchases")
    return [
        purchase
        for purchase in purchases
        if (party_id and str(purchase.get("partyId", "")) == party_id)
        or (supplier_name and str(purchase.get("supplier", "")).strip().lower() == supplier_name)
        or (product_id and any(str(item.get("productId", "")) == product_id for item in purchase.get("items", [])))
        or (kind == "suppliers" and str(purchase.get("supplierId", "")) == record_id)
    ][:25]


def _audit_records(workspace_id: str, record_id: str) -> list[dict[str, Any]]:
    return [
        item
        for item in list_records(workspace_id, "audit_logs")
        if record_id and record_id in {str(item.get("recordId", "")), str(item.get("detail", "")), str(item.get("target", ""))}
    ][:25]


def patch_record(workspace_id: str, kind: str, record_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
    existing = get_record(workspace_id, kind, record_id)
    if existing is None:
        return None
    return put_record(workspace_id, kind, {**existing, **patch, "id": record_id})


CRUD_ROUTE_KINDS = {
    "customers": ("customers", "customers.manage", "Customers"),
    "credit-ledger": ("credit_ledger", "customers.manage", "Credit Ledger"),
    "inventory": ("inventory", "inventory.manage", "Inventory"),
    "inventory-movements": ("inventory_movements", "inventory.manage", "Inventory"),
    "money-movements": ("money_movements", "cashbank.manage", "Cash & Bank"),
    "documents": ("documents", "documents.manage", "Documents"),
    "reminder-templates": ("reminder_templates", "reminders.manage", "Reminders"),
    "reminders": ("reminder_logs", "reminders.manage", "Reminders"),
    "reports": ("reports", "reports.generate", "Reports"),
    "sync-operations": ("sync_operations", "sync.manage", "Sync"),
}


def update_generic_record(user: dict[str, Any], entity: str, record_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    kind, permission, module = crud_kind_for(entity)
    require_permission(user, permission)
    clean_patch = dict(patch)
    clean_patch.pop("id", None)
    clean_patch["updatedAt"] = iso_now()
    if kind == "inventory":
        existing = get_record(user["workspaceId"], kind, record_id)
        next_stock = float(clean_patch.get("stock", (existing or {}).get("stock", 0)))
        next_reorder = float(clean_patch.get("reorderLevel", (existing or {}).get("reorderLevel", 0)))
        clean_patch["status"] = stock_status(next_stock, next_reorder)
    record = patch_record(user["workspaceId"], kind, record_id, clean_patch)
    if record is None:
        raise AppError(404, "Record not found.")
    create_audit(user["workspaceId"], user["name"], "Updated record", module, record_id)
    return {"record": record, "bootstrap": bootstrap_payload(user)}


def delete_generic_record(user: dict[str, Any], entity: str, record_id: str) -> dict[str, Any]:
    kind, permission, module = crud_kind_for(entity)
    require_permission(user, permission)
    existing = get_record(user["workspaceId"], kind, record_id)
    if existing is None:
        raise AppError(404, "Record not found.")
    collection("records").delete_one({"workspaceId": user["workspaceId"], "kind": kind, "id": record_id})
    if kind == "inventory":
        collection("records").delete_many({"workspaceId": user["workspaceId"], "kind": "inventory_movements", "payload.productId": record_id})
    if kind == "customers":
        collection("records").delete_many({"workspaceId": user["workspaceId"], "kind": "credit_ledger", "payload.customerId": record_id})
    create_audit(user["workspaceId"], user["name"], "Deleted record", module, record_id)
    return {"ok": True, "bootstrap": bootstrap_payload(user)}


def crud_kind_for(entity: str) -> tuple[str, str, str]:
    match = CRUD_ROUTE_KINDS.get(entity)
    if not match:
        raise AppError(404, "CRUD route not found.")
    return match


def create_audit(workspace_id: str, user_name: str, action: str, module: str, detail: str) -> None:
    put_record(
        workspace_id,
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


def platform_organizations() -> list[dict[str, Any]]:
    organizations: list[dict[str, Any]] = []
    for workspace in collection("workspaces").find({"deletedAt": {"$exists": False}}).sort("createdAt", -1):
        workspace_id = workspace["id"]
        users = [strip_mongo_id(item) or {} for item in collection("users").find({"workspaceId": workspace_id})]
        owner = next((item for item in users if item.get("role") == "Owner"), users[0] if users else None)
        sales_entries = collection("records").count_documents({"workspaceId": workspace_id, "kind": "sales"})
        record_count = collection("records").count_documents({"workspaceId": workspace_id})
        open_tickets = [item for item in list_records(workspace_id, "support_tickets") if item.get("status") != "Resolved"]
        last_seen = max((str(item.get("lastActive", "")) for item in users), default=workspace.get("createdAt", ""))
        status = workspace.get("status", "Trial")
        status_penalty = 55 if status == "Expired" else 45 if status == "Suspended" else 25 if status == "At Risk" else 0
        health = max(0, min(100, 100 - len(open_tickets) * 12 - status_penalty))
        billable = workspace.get("plan") == "pro" and status not in {"Expired", "Suspended"}
        organizations.append(
            {
                "id": workspace_id,
                "name": workspace.get("name", ""),
                "owner": owner.get("name", "") if owner else "",
                "email": owner.get("email", "") if owner else "",
                "market": workspace.get("address") or "Unspecified",
                "category": workspace.get("category") or "General",
                "plan": workspace.get("plan", "free"),
                "status": status,
                "country": workspace.get("country", "NP"),
                "timezone": workspace.get("timezone", "Asia/Kathmandu"),
                "subscriptionStatus": workspace.get("subscriptionStatus", "trial"),
                "mrr": 1499 if billable else 0,
                "users": len(users),
                "salesEntries": sales_entries,
                "storageGb": round(record_count * 0.002, 3),
                "healthScore": health,
                "lastSeen": last_seen,
                "joinedAt": str(workspace.get("createdAt", today_string()))[:10],
            }
        )
    return organizations


def ensure_platform_feature_flags() -> None:
    now = iso_now()
    for item in PLATFORM_FEATURE_FLAG_DEFAULTS:
        collection("platform_feature_flags").update_one(
            {"id": item["id"]},
            {
                "$setOnInsert": {
                    **item,
                    "createdAt": now,
                    "updatedAt": now,
                }
            },
            upsert=True,
        )


def platform_feature_flags() -> list[dict[str, Any]]:
    ensure_platform_feature_flags()
    flags: list[dict[str, Any]] = []
    for row in collection("platform_feature_flags").find({}).sort([("area", 1), ("name", 1)]):
        item = strip_mongo_id(row) or {}
        flags.append(
            {
                "id": item.get("id", ""),
                "name": item.get("name", ""),
                "description": item.get("description", ""),
                "area": item.get("area", "Platform"),
                "enabled": bool(item.get("enabled", False)),
                "rollout": int(item.get("rollout", 0)),
                "risk": item.get("risk", "Low"),
                "createdAt": item.get("createdAt", ""),
                "updatedAt": item.get("updatedAt", ""),
            }
        )
    return flags


def platform_support_tickets() -> list[dict[str, Any]]:
    workspaces = {workspace["id"]: workspace for workspace in collection("workspaces").find({})}
    tickets: list[dict[str, Any]] = []
    for row in collection("records").find({"kind": "support_tickets"}).sort("updatedAt", -1):
        if row.get("deletedAt"):
            continue
        payload = dict(row.get("payload", {}))
        workspace_id = row.get("workspaceId", payload.get("orgId", ""))
        workspace = workspaces.get(workspace_id, {})
        tickets.append(
            {
                "id": payload.get("id", row.get("id", "")),
                "orgId": workspace_id,
                "orgName": payload.get("orgName") or workspace.get("name", "Unknown tenant"),
                "subject": payload.get("subject", "Support request"),
                "priority": payload.get("priority", "Medium"),
                "status": payload.get("status", "Open"),
                "assignedTo": payload.get("assignedTo", ""),
                "channel": payload.get("channel", "Portal"),
                "createdAt": payload.get("createdAt", row.get("createdAt", "")),
                "lastUpdatedAt": payload.get("lastUpdatedAt", payload.get("updatedAt", row.get("updatedAt", ""))),
            }
        )
    return tickets


def platform_security_sessions() -> list[dict[str, Any]]:
    now = iso_now()
    admins = {
        admin["id"]: strip_mongo_id(admin) or {}
        for admin in collection("platform_admins").find({})
    }
    sessions: list[dict[str, Any]] = []
    for row in collection("platform_sessions").find({}).sort("createdAt", -1).limit(100):
        session = strip_mongo_id(row) or {}
        admin = admins.get(session.get("adminId", ""), {})
        revoked_at = session.get("revokedAt")
        expires_at = str(session.get("expiresAt", ""))
        status = "Revoked" if revoked_at else "Expired" if expires_at and expires_at <= now else "Active"
        sessions.append(
            {
                "id": session.get("accessTokenHash", ""),
                "adminId": session.get("adminId", ""),
                "adminName": admin.get("name", "Unknown admin"),
                "adminEmail": admin.get("email", ""),
                "role": admin.get("role", "Super Admin"),
                "status": status,
                "createdAt": session.get("createdAt", ""),
                "expiresAt": expires_at,
                "revokedAt": revoked_at or "",
                "userAgent": session.get("userAgent", ""),
                "ipAddress": session.get("ipAddress", ""),
            }
        )
    return sessions


def require_platform_role(actor: dict[str, Any], allowed_roles: set[str], message: str) -> None:
    if actor.get("role") not in allowed_roles:
        raise AppError(403, message)


def bootstrap_payload(user: dict[str, Any]) -> dict[str, Any]:
    workspace = workspace_for(user)
    workspace_id = workspace["id"]
    businesses = [business_payload(strip_mongo_id(row) or {}) for row in collection("businesses").find({"workspaceId": workspace_id}).sort("createdAt", 1)]
    settings_doc = strip_mongo_id(collection("settings").find_one({"workspaceId": workspace_id}))
    team = [hydrate_user(row) or {} for row in collection("users").find({"workspaceId": workspace_id}).sort("createdAt", 1)]
    roles = [strip_mongo_id(row) or {} for row in collection("roles").find({"workspaceId": workspace_id}).sort([("systemRole", -1), ("createdAt", 1)])]
    return {
        "plan": workspace.get("plan", "free"),
        "billingCycle": workspace.get("billingCycle", "monthly"),
        "trialEndsAt": workspace.get("trialEndsAt", ""),
        "activeBusinessId": businesses[0]["id"] if businesses else "",
        "businesses": businesses,
        "teamMembers": [user_payload(row) for row in team if row],
        "roleDefinitions": [role_payload(row) for row in roles if row],
        "sales": list_records(workspace_id, "sales"),
        "parties": list_records(workspace_id, "parties"),
        "partyLedger": list_records(workspace_id, "party_ledger"),
        "purchases": list_records(workspace_id, "purchases"),
        "expenses": list_records(workspace_id, "expenses"),
        "expenseCategories": expense_category_names(workspace_id),
        "cashBankAccounts": list_records(workspace_id, "cash_bank_accounts"),
        "moneyMovements": list_records(workspace_id, "money_movements"),
        "journalEntries": list_records(workspace_id, "journal_entries"),
        "documents": list_records(workspace_id, "documents"),
        "reminderTemplates": list_records(workspace_id, "reminder_templates"),
        "reminderLogs": list_records(workspace_id, "reminder_logs"),
        "syncOperations": list_records(workspace_id, "sync_operations"),
        "customers": list_records(workspace_id, "customers"),
        "suppliers": list_records(workspace_id, "suppliers"),
        "creditLedger": list_records(workspace_id, "credit_ledger"),
        "inventory": list_records(workspace_id, "inventory"),
        "inventoryCategories": inventory_category_names(workspace_id),
        "inventoryMovements": list_records(workspace_id, "inventory_movements"),
        "reports": list_records(workspace_id, "reports"),
        "auditLogs": list_records(workspace_id, "audit_logs"),
        "billingHistory": list_records(workspace_id, "billing_history"),
        "platformOrganizations": [],
        "featureFlags": list_records(workspace_id, "feature_flags"),
        "supportTickets": list_records(workspace_id, "support_tickets"),
        "settings": settings_payload(settings_doc),
    }


def create_default_roles(workspace_id: str) -> dict[str, dict[str, Any]]:
    now = iso_now()
    roles: dict[str, dict[str, Any]] = {}
    for item in SYSTEM_ROLES:
        role = {
            "id": f"{workspace_id}-role-{item['slug']}",
            "workspaceId": workspace_id,
            "name": item["name"],
            "slug": item["slug"],
            "description": item["description"],
            "systemRole": True,
            "permissions": item["permissions"],
            "createdBy": "system",
            "createdAt": now,
            "updatedAt": now,
        }
        collection("roles").insert_one(role)
        roles[role["name"]] = role
    return roles


def create_workspace_with_owner(owner_name: str, owner_email: str, password_salt: str, password_hash: str, business_name: str) -> dict[str, Any]:
    now = iso_now()
    workspace_id = make_id("ws")
    owner_id = make_id("usr")
    workspace = {
        "id": workspace_id,
        "name": business_name,
        "category": "General",
        "address": "",
        "country": "NP",
        "timezone": "Asia/Kathmandu",
        "locale": "en-NP",
        "plan": "free",
        "billingCycle": "monthly",
        "status": "Trial",
        "subscriptionStatus": "trial",
        "trialEndsAt": (timezone.localdate() + timedelta(days=14)).isoformat(),
        "planStartedAt": now,
        "ownerUserId": owner_id,
        "createdAt": now,
        "updatedAt": now,
    }
    collection("workspaces").insert_one(workspace)
    roles = create_default_roles(workspace_id)
    collection("businesses").insert_one(
        {
            "id": make_id("biz"),
            "workspaceId": workspace_id,
            "name": business_name,
            "category": "General",
            "address": "",
            "phone": "",
            "email": owner_email,
            "taxId": "",
            "currency": "NPR",
            "isPrimary": True,
            "createdAt": now,
            "updatedAt": now,
        }
    )
    collection("settings").insert_one({"workspaceId": workspace_id, **EMPTY_SETTINGS, "businessName": business_name})
    user = {
        "id": owner_id,
        "workspaceId": workspace_id,
        "roleId": roles["Owner"]["id"],
        "name": owner_name,
        "email": owner_email,
        "emailNormalized": normalize_email(owner_email),
        "role": "Owner",
        "status": "Active",
        "lastActive": now,
        "phone": "",
        "avatarUrl": "",
        "locale": "en-NP",
        "isEmailVerified": True,
        "invitedBy": "self-registration",
        "lastLoginAt": now,
        "passwordSalt": password_salt,
        "passwordHash": password_hash,
        "createdAt": now,
        "updatedAt": now,
    }
    collection("users").insert_one(user)
    create_audit(workspace_id, owner_name, "Created workspace", "Auth", f"{business_name} workspace was created.")
    return hydrate_user(user) or user


def create_session(user: dict[str, Any]) -> dict[str, str]:
    access_token = new_token("rp_access")
    refresh_token = new_token("rp_refresh")
    expires_at = future_iso(minutes=settings.SESSION_TTL_MINUTES)
    refresh_expires_at = future_iso(days=settings.REFRESH_TTL_DAYS)
    collection("sessions").insert_one(
        {
            "accessTokenHash": hash_token(access_token),
            "refreshTokenHash": hash_token(refresh_token),
            "userId": user["id"],
            "expiresAt": expires_at,
            "refreshExpiresAt": refresh_expires_at,
            "userAgent": "",
            "ipAddress": "",
            "createdAt": iso_now(),
            "revokedAt": None,
        }
    )
    return {"accessToken": access_token, "refreshToken": refresh_token, "expiresAt": expires_at}


def authenticate_access_token(access_token: str | None) -> dict[str, Any]:
    if not access_token:
        raise AppError(401, "Missing access token.")
    session = collection("sessions").find_one({"accessTokenHash": hash_token(access_token)})
    if session is None or session.get("revokedAt") is not None:
        raise AppError(401, "Invalid session.")
    if str(session.get("expiresAt", "")) <= iso_now():
        raise AppError(401, "Session expired.")
    user = hydrate_user(collection("users").find_one({"id": session["userId"]}))
    if user is None:
        raise AppError(401, "User not found.")
    user["lastActive"] = iso_now()
    collection("users").update_one({"id": user["id"]}, {"$set": {"lastActive": user["lastActive"], "updatedAt": user["lastActive"]}})
    return user


def auth_response(user: dict[str, Any], session: dict[str, str]) -> dict[str, Any]:
    return {"user": current_user_payload(user), "session": session, "bootstrap": bootstrap_payload(user)}


def register_user(data: dict[str, Any]) -> dict[str, Any]:
    name = require_text(data, "name", "Owner name")
    email = require_email(require_text(data, "email", "Email"))
    password = require_text(data, "password", "Password")
    business_name = require_text(data, "businessName", "Business name")
    if len(password) < 8:
        raise AppError(400, "Password must be at least 8 characters.")
    if collection("users").find_one({"emailNormalized": normalize_email(email)}):
        raise AppError(409, "An account already exists for this email.")
    salt, digest = hash_password(password)
    try:
        user = create_workspace_with_owner(name, email, salt, digest, business_name)
    except DuplicateKeyError as error:
        raise AppError(409, "Workspace or email already exists.") from error
    return auth_response(user, create_session(user))


def login_user(data: dict[str, Any]) -> dict[str, Any]:
    email = require_text(data, "email", "Email")
    password = require_text(data, "password", "Password")
    user = hydrate_user(collection("users").find_one({"emailNormalized": normalize_email(email)}))
    if user is None or not verify_password(password, user.get("passwordSalt", ""), user.get("passwordHash", "")):
        raise AppError(401, "Invalid email or password.")
    if user.get("status") != "Active":
        raise AppError(403, "Your account is not active yet.")
    login_at = iso_now()
    collection("users").update_one({"id": user["id"]}, {"$set": {"lastActive": login_at, "lastLoginAt": login_at, "updatedAt": login_at}})
    create_audit(user["workspaceId"], user["name"], "Logged in", "Auth", f"{user['email']} signed in.")
    user = hydrate_user(collection("users").find_one({"id": user["id"]})) or user
    return auth_response(user, create_session(user))


def refresh_session(data: dict[str, Any]) -> dict[str, Any]:
    refresh_token = require_text(data, "refreshToken", "Refresh token")
    session = collection("sessions").find_one({"refreshTokenHash": hash_token(refresh_token)})
    if session is None or session.get("revokedAt") is not None:
        raise AppError(401, "Invalid refresh token.")
    if str(session.get("refreshExpiresAt", "")) <= iso_now():
        raise AppError(401, "Refresh token expired.")
    collection("sessions").update_one({"accessTokenHash": session["accessTokenHash"]}, {"$set": {"revokedAt": iso_now()}})
    user = hydrate_user(collection("users").find_one({"id": session["userId"]}))
    if user is None:
        raise AppError(401, "User not found.")
    return auth_response(user, create_session(user))


def logout(access_token: str | None, data: dict[str, Any]) -> dict[str, bool]:
    now = iso_now()
    if access_token:
        collection("sessions").update_many({"accessTokenHash": hash_token(access_token)}, {"$set": {"revokedAt": now}})
    refresh_token = data.get("refreshToken")
    if refresh_token:
        collection("sessions").update_many({"refreshTokenHash": hash_token(str(refresh_token))}, {"$set": {"revokedAt": now}})
    return {"ok": True}


def request_password_reset(data: dict[str, Any]) -> dict[str, Any]:
    email = require_text(data, "email", "Email")
    response: dict[str, Any] = {"ok": True, "message": "If the email exists, a reset code has been issued."}
    user = collection("users").find_one({"emailNormalized": normalize_email(email)})
    if user is None:
        return response
    token = f"{secrets.randbelow(1_000_000):06d}"
    collection("password_reset_tokens").insert_one(
        {
            "id": make_id("rst"),
            "userId": user["id"],
            "tokenHash": hash_token(token),
            "requestedIp": "",
            "expiresAt": future_iso(minutes=settings.PASSWORD_RESET_TTL_MINUTES),
            "usedAt": None,
            "createdAt": iso_now(),
        }
    )
    if settings.EXPOSE_RESET_TOKEN:
        response["resetToken"] = token
    return response


def reset_password(data: dict[str, Any]) -> dict[str, Any]:
    email = require_text(data, "email", "Email")
    token = require_text(data, "token", "Reset code")
    password = require_text(data, "password", "Password")
    if len(password) < 8:
        raise AppError(400, "Password must be at least 8 characters.")
    user = hydrate_user(collection("users").find_one({"emailNormalized": normalize_email(email)}))
    if user is None:
        raise AppError(400, "Invalid reset request.")
    reset_token = collection("password_reset_tokens").find_one(
        {"userId": user["id"], "tokenHash": hash_token(token), "usedAt": None},
        sort=[("createdAt", -1)],
    )
    if reset_token is None or str(reset_token.get("expiresAt", "")) <= iso_now():
        raise AppError(400, "Reset code is invalid or expired.")
    salt, digest = hash_password(password)
    collection("users").update_one({"id": user["id"]}, {"$set": {"passwordSalt": salt, "passwordHash": digest, "status": "Active", "updatedAt": iso_now()}})
    collection("password_reset_tokens").update_one({"id": reset_token["id"]}, {"$set": {"usedAt": iso_now()}})
    collection("sessions").update_many({"userId": user["id"]}, {"$set": {"revokedAt": iso_now()}})
    create_audit(user["workspaceId"], user["name"], "Reset password", "Auth", f"{user['email']} changed password.")
    return {"ok": True, "message": "Password updated."}


def apply_inventory_delta(user: dict[str, Any], product_id: str, delta: float) -> dict[str, Any] | None:
    product = get_record(user["workspaceId"], "inventory", product_id)
    if not product:
        return None
    stock = max(0.0, float(product.get("stock", 0)) + float(delta))
    product["stock"] = stock
    product["status"] = stock_status(stock, float(product.get("reorderLevel", 0)))
    return put_record(user["workspaceId"], "inventory", product)


def recalculate_customers(user: dict[str, Any]) -> list[dict[str, Any]]:
    customers = list_records(user["workspaceId"], "customers")
    sales = [sale for sale in list_records(user["workspaceId"], "sales") if not sale.get("deletedAt") and sale.get("status") == "Completed"]
    for customer in customers:
        customer_sales = [sale for sale in sales if sale.get("customerId") == customer.get("id")]
        if not customer_sales:
            continue
        total_spent = sum(float(sale.get("amount", 0)) for sale in customer_sales)
        orders = len(customer_sales)
        last_order = sorted(str(sale.get("date", "")) for sale in customer_sales)[-1]
        customer.update(totalSpent=round(total_spent, 2), orders=orders, lastOrder=last_order, segment=customer_segment(total_spent, orders, last_order))
        put_record(user["workspaceId"], "customers", customer)
    return list_records(user["workspaceId"], "customers")


def sync_credit_balances(user: dict[str, Any]) -> list[dict[str, Any]]:
    ledger = list_records(user["workspaceId"], "credit_ledger")
    balances: dict[str, float] = {}
    for entry in ledger:
        customer_id = str(entry.get("customerId", ""))
        if not customer_id:
            continue
        amount = float(entry.get("amount", 0))
        if entry.get("type") == "Payment Received":
            balances[customer_id] = balances.get(customer_id, 0) - amount
        else:
            balances[customer_id] = balances.get(customer_id, 0) + amount
    for customer in list_records(user["workspaceId"], "customers"):
        balance = max(0.0, balances.get(str(customer.get("id", "")), 0.0))
        if float(customer.get("balance", 0)) != balance:
            customer["balance"] = round(balance, 2)
            put_record(user["workspaceId"], "customers", customer)
    return list_records(user["workspaceId"], "customers")


def sync_party_balances(user: dict[str, Any]) -> list[dict[str, Any]]:
    ledger = list_records(user["workspaceId"], "party_ledger")
    balances: dict[str, float] = {}
    for entry in ledger:
        party_id = str(entry.get("partyId", ""))
        if not party_id:
            continue
        amount = float(entry.get("amount", 0))
        if entry.get("type") in {"Payment Received", "Payment Paid"}:
            balances[party_id] = balances.get(party_id, 0) - amount
        else:
            balances[party_id] = balances.get(party_id, 0) + amount
    for party in list_records(user["workspaceId"], "parties"):
        opening = float(party.get("openingBalance", 0))
        balance = max(0.0, opening + balances.get(str(party.get("id", "")), 0.0))
        if float(party.get("balance", 0)) != balance:
            party["balance"] = round(balance, 2)
            put_record(user["workspaceId"], "parties", party)
    return list_records(user["workspaceId"], "parties")


def apply_cash_bank_movement(user: dict[str, Any], movement: dict[str, Any]) -> None:
    account = get_record(user["workspaceId"], "cash_bank_accounts", str(movement.get("accountId", "")))
    if not account:
        return
    amount = float(movement.get("amount", 0))
    movement_type = str(movement.get("type", ""))
    delta = amount if movement_type in {"Receipt", "Deposit"} else -amount if movement_type in {"Payment", "Withdrawal"} else 0
    account["balance"] = max(0.0, float(account.get("balance", 0)) + delta)
    put_record(user["workspaceId"], "cash_bank_accounts", account)


def create_journal_entry(user: dict[str, Any], source: str, source_id: str, memo: str, lines: list[dict[str, Any]], date: str | None = None) -> dict[str, Any]:
    return put_record(
        user["workspaceId"],
        "journal_entries",
        {
            "id": make_id("JRN"),
            "date": date or today_string(),
            "source": source,
            "sourceId": source_id,
            "memo": memo,
            "lines": lines,
            "locked": False,
            "createdBy": user["name"],
            "createdAt": iso_now(),
        },
    )


def ensure_customer_for_sale(user: dict[str, Any], sale: dict[str, Any]) -> None:
    customer_id = str(sale.get("customerId", "")).strip()
    if not customer_id or get_record(user["workspaceId"], "customers", customer_id):
        return
    put_record(
        user["workspaceId"],
        "customers",
        {
            "id": customer_id,
            "name": sale.get("customer", "Customer"),
            "email": "",
            "phone": "",
            "address": "",
            "notes": "",
            "tags": [],
            "totalSpent": 0,
            "orders": 0,
            "lastOrder": sale.get("date", ""),
            "segment": "Occasional",
            "birthday": "",
        },
    )


def create_customer(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "customers.manage")
    customer = {
        "id": str(payload.get("id") or make_id("CUST")),
        "name": str(payload.get("name", "")).strip(),
        "company": str(payload.get("company", "")),
        "email": str(payload.get("email", "")),
        "phone": str(payload.get("phone", "")),
        "address": str(payload.get("address", "")),
        "source": str(payload.get("source", "Manual")),
        "taxId": str(payload.get("taxId", "")),
        "notes": str(payload.get("notes", "")),
        "tags": payload.get("tags") if isinstance(payload.get("tags"), list) else [],
        "creditLimit": float(payload.get("creditLimit", 0)),
        "balance": float(payload.get("balance", 0)),
        "totalSpent": float(payload.get("totalSpent", 0)),
        "orders": int(payload.get("orders", 0)),
        "lastOrder": str(payload.get("lastOrder", "")),
        "segment": str(payload.get("segment", "Occasional")),
        "birthday": str(payload.get("birthday", "")),
        "preferredLanguage": str(payload.get("preferredLanguage", "en")),
    }
    customer = put_record(user["workspaceId"], "customers", customer)
    create_audit(user["workspaceId"], user["name"], "Created customer", "Customers", customer.get("name", customer["id"]))
    return {"customer": customer}


def update_customer(user: dict[str, Any], customer_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "customers.manage")
    customer = patch_record(user["workspaceId"], "customers", customer_id, patch)
    if customer is None:
        raise AppError(404, "Customer not found.")
    create_audit(user["workspaceId"], user["name"], "Updated customer", "Customers", customer.get("name", customer_id))
    return {"customer": customer}


def create_supplier(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "inventory.manage")
    supplier = {
        "id": str(payload.get("id") or make_id("SUP")),
        "name": str(payload.get("name", "")).strip() or "Supplier",
        "phone": str(payload.get("phone", "")).strip(),
        "email": str(payload.get("email", "")).strip(),
        "address": str(payload.get("address", "")).strip(),
        "pan": str(payload.get("pan", "")).strip(),
        "contactPerson": str(payload.get("contactPerson", "")).strip(),
        "payableBalance": float(payload.get("payableBalance", 0)),
        "notes": str(payload.get("notes", "")).strip(),
        "createdAt": str(payload.get("createdAt") or iso_now()),
    }
    supplier = put_record(user["workspaceId"], "suppliers", supplier)
    create_audit(user["workspaceId"], user["name"], "Created supplier", "Inventory", supplier.get("name", supplier["id"]))
    return {"supplier": supplier}


def update_supplier(user: dict[str, Any], supplier_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "inventory.manage")
    if "payableBalance" in patch:
        patch["payableBalance"] = float(patch.get("payableBalance", 0))
    supplier = patch_record(user["workspaceId"], "suppliers", supplier_id, patch)
    if supplier is None:
        raise AppError(404, "Supplier not found.")
    create_audit(user["workspaceId"], user["name"], "Updated supplier", "Inventory", supplier.get("name", supplier_id))
    return {"supplier": supplier}


def delete_supplier(user: dict[str, Any], supplier_id: str) -> dict[str, bool]:
    require_permission(user, "inventory.manage")
    collection("records").delete_one(
        {"workspaceId": user["workspaceId"], "kind": "suppliers", "id": supplier_id},
    )
    create_audit(user["workspaceId"], user["name"], "Deleted supplier", "Inventory", supplier_id)
    return {"ok": True}


def create_credit_entry(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "customers.manage")
    entry = {
        "id": str(payload.get("id") or make_id("CRD")),
        "customerId": str(payload.get("customerId", "")).strip(),
        "customerName": str(payload.get("customerName", "")).strip(),
        "saleId": str(payload.get("saleId", "")).strip(),
        "invoiceNo": str(payload.get("invoiceNo", "")).strip(),
        "type": str(payload.get("type", "Credit Sale")).strip() or "Credit Sale",
        "amount": float(payload.get("amount", 0)),
        "date": str(payload.get("date", today_string())),
        "dueDate": str(payload.get("dueDate", "")),
        "paymentMethod": str(payload.get("paymentMethod", "Cash")),
        "note": str(payload.get("note", "")).strip(),
        "createdBy": str(payload.get("createdBy", user["name"])),
        "createdAt": str(payload.get("createdAt") or iso_now()),
    }
    if not entry["customerName"] and entry["customerId"]:
        customer = get_record(user["workspaceId"], "customers", entry["customerId"])
        entry["customerName"] = str((customer or {}).get("name", ""))
    entry = put_record(user["workspaceId"], "credit_ledger", entry)
    sync_credit_balances(user)
    if entry["type"] == "Payment Received":
        remaining = [
            ledger for ledger in list_records(user["workspaceId"], "credit_ledger")
            if ledger.get("customerId") == entry["customerId"]
        ]
        balance = sum(float(item.get("amount", 0)) * (-1 if item.get("type") == "Payment Received" else 1) for item in remaining)
        if balance <= 0:
            for sale in list_records(user["workspaceId"], "sales"):
                if sale.get("customerId") == entry["customerId"] and sale.get("payment") == "Credit" and not sale.get("creditClearedAt"):
                    put_record(user["workspaceId"], "sales", {**sale, "creditClearedAt": iso_now()})
    create_audit(user["workspaceId"], user["name"], "Recorded credit entry", "Customers", f"{entry['customerName']} {entry['type']} {entry['amount']}.")
    return {"entry": entry, "bootstrap": bootstrap_payload(user)}


def create_party(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "parties.manage")
    party = dict(payload)
    party["id"] = str(party.get("id") or make_id("PTY"))
    party["name"] = str(party.get("name", "")).strip() or "Party"
    party["type"] = str(party.get("type", "Customer")).strip() or "Customer"
    party["phone"] = str(party.get("phone", "")).strip()
    party["email"] = str(party.get("email", "")).strip()
    party["address"] = str(party.get("address", "")).strip()
    party["pan"] = str(party.get("pan", "")).strip()
    party["openingBalance"] = float(party.get("openingBalance", 0))
    party["creditLimit"] = float(party.get("creditLimit", 0))
    party["dueDays"] = int(float(party.get("dueDays", 0)))
    party["notes"] = str(party.get("notes", "")).strip()
    party["balance"] = float(party.get("balance", party["openingBalance"]))
    party["createdAt"] = str(party.get("createdAt") or iso_now())
    party = put_record(user["workspaceId"], "parties", party)
    sync_party_balances(user)
    create_audit(user["workspaceId"], user["name"], "Created party", "Parties", party["name"])
    return {"party": party, "bootstrap": bootstrap_payload(user)}


def update_party(user: dict[str, Any], party_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "parties.manage")
    for key in ["openingBalance", "creditLimit", "balance"]:
        if key in patch:
            patch[key] = float(patch.get(key, 0))
    if "dueDays" in patch:
        patch["dueDays"] = int(float(patch.get("dueDays", 0)))
    party = patch_record(user["workspaceId"], "parties", party_id, patch)
    if party is None:
        raise AppError(404, "Party not found.")
    sync_party_balances(user)
    create_audit(user["workspaceId"], user["name"], "Updated party", "Parties", party.get("name", party_id))
    return {"party": party, "bootstrap": bootstrap_payload(user)}


def delete_party(user: dict[str, Any], party_id: str) -> dict[str, Any]:
    require_permission(user, "parties.manage")
    collection("records").delete_many({"workspaceId": user["workspaceId"], "kind": "party_ledger", "payload.partyId": party_id})
    collection("records").delete_one({"workspaceId": user["workspaceId"], "kind": "parties", "id": party_id})
    create_audit(user["workspaceId"], user["name"], "Deleted party", "Parties", party_id)
    return {"ok": True, "bootstrap": bootstrap_payload(user)}


def create_party_ledger_entry(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "parties.manage")
    entry = dict(payload)
    entry["id"] = str(entry.get("id") or make_id("PLG"))
    entry["partyId"] = str(entry.get("partyId", "")).strip()
    entry["partyName"] = str(entry.get("partyName", "")).strip()
    entry["direction"] = str(entry.get("direction", "Receivable")).strip() or "Receivable"
    entry["type"] = str(entry.get("type", "Sale Credit")).strip() or "Sale Credit"
    entry["amount"] = float(entry.get("amount", 0))
    entry["date"] = str(entry.get("date", today_string()))
    entry["dueDate"] = str(entry.get("dueDate", ""))
    entry["referenceId"] = str(entry.get("referenceId", ""))
    entry["note"] = str(entry.get("note", "")).strip()
    entry["createdBy"] = str(entry.get("createdBy", user["name"]))
    entry["createdAt"] = str(entry.get("createdAt") or iso_now())
    if not entry["partyName"] and entry["partyId"]:
        party = get_record(user["workspaceId"], "parties", entry["partyId"])
        entry["partyName"] = str((party or {}).get("name", ""))
    entry = put_record(user["workspaceId"], "party_ledger", entry)
    sync_party_balances(user)
    create_audit(user["workspaceId"], user["name"], "Recorded party ledger", "Parties", f"{entry['partyName']} {entry['type']} {entry['amount']}.")
    return {"entry": entry, "bootstrap": bootstrap_payload(user)}


def create_purchase(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "purchases.manage")
    purchase = dict(payload)
    purchase["id"] = str(purchase.get("id") or make_id("PUR"))
    purchase["createdBy"] = str(purchase.get("createdBy", user["name"]))
    purchase["createdAt"] = str(purchase.get("createdAt") or iso_now())
    purchase = put_record(user["workspaceId"], "purchases", purchase)
    if purchase.get("status") == "Received":
        for item in purchase.get("items", []):
            product = apply_inventory_delta(user, str(item.get("productId", "")), float(item.get("quantity", 0)))
            if product:
                put_record(
                    user["workspaceId"],
                    "inventory_movements",
                    {
                        "id": make_id("MOV"),
                        "businessId": active_business_id_for(user),
                        "productId": product.get("id", ""),
                        "productName": product.get("name", item.get("productName", "")),
                        "delta": float(item.get("quantity", 0)),
                        "stockBefore": max(0.0, float(product.get("stock", 0)) - float(item.get("quantity", 0))),
                        "stockAfter": float(product.get("stock", 0)),
                        "reason": "Purchase",
                        "referenceId": purchase["id"],
                        "note": purchase.get("billNo", ""),
                        "user": user["name"],
                        "createdAt": iso_now(),
                    },
                )
    if purchase.get("payment") == "Credit" and purchase.get("supplierId"):
        supplier = get_record(user["workspaceId"], "suppliers", str(purchase.get("supplierId")))
        if supplier:
            supplier["payableBalance"] = round(float(supplier.get("payableBalance", 0)) + float(purchase.get("amount", 0)), 2)
            put_record(user["workspaceId"], "suppliers", supplier)
    create_journal_entry(
        user,
        "Purchase",
        purchase["id"],
        f"{purchase.get('billNo', purchase['id'])} - {purchase.get('supplierName', '')}",
        [
            {"accountId": "acct-purchases", "accountName": "Purchases / Inventory", "debit": max(0.0, float(purchase.get("amount", 0)) - float(purchase.get("taxTotal", 0))), "credit": 0},
            {"accountId": "acct-vat", "accountName": "VAT Input", "debit": float(purchase.get("taxTotal", 0)), "credit": 0},
            {"accountId": "acct-ap" if purchase.get("payment") == "Credit" else "acct-cash", "accountName": "Accounts Payable" if purchase.get("payment") == "Credit" else "Cash / Bank", "debit": 0, "credit": float(purchase.get("amount", 0))},
        ],
        purchase.get("date"),
    )
    create_audit(user["workspaceId"], user["name"], "Created purchase", "Purchases", purchase.get("billNo", purchase["id"]))
    return {"purchase": purchase, "bootstrap": bootstrap_payload(user)}


def update_purchase(user: dict[str, Any], purchase_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "purchases.manage")
    purchase = patch_record(user["workspaceId"], "purchases", purchase_id, patch)
    if purchase is None:
        raise AppError(404, "Purchase not found.")
    create_audit(user["workspaceId"], user["name"], "Updated purchase", "Purchases", purchase.get("billNo", purchase_id))
    return {"purchase": purchase, "bootstrap": bootstrap_payload(user)}


def delete_purchase(user: dict[str, Any], purchase_id: str) -> dict[str, Any]:
    require_permission(user, "purchases.manage")
    collection("records").delete_one({"workspaceId": user["workspaceId"], "kind": "purchases", "id": purchase_id})
    create_audit(user["workspaceId"], user["name"], "Deleted purchase", "Purchases", purchase_id)
    return {"ok": True, "bootstrap": bootstrap_payload(user)}


def create_expense(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "expenses.manage")
    expense = dict(payload)
    expense["id"] = str(expense.get("id") or make_id("EXP"))
    expense["createdBy"] = str(expense.get("createdBy", user["name"]))
    expense["createdAt"] = str(expense.get("createdAt") or iso_now())
    expense = put_record(user["workspaceId"], "expenses", expense)
    if expense.get("paymentAccountId"):
        movement = put_record(
            user["workspaceId"],
            "money_movements",
            {
                "id": make_id("MOVM"),
                "accountId": expense.get("paymentAccountId", ""),
                "accountName": "",
                "type": "Payment",
                "amount": float(expense.get("amount", 0)),
                "date": expense.get("date", today_string()),
                "referenceId": expense["id"],
                "note": f"{expense.get('category', '')} {expense.get('vendor', '')}".strip(),
                "createdBy": user["name"],
                "createdAt": iso_now(),
            },
        )
        apply_cash_bank_movement(user, movement)
    create_journal_entry(
        user,
        "Expense",
        expense["id"],
        f"{expense.get('category', '')} - {expense.get('vendor', '')}".strip(),
        [
            {"accountId": "acct-expenses", "accountName": "Operating Expenses", "debit": max(0.0, float(expense.get("amount", 0)) - float(expense.get("taxAmount", 0))), "credit": 0},
            {"accountId": "acct-vat", "accountName": "VAT Input", "debit": float(expense.get("taxAmount", 0)), "credit": 0},
            {"accountId": "acct-cash", "accountName": "Cash / Bank", "debit": 0, "credit": float(expense.get("amount", 0))},
        ],
        expense.get("date"),
    )
    create_audit(user["workspaceId"], user["name"], "Created expense", "Expenses", f"{expense.get('category', '')}: {expense.get('amount', 0)}")
    return {"expense": expense, "bootstrap": bootstrap_payload(user)}


def update_expense(user: dict[str, Any], expense_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "expenses.manage")
    expense = patch_record(user["workspaceId"], "expenses", expense_id, patch)
    if expense is None:
        raise AppError(404, "Expense not found.")
    create_audit(user["workspaceId"], user["name"], "Updated expense", "Expenses", expense_id)
    return {"expense": expense, "bootstrap": bootstrap_payload(user)}


def delete_expense(user: dict[str, Any], expense_id: str) -> dict[str, Any]:
    require_permission(user, "expenses.manage")
    collection("records").delete_one({"workspaceId": user["workspaceId"], "kind": "expenses", "id": expense_id})
    create_audit(user["workspaceId"], user["name"], "Deleted expense", "Expenses", expense_id)
    return {"ok": True, "bootstrap": bootstrap_payload(user)}


def expense_category_names(workspace_id: str) -> list[str]:
    names = [str(item.get("name", "")).strip() for item in list_records(workspace_id, "expense_categories")]
    return sorted({name for name in names if name}, key=str.lower)


def create_expense_category(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "expenses.manage")
    name = require_text(payload, "name", "Expense category name")
    existing = {item.lower() for item in expense_category_names(user["workspaceId"])}
    expense_names = {str(item.get("category", "")).strip().lower() for item in list_records(user["workspaceId"], "expenses")}
    if name.lower() in existing or name.lower() in expense_names:
        return {"categories": expense_category_names(user["workspaceId"])}
    put_record(
        user["workspaceId"],
        "expense_categories",
        {
            "id": make_id("EXC"),
            "name": name,
            "createdBy": user["name"],
        },
    )
    create_audit(user["workspaceId"], user["name"], "Created expense category", "Expenses", name)
    return {"categories": expense_category_names(user["workspaceId"])}


def update_expense_category(user: dict[str, Any], old_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "expenses.manage")
    clean_old_name = old_name.strip()
    clean_new_name = require_text(payload, "name", "Expense category name")
    if clean_old_name.lower() == clean_new_name.lower():
        return {"categories": expense_category_names(user["workspaceId"]), "bootstrap": bootstrap_payload(user)}
    categories = list_records(user["workspaceId"], "expense_categories")
    duplicate = next((item for item in categories if str(item.get("name", "")).strip().lower() == clean_new_name.lower()), None)
    if duplicate:
        raise AppError(409, "That expense category already exists.")
    category_record = next((item for item in categories if str(item.get("name", "")).strip().lower() == clean_old_name.lower()), None)
    if category_record:
        put_record(user["workspaceId"], "expense_categories", {**category_record, "name": clean_new_name})
    else:
        put_record(user["workspaceId"], "expense_categories", {"id": make_id("EXC"), "name": clean_new_name, "createdBy": user["name"]})
    for expense in list_records(user["workspaceId"], "expenses"):
        if str(expense.get("category", "")).strip().lower() == clean_old_name.lower():
            put_record(user["workspaceId"], "expenses", {**expense, "category": clean_new_name})
    create_audit(user["workspaceId"], user["name"], "Renamed expense category", "Expenses", f"{clean_old_name} changed to {clean_new_name}.")
    return {"categories": expense_category_names(user["workspaceId"]), "bootstrap": bootstrap_payload(user)}


def delete_expense_category(user: dict[str, Any], name: str) -> dict[str, Any]:
    require_permission(user, "expenses.manage")
    clean_name = name.strip()
    used = any(str(expense.get("category", "")).strip().lower() == clean_name.lower() for expense in list_records(user["workspaceId"], "expenses"))
    if used:
        raise AppError(409, "Move expenses to another category before deleting this category.")
    collection("records").delete_many(
        {
            "workspaceId": user["workspaceId"],
            "kind": "expense_categories",
            "payload.name": {"$regex": f"^{re.escape(clean_name)}$", "$options": "i"},
        }
    )
    create_audit(user["workspaceId"], user["name"], "Deleted expense category", "Expenses", clean_name)
    return {"categories": expense_category_names(user["workspaceId"])}


def create_cash_bank_account(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "cashbank.manage")
    account = dict(payload)
    account["id"] = str(account.get("id") or make_id("ACB"))
    account["createdAt"] = str(account.get("createdAt") or iso_now())
    account = put_record(user["workspaceId"], "cash_bank_accounts", account)
    create_audit(user["workspaceId"], user["name"], "Created cash/bank account", "Cash & Bank", account.get("name", account["id"]))
    return {"account": account, "bootstrap": bootstrap_payload(user)}


def update_cash_bank_account(user: dict[str, Any], account_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "cashbank.manage")
    account = patch_record(user["workspaceId"], "cash_bank_accounts", account_id, patch)
    if account is None:
        raise AppError(404, "Cash or bank account not found.")
    create_audit(user["workspaceId"], user["name"], "Updated cash/bank account", "Cash & Bank", account.get("name", account_id))
    return {"account": account, "bootstrap": bootstrap_payload(user)}


def delete_cash_bank_account(user: dict[str, Any], account_id: str) -> dict[str, Any]:
    require_permission(user, "cashbank.manage")
    has_movements = any(item.get("accountId") == account_id for item in list_records(user["workspaceId"], "money_movements"))
    if has_movements:
        raise AppError(409, "This account has ledger entries. Mark it inactive instead of deleting it.")
    collection("records").delete_one({"workspaceId": user["workspaceId"], "kind": "cash_bank_accounts", "id": account_id})
    create_audit(user["workspaceId"], user["name"], "Deleted cash/bank account", "Cash & Bank", account_id)
    return {"ok": True, "bootstrap": bootstrap_payload(user)}


def create_money_movement(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "cashbank.manage")
    movement = dict(payload)
    movement["id"] = str(movement.get("id") or make_id("MOVM"))
    movement["createdBy"] = str(movement.get("createdBy", user["name"]))
    movement["createdAt"] = str(movement.get("createdAt") or iso_now())
    movement = put_record(user["workspaceId"], "money_movements", movement)
    apply_cash_bank_movement(user, movement)
    create_audit(user["workspaceId"], user["name"], "Recorded money movement", "Cash & Bank", f"{movement.get('type', '')}: {movement.get('amount', 0)}")
    return {"movement": movement, "bootstrap": bootstrap_payload(user)}


def create_document(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "documents.manage")
    document = dict(payload)
    document["id"] = str(document.get("id") or make_id("DOC"))
    document["uploadedBy"] = str(document.get("uploadedBy", user["name"]))
    document["createdAt"] = str(document.get("createdAt") or iso_now())
    document = put_record(user["workspaceId"], "documents", document)
    create_audit(user["workspaceId"], user["name"], "Uploaded document", "Documents", document.get("name", document["id"]))
    return {"document": document, "bootstrap": bootstrap_payload(user)}


def delete_document(user: dict[str, Any], document_id: str) -> dict[str, Any]:
    require_permission(user, "documents.manage")
    collection("records").delete_one({"workspaceId": user["workspaceId"], "kind": "documents", "id": document_id})
    create_audit(user["workspaceId"], user["name"], "Deleted document", "Documents", document_id)
    return {"ok": True, "bootstrap": bootstrap_payload(user)}


def create_reminder_template(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "reminders.manage")
    template = dict(payload)
    template["id"] = str(template.get("id") or make_id("RMT"))
    template = put_record(user["workspaceId"], "reminder_templates", template)
    create_audit(user["workspaceId"], user["name"], "Created reminder template", "Reminders", template.get("name", template["id"]))
    return {"template": template, "bootstrap": bootstrap_payload(user)}


def create_reminder_log(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "reminders.manage")
    log = dict(payload)
    log["id"] = str(log.get("id") or make_id("RML"))
    log["createdBy"] = str(log.get("createdBy", user["name"]))
    log["createdAt"] = str(log.get("createdAt") or iso_now())
    log = put_record(user["workspaceId"], "reminder_logs", log)
    create_audit(user["workspaceId"], user["name"], "Created reminder", "Reminders", log.get("partyName", log["id"]))
    return {"log": log, "bootstrap": bootstrap_payload(user)}


def push_sync_operation(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "sync.manage")
    operation = dict(payload)
    operation["id"] = str(operation.get("id") or make_id("SYN"))
    operation["operationKey"] = str(operation.get("operationKey") or operation["id"])
    existing = collection("records").find_one({"workspaceId": user["workspaceId"], "kind": "sync_operations", "payload.operationKey": operation["operationKey"]})
    if existing:
        return {"operation": strip_mongo_id(existing).get("payload", {}), "bootstrap": bootstrap_payload(user)}
    operation["status"] = "Synced"
    operation["syncedAt"] = iso_now()
    operation = put_record(user["workspaceId"], "sync_operations", operation)
    return {"operation": operation, "bootstrap": bootstrap_payload(user)}


def create_product(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "inventory.manage")
    product = {
        "id": str(payload.get("id") or make_id("PRD")),
        "name": str(payload.get("name", "")).strip() or "Untitled product",
        "description": str(payload.get("description", "")).strip(),
        "sku": str(payload.get("sku", "")).strip() or make_id("SKU"),
        "barcode": str(payload.get("barcode", "")).strip(),
        "brand": str(payload.get("brand", "")).strip(),
        "category": str(payload.get("category", "")).strip() or "General",
        "unit": str(payload.get("unit", "pcs")).strip() or "pcs",
        "stock": float(payload.get("stock", 0)),
        "reorderLevel": float(payload.get("reorderLevel", 0)),
        "price": float(payload.get("price", 0)),
        "costPrice": float(payload.get("costPrice", 0)),
        "taxRate": float(payload.get("taxRate", 13)),
        "supplier": str(payload.get("supplier", "")).strip(),
        "location": str(payload.get("location", "")).strip(),
        "active": bool(payload.get("active", True)),
    }
    product["status"] = stock_status(product["stock"], product["reorderLevel"])
    product = put_record(user["workspaceId"], "inventory", product)
    create_audit(user["workspaceId"], user["name"], "Created product", "Inventory", product.get("name", product["id"]))
    return {"product": product}


def inventory_category_names(workspace_id: str) -> list[str]:
    names = [str(item.get("name", "")).strip() for item in list_records(workspace_id, "inventory_categories")]
    return sorted({name for name in names if name}, key=str.lower)


def create_inventory_category(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "inventory.manage")
    name = require_text(payload, "name", "Category name")
    existing_names = {item.lower() for item in inventory_category_names(user["workspaceId"])}
    product_names = {str(item.get("category", "")).strip().lower() for item in list_records(user["workspaceId"], "inventory")}
    if name.lower() in existing_names or name.lower() in product_names:
        return {"categories": inventory_category_names(user["workspaceId"])}
    put_record(
        user["workspaceId"],
        "inventory_categories",
        {
            "id": make_id("CAT"),
            "name": name,
            "createdBy": user["name"],
        },
    )
    create_audit(user["workspaceId"], user["name"], "Created category", "Inventory", name)
    return {"categories": inventory_category_names(user["workspaceId"])}


def update_inventory_category(user: dict[str, Any], old_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "inventory.manage")
    clean_old_name = old_name.strip()
    clean_new_name = require_text(payload, "name", "Category name")
    if clean_old_name.lower() == clean_new_name.lower():
        return {"categories": inventory_category_names(user["workspaceId"]), "bootstrap": bootstrap_payload(user)}
    categories = list_records(user["workspaceId"], "inventory_categories")
    duplicate = next((item for item in categories if str(item.get("name", "")).strip().lower() == clean_new_name.lower()), None)
    if duplicate:
        raise AppError(409, "That category already exists.")
    category_record = next((item for item in categories if str(item.get("name", "")).strip().lower() == clean_old_name.lower()), None)
    if category_record:
        put_record(user["workspaceId"], "inventory_categories", {**category_record, "name": clean_new_name})
    else:
        put_record(user["workspaceId"], "inventory_categories", {"id": make_id("CAT"), "name": clean_new_name, "createdBy": user["name"]})
    for product in list_records(user["workspaceId"], "inventory"):
        if str(product.get("category", "")).strip().lower() == clean_old_name.lower():
            put_record(user["workspaceId"], "inventory", {**product, "category": clean_new_name})
    create_audit(user["workspaceId"], user["name"], "Renamed category", "Inventory", f"{clean_old_name} changed to {clean_new_name}.")
    return {"categories": inventory_category_names(user["workspaceId"]), "bootstrap": bootstrap_payload(user)}


def delete_inventory_category(user: dict[str, Any], name: str) -> dict[str, Any]:
    require_permission(user, "inventory.manage")
    clean_name = name.strip()
    used = any(str(product.get("category", "")).strip().lower() == clean_name.lower() for product in list_records(user["workspaceId"], "inventory"))
    if used:
        raise AppError(409, "Move products to another category before deleting this category.")
    collection("records").delete_many(
        {
            "workspaceId": user["workspaceId"],
            "kind": "inventory_categories",
            "payload.name": {"$regex": f"^{re.escape(clean_name)}$", "$options": "i"},
        }
    )
    create_audit(user["workspaceId"], user["name"], "Deleted category", "Inventory", clean_name)
    return {"categories": inventory_category_names(user["workspaceId"])}


def create_sale(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "sales.create")
    sale = dict(payload)
    sale["id"] = str(sale.get("id") or make_id("SALE"))
    sale["items"] = normalize_sale_items(user, sale.get("items"))
    sale["amount"] = sale_total(sale["items"], sale.get("status", "Completed"))
    sale.setdefault("auditTrail", [])
    sale.setdefault("createdBy", user["name"])
    sale.setdefault("date", today_string())
    sale.setdefault("payment", "Cash")
    sale.setdefault("status", "Completed")
    sale.setdefault("customerId", make_id("CUST"))
    sale.setdefault("customer", "Walk-in customer")
    sale.setdefault("businessId", active_business_id_for(user))
    settings_doc = collection("settings").find_one({"workspaceId": user["workspaceId"]}) or {}
    sale.setdefault("currency", settings_doc.get("currency", "NPR"))
    sale.setdefault("invoiceNo", f"RP-{sale['id']}")
    sale.setdefault("notes", "")
    sale.setdefault("products", ", ".join(str(item.get("productName", "")) for item in sale["items"]).strip(", "))
    ensure_customer_for_sale(user, sale)
    sale = put_record(user["workspaceId"], "sales", sale)
    if sale.get("payment") == "Credit" and sale.get("status") != "Refunded":
        put_record(
            user["workspaceId"],
            "credit_ledger",
            {
                "id": make_id("CRD"),
                "customerId": sale.get("customerId", ""),
                "customerName": sale.get("customer", ""),
                "saleId": sale.get("id", ""),
                "invoiceNo": sale.get("invoiceNo", ""),
                "type": "Credit Sale",
                "amount": float(sale.get("amount", 0)),
                "date": sale.get("date", today_string()),
                "dueDate": sale.get("creditDueDate", ""),
                "paymentMethod": "Credit",
                "note": sale.get("products", ""),
                "createdBy": user["name"],
                "createdAt": iso_now(),
            },
        )
        sync_credit_balances(user)
    if sale.get("status") != "Refunded":
        for item in sale.get("items", []):
            quantity = float(item.get("quantity", 0))
            apply_inventory_delta(user, item.get("productId", ""), -quantity)
            put_record(
                user["workspaceId"],
                "inventory_movements",
                {
                    "id": make_id("MOV"),
                    "businessId": sale.get("businessId", ""),
                    "productId": item.get("productId", ""),
                    "productName": item.get("productName", ""),
                    "delta": -quantity,
                    "stockBefore": 0,
                    "stockAfter": 0,
                    "reason": "Sale",
                    "referenceId": sale.get("id", ""),
                    "note": sale.get("id", ""),
                    "user": user["name"],
                    "createdAt": iso_now(),
                },
            )
    create_journal_entry(
        user,
        "Sale",
        sale["id"],
        f"{sale.get('invoiceNo', sale['id'])} - {sale.get('customer', '')}",
        [
            {
                "accountId": "acct-cash" if sale.get("payment") != "Credit" else "acct-ar",
                "accountName": "Cash / Bank" if sale.get("payment") != "Credit" else "Accounts Receivable",
                "debit": float(sale.get("amount", 0)),
                "credit": 0,
            },
            {
                "accountId": "acct-sales",
                "accountName": "Sales Revenue",
                "debit": 0,
                "credit": max(0.0, float(sale.get("amount", 0)) - float(sale.get("vatAmount", sale.get("taxTotal", 0)))),
            },
            {
                "accountId": "acct-vat",
                "accountName": "VAT Payable",
                "debit": 0,
                "credit": float(sale.get("vatAmount", sale.get("taxTotal", 0))),
            },
        ],
        sale.get("date"),
    )
    recalculate_customers(user)
    create_audit(user["workspaceId"], user["name"], "Created sale", "Sales", f"{sale.get('id')} recorded.")
    return {"sale": sale, "bootstrap": bootstrap_payload(user)}


def patch_sale(user: dict[str, Any], sale_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "sales.update")
    old_sale = get_record(user["workspaceId"], "sales", sale_id)
    if not old_sale:
        raise AppError(404, "Sale not found.")
    new_sale = {**old_sale, **patch, "id": sale_id}
    new_sale["items"] = normalize_sale_items(user, new_sale.get("items"))
    old_applied = old_sale.get("status") != "Refunded" and not old_sale.get("deletedAt")
    new_applied = new_sale.get("status") != "Refunded" and not new_sale.get("deletedAt")
    if old_applied != new_applied:
        direction = 1 if old_applied and not new_applied else -1
        reason = "Return" if direction > 0 else "Sale"
        for item in old_sale.get("items", []):
            delta = direction * float(item.get("quantity", 0))
            apply_inventory_delta(user, item.get("productId", ""), delta)
            put_record(
                user["workspaceId"],
                "inventory_movements",
                {
                    "id": make_id("MOV"),
                    "businessId": old_sale.get("businessId", ""),
                    "productId": item.get("productId", ""),
                    "productName": item.get("productName", ""),
                    "delta": delta,
                    "stockBefore": 0,
                    "stockAfter": 0,
                    "reason": reason,
                    "referenceId": sale_id,
                    "note": f"{sale_id} status change",
                    "user": user["name"],
                    "createdAt": iso_now(),
                },
            )
    new_sale["amount"] = sale_total(new_sale.get("items", []), new_sale.get("status", "Completed"))
    sale = put_record(user["workspaceId"], "sales", new_sale)
    recalculate_customers(user)
    create_audit(user["workspaceId"], user["name"], "Updated sale", "Sales", sale_id)
    return {"sale": sale}


def delete_sale(user: dict[str, Any], sale_id: str) -> dict[str, bool]:
    require_permission(user, "sales.delete")
    sale = get_record(user["workspaceId"], "sales", sale_id)
    if not sale:
        raise AppError(404, "Sale not found.")
    if not sale.get("deletedAt") and sale.get("status") != "Refunded":
        for item in sale.get("items", []):
            apply_inventory_delta(user, item.get("productId", ""), float(item.get("quantity", 0)))
    sale["deletedAt"] = today_string()
    sale["auditTrail"] = [f"Soft-deleted by {user['name']}", *sale.get("auditTrail", [])]
    put_record(user["workspaceId"], "sales", sale)
    recalculate_customers(user)
    create_audit(user["workspaceId"], user["name"], "Soft-deleted sale", "Sales", sale_id)
    return {"ok": True}


def create_movement(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "inventory.manage")
    movement = dict(payload)
    movement["id"] = str(movement.get("id") or make_id("MOV"))
    movement.setdefault("productId", "")
    movement.setdefault("businessId", active_business_id_for(user))
    movement.setdefault("createdAt", iso_now())
    movement.setdefault("user", user["name"])
    movement.setdefault("delta", 0)
    movement.setdefault("reason", "Correction")
    movement.setdefault("note", "")
    product = get_record(user["workspaceId"], "inventory", str(movement.get("productId", "")))
    movement.setdefault("productName", product.get("name", "") if product else "")
    stock_before = float((product or {}).get("stock", 0))
    movement.setdefault("stockBefore", stock_before)
    movement.setdefault("stockAfter", max(0.0, stock_before + float(movement.get("delta", 0))))
    movement.setdefault("referenceId", "")
    movement = put_record(user["workspaceId"], "inventory_movements", movement)
    apply_inventory_delta(user, movement.get("productId", ""), float(movement.get("delta", 0)))
    create_audit(user["workspaceId"], user["name"], "Recorded stock movement", "Inventory", movement.get("productName", movement["id"]))
    return {"movement": movement, "bootstrap": bootstrap_payload(user)}


def create_report(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "reports.generate")
    report = dict(payload)
    report["id"] = str(report.get("id") or make_id("RPT"))
    report.setdefault("title", "Untitled report")
    report.setdefault("type", "Executive")
    report.setdefault("template", "Executive")
    report.setdefault("range", "Custom")
    report.setdefault("status", "Ready")
    report.setdefault("format", "HTML")
    report.setdefault("createdBy", user["name"])
    report.setdefault("downloadUrl", "")
    report.setdefault("scheduledAt", "")
    report.setdefault("createdAt", iso_now())
    report = put_record(user["workspaceId"], "reports", report)
    create_audit(user["workspaceId"], user["name"], "Generated report", "Reports", report.get("title", report["id"]))
    return {"report": report}


def update_settings(user: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "settings.manage")
    allowed = set(EMPTY_SETTINGS)
    updates = {key: value for key, value in patch.items() if key in allowed}
    defaults = {"workspaceId": user["workspaceId"], **{key: value for key, value in EMPTY_SETTINGS.items() if key not in updates}}
    collection("settings").update_one({"workspaceId": user["workspaceId"]}, {"$setOnInsert": defaults, "$set": updates}, upsert=True)
    if "businessName" in patch:
        collection("workspaces").update_one({"id": user["workspaceId"]}, {"$set": {"name": str(patch["businessName"]), "updatedAt": iso_now()}})
    if "timezone" in patch:
        collection("workspaces").update_one({"id": user["workspaceId"]}, {"$set": {"timezone": str(patch["timezone"]), "updatedAt": iso_now()}})
    create_audit(user["workspaceId"], user["name"], "Updated settings", "Settings", "Business settings changed.")
    return {"settings": settings_payload(strip_mongo_id(collection("settings").find_one({"workspaceId": user["workspaceId"]})))}


def update_billing_plan(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "billing.manage")
    plan = str(payload.get("plan", "free"))
    billing_cycle = str(payload.get("billingCycle", "monthly"))
    if plan not in {"free", "pro"}:
        raise AppError(400, "Plan must be free or pro.")
    if billing_cycle not in {"monthly", "annual"}:
        raise AppError(400, "Billing cycle must be monthly or annual.")
    collection("workspaces").update_one(
        {"id": user["workspaceId"]},
        {"$set": {"plan": plan, "billingCycle": billing_cycle, "status": "Active", "subscriptionStatus": "active", "planStartedAt": iso_now(), "updatedAt": iso_now()}},
    )
    record = payload.get("record")
    if isinstance(record, dict):
        put_record(user["workspaceId"], "billing_history", record)
    create_audit(user["workspaceId"], user["name"], "Updated billing", "Billing", f"{plan} {billing_cycle} plan selected.")
    user = hydrate_user(collection("users").find_one({"id": user["id"]})) or user
    return {"bootstrap": bootstrap_payload(user)}


def create_role(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "roles.manage")
    name = require_text(payload, "name", "Role name")
    permissions = payload.get("permissions")
    if not isinstance(permissions, list) or not permissions:
        raise AppError(400, "Role requires at least one permission.")
    if role_by_name(user["workspaceId"], name):
        raise AppError(409, "Role already exists.")
    role = {
        "id": str(payload.get("id") or make_id("role")),
        "workspaceId": user["workspaceId"],
        "name": name,
        "slug": slugify(name),
        "description": str(payload.get("description", "")),
        "systemRole": False,
        "permissions": permissions,
        "createdBy": user["id"],
        "createdAt": iso_now(),
        "updatedAt": iso_now(),
    }
    collection("roles").insert_one(role)
    create_audit(user["workspaceId"], user["name"], "Created role", "Team", f"{name} role created.")
    return {"role": role_payload(role)}


def update_role(user: dict[str, Any], role_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "roles.manage")
    role = strip_mongo_id(collection("roles").find_one({"id": role_id, "workspaceId": user["workspaceId"]}))
    if role is None:
        raise AppError(404, "Role not found.")
    if role["name"] == "Owner":
        raise AppError(400, "Owner role cannot be edited.")
    old_name = role["name"]
    updates: dict[str, Any] = {}
    if not role.get("systemRole") and patch.get("name"):
        updates["name"] = str(patch["name"]).strip()
    if "description" in patch:
        updates["description"] = str(patch["description"])
    if "permissions" in patch and isinstance(patch["permissions"], list):
        updates["permissions"] = patch["permissions"]
    if "name" in updates:
        updates["slug"] = slugify(str(updates["name"]))
    if updates:
        updates["updatedAt"] = iso_now()
    if updates:
        collection("roles").update_one({"id": role_id}, {"$set": updates})
    next_role = strip_mongo_id(collection("roles").find_one({"id": role_id})) or role
    if next_role["name"] != old_name:
        collection("users").update_many({"workspaceId": user["workspaceId"], "role": old_name}, {"$set": {"role": next_role["name"]}})
    create_audit(user["workspaceId"], user["name"], "Updated role", "Team", f"{old_name} role changed.")
    return {"role": role_payload(next_role)}


def delete_role(user: dict[str, Any], role_id: str) -> dict[str, Any]:
    require_permission(user, "roles.manage")
    role = strip_mongo_id(collection("roles").find_one({"id": role_id, "workspaceId": user["workspaceId"]}))
    if role is None:
        raise AppError(404, "Role not found.")
    if role.get("systemRole"):
        raise AppError(400, "System roles cannot be deleted.")
    fallback = role_by_name(user["workspaceId"], "Staff")
    collection("users").update_many({"workspaceId": user["workspaceId"], "roleId": role_id}, {"$set": {"role": "Staff", "roleId": fallback.get("id") if fallback else None}})
    collection("roles").delete_one({"id": role_id})
    create_audit(user["workspaceId"], user["name"], "Deleted role", "Team", f"{role['name']} role deleted.")
    return {"ok": True, "fallbackRole": "Staff"}


def invite_user(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "users.invite")
    name = require_text(payload, "name", "Name")
    email = require_email(require_text(payload, "email", "Email"))
    role_name = require_text(payload, "role", "Role")
    if collection("users").find_one({"emailNormalized": normalize_email(email)}):
        raise AppError(409, "A user already exists for this email.")
    role = role_by_name(user["workspaceId"], role_name)
    if role is None:
        raise AppError(400, "Role not found.")
    salt, digest = hash_password(new_token("invite"))
    invited = {
        "id": str(payload.get("id") or make_id("usr")),
        "workspaceId": user["workspaceId"],
        "roleId": role["id"],
        "name": name,
        "email": email,
        "emailNormalized": normalize_email(email),
        "role": role["name"],
        "status": "Invited",
        "lastActive": "Pending invite",
        "phone": str(payload.get("phone", "")),
        "avatarUrl": "",
        "locale": str(payload.get("locale", "en-NP")),
        "isEmailVerified": False,
        "invitedBy": user["id"],
        "lastLoginAt": "",
        "passwordSalt": salt,
        "passwordHash": digest,
        "createdAt": iso_now(),
        "updatedAt": iso_now(),
    }
    collection("users").insert_one(invited)
    invited = hydrate_user(invited) or invited
    create_audit(user["workspaceId"], user["name"], "Invited user", "Team", f"{email} invited as {role['name']}.")
    return {"user": user_payload(invited)}


def update_user_role(user: dict[str, Any], target_user_id: str, role_name: str) -> dict[str, Any]:
    require_permission(user, "users.manage")
    target = strip_mongo_id(collection("users").find_one({"id": target_user_id, "workspaceId": user["workspaceId"]}))
    if target is None:
        raise AppError(404, "User not found.")
    role = role_by_name(user["workspaceId"], role_name)
    if role is None:
        raise AppError(400, "Role not found.")
    collection("users").update_one({"id": target_user_id}, {"$set": {"role": role["name"], "roleId": role["id"], "updatedAt": iso_now()}})
    target = hydrate_user(collection("users").find_one({"id": target_user_id})) or target
    create_audit(user["workspaceId"], user["name"], "Changed user role", "Team", f"{target['email']} changed to {role['name']}.")
    return {"user": user_payload(target)}


def platform_admin_payload(admin: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": admin["id"],
        "name": admin.get("name", ""),
        "email": admin.get("email", ""),
        "role": admin.get("role", "Super Admin"),
        "status": admin.get("status", "Active"),
        "lastActive": admin.get("lastActive", ""),
        "phone": admin.get("phone", ""),
        "permissions": list(admin.get("permissions", [])),
        "lastLoginAt": admin.get("lastLoginAt", ""),
        "createdBy": admin.get("createdBy", ""),
        "createdAt": admin.get("createdAt", ""),
        "updatedAt": admin.get("updatedAt", admin.get("createdAt", "")),
    }


def platform_state() -> dict[str, Any]:
    owner_exists = collection("platform_admins").count_documents({"role": "Platform Owner"}) > 0
    return {
        "ownerExists": owner_exists,
        "adminCount": collection("platform_admins").count_documents({}),
        "setupRequired": collection("platform_admins").count_documents({}) == 0,
        "setupTokenRequired": bool(settings.PLATFORM_SETUP_TOKEN),
    }


def create_platform_session(admin: dict[str, Any]) -> dict[str, str]:
    access_token = new_token("rp_platform")
    expires_at = future_iso(minutes=settings.SESSION_TTL_MINUTES)
    collection("platform_sessions").insert_one(
        {
            "accessTokenHash": hash_token(access_token),
            "adminId": admin["id"],
            "expiresAt": expires_at,
            "userAgent": "",
            "ipAddress": "",
            "createdAt": iso_now(),
            "revokedAt": None,
        }
    )
    return {"accessToken": access_token, "expiresAt": expires_at}


def authenticate_platform_token(access_token: str | None) -> dict[str, Any]:
    if not access_token:
        raise AppError(401, "Missing platform bearer token.")
    session = collection("platform_sessions").find_one({"accessTokenHash": hash_token(access_token)})
    if session is None or session.get("revokedAt") is not None:
        raise AppError(401, "Invalid platform session.")
    if str(session.get("expiresAt", "")) <= iso_now():
        raise AppError(401, "Platform session expired.")
    admin = strip_mongo_id(collection("platform_admins").find_one({"id": session["adminId"]}))
    if admin is None or admin.get("status") != "Active":
        raise AppError(403, "Platform admin is not active.")
    admin["lastActive"] = iso_now()
    collection("platform_admins").update_one({"id": admin["id"]}, {"$set": {"lastActive": admin["lastActive"], "updatedAt": admin["lastActive"]}})
    return admin


def platform_bootstrap(admin: dict[str, Any]) -> dict[str, Any]:
    admins = [strip_mongo_id(row) or {} for row in collection("platform_admins").find({}).sort("createdAt", 1)]
    organizations = platform_organizations()
    feature_flags = platform_feature_flags()
    support_tickets = platform_support_tickets()
    security_sessions = platform_security_sessions()
    mrr = sum(float(item.get("mrr", 0)) for item in organizations)
    return {
        "admin": platform_admin_payload(admin),
        "admins": [platform_admin_payload(item) for item in admins],
        "organizations": organizations,
        "featureFlags": feature_flags,
        "supportTickets": support_tickets,
        "securitySessions": security_sessions,
        "database": {
            "status": "online",
            "name": settings.MONGO_DB_NAME,
            "counts": mongo_counts(),
            "checkedAt": iso_now(),
        },
        "metrics": {
            "mrr": mrr,
            "arr": mrr * 12,
            "tenants": len(organizations),
            "activeTenants": len([item for item in organizations if item.get("status") == "Active"]),
            "trialTenants": len([item for item in organizations if item.get("status") == "Trial"]),
            "riskTenants": len([item for item in organizations if item.get("status") in {"At Risk", "Suspended", "Expired"}]),
            "expiredTenants": len([item for item in organizations if item.get("status") == "Expired"]),
            "users": sum(int(item.get("users", 0)) for item in organizations),
            "salesEntries": sum(int(item.get("salesEntries", 0)) for item in organizations),
            "openTickets": len([item for item in support_tickets if item.get("status") != "Resolved"]),
            "enabledFlags": len([item for item in feature_flags if item.get("enabled")]),
            "activeSessions": len([item for item in security_sessions if item.get("status") == "Active"]),
        },
    }


def setup_platform_owner(data: dict[str, Any]) -> dict[str, Any]:
    if collection("platform_admins").count_documents({}) > 0:
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
    now = iso_now()
    admin = {
        "id": make_id("padm"),
        "name": name,
        "email": email,
        "emailNormalized": normalize_email(email),
        "role": "Platform Owner",
        "status": "Active",
        "lastActive": now,
        "phone": str(data.get("phone", "")),
        "permissions": ["platform.owner"],
        "lastLoginAt": now,
        "passwordSalt": salt,
        "passwordHash": digest,
        "createdBy": "system",
        "createdAt": now,
        "updatedAt": now,
    }
    collection("platform_admins").insert_one(admin)
    return {"session": create_platform_session(admin), "bootstrap": platform_bootstrap(admin)}


def login_platform_admin(data: dict[str, Any]) -> dict[str, Any]:
    email = require_text(data, "email", "Email")
    password = require_text(data, "password", "Password")
    admin = strip_mongo_id(collection("platform_admins").find_one({"emailNormalized": normalize_email(email)}))
    if admin is None or not verify_password(password, admin.get("passwordSalt", ""), admin.get("passwordHash", "")):
        raise AppError(401, "Invalid platform email or password.")
    if admin.get("status") != "Active":
        raise AppError(403, "Platform admin is not active.")
    admin["lastActive"] = iso_now()
    collection("platform_admins").update_one({"id": admin["id"]}, {"$set": {"lastActive": admin["lastActive"], "lastLoginAt": admin["lastActive"], "updatedAt": admin["lastActive"]}})
    return {"session": create_platform_session(admin), "bootstrap": platform_bootstrap(admin)}


def logout_platform_admin(access_token: str | None) -> dict[str, bool]:
    if access_token:
        collection("platform_sessions").update_many({"accessTokenHash": hash_token(access_token)}, {"$set": {"revokedAt": iso_now()}})
    return {"ok": True}


def create_platform_admin(actor: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
    if actor.get("role") != "Platform Owner":
        raise AppError(403, "Only the platform owner can create platform admins.")
    name = require_text(data, "name", "Admin name")
    email = require_email(require_text(data, "email", "Email"))
    password = require_text(data, "password", "Temporary password")
    role = str(data.get("role", "Super Admin")).strip() or "Super Admin"
    if role not in {"Super Admin", "Support Admin"}:
        raise AppError(400, "Choose Super Admin or Support Admin.")
    if len(password) < 10:
        raise AppError(400, "Temporary password must be at least 10 characters.")
    if collection("platform_admins").find_one({"emailNormalized": normalize_email(email)}):
        raise AppError(409, "A platform admin already exists for this email.")
    salt, digest = hash_password(password)
    admin = {
        "id": make_id("padm"),
        "name": name,
        "email": email,
        "emailNormalized": normalize_email(email),
        "role": role,
        "status": "Active",
        "lastActive": "Never",
        "phone": str(data.get("phone", "")),
        "permissions": ["platform.manage"] if role == "Super Admin" else ["platform.support"],
        "lastLoginAt": "",
        "passwordSalt": salt,
        "passwordHash": digest,
        "createdBy": actor["email"],
        "createdAt": iso_now(),
        "updatedAt": iso_now(),
    }
    collection("platform_admins").insert_one(admin)
    return {"admin": platform_admin_payload(admin), "bootstrap": platform_bootstrap(actor)}


def delete_platform_admin(actor: dict[str, Any], admin_id: str) -> dict[str, Any]:
    if actor.get("role") != "Platform Owner":
        raise AppError(403, "Only the platform owner can delete platform admins.")
    target = strip_mongo_id(collection("platform_admins").find_one({"id": admin_id}))
    if target is None:
        raise AppError(404, "Platform admin not found.")
    if target.get("role") == "Platform Owner":
        raise AppError(400, "The platform owner account cannot be deleted.")
    collection("platform_sessions").update_many({"adminId": admin_id}, {"$set": {"revokedAt": iso_now()}})
    collection("platform_admins").delete_one({"id": admin_id})
    return {"ok": True, "bootstrap": platform_bootstrap(actor)}


def patch_platform_admin(actor: dict[str, Any], admin_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    if actor.get("role") != "Platform Owner":
        raise AppError(403, "Only the platform owner can manage platform admins.")
    target = strip_mongo_id(collection("platform_admins").find_one({"id": admin_id}))
    if target is None:
        raise AppError(404, "Platform admin not found.")
    if target.get("role") == "Platform Owner" and target.get("id") != actor.get("id"):
        raise AppError(403, "The platform owner account cannot be changed by another admin.")

    updates: dict[str, Any] = {}
    if "name" in patch:
        updates["name"] = require_text(patch, "name", "Admin name")
    if "status" in patch:
        status = str(patch.get("status", "")).strip()
        if status not in PLATFORM_ADMIN_STATUSES:
            raise AppError(400, "Choose Active, Invited, or Suspended.")
        if target.get("role") == "Platform Owner" and status != "Active":
            raise AppError(400, "The platform owner must remain active.")
        updates["status"] = status
    if "role" in patch:
        role = str(patch.get("role", "")).strip()
        if role not in {"Super Admin", "Support Admin"}:
            raise AppError(400, "Choose Super Admin or Support Admin.")
        if target.get("role") == "Platform Owner":
            raise AppError(400, "The platform owner role cannot be changed.")
        updates["role"] = role
        updates["permissions"] = ["platform.manage"] if role == "Super Admin" else ["platform.support"]
    if "password" in patch and str(patch.get("password", "")).strip():
        password = str(patch.get("password", "")).strip()
        if len(password) < 10:
            raise AppError(400, "Temporary password must be at least 10 characters.")
        salt, digest = hash_password(password)
        updates["passwordSalt"] = salt
        updates["passwordHash"] = digest

    if updates:
        updates["updatedAt"] = iso_now()
        collection("platform_admins").update_one({"id": admin_id}, {"$set": updates})
        if ("status" in updates and updates["status"] != "Active") or "passwordHash" in updates:
            collection("platform_sessions").update_many({"adminId": admin_id}, {"$set": {"revokedAt": iso_now()}})

    updated = strip_mongo_id(collection("platform_admins").find_one({"id": admin_id})) or target
    return {"admin": platform_admin_payload(updated), "bootstrap": platform_bootstrap(actor)}


def create_platform_organization(actor: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
    require_platform_role(actor, {"Platform Owner", "Super Admin"}, "Tenant creation requires Super Admin access.")
    business_name = require_text(data, "businessName", "Business name")
    owner_name = require_text(data, "ownerName", "Owner name")
    owner_email = require_email(require_text(data, "ownerEmail", "Owner email"))
    password = require_text(data, "password", "Temporary password")
    if len(password) < 10:
        raise AppError(400, "Temporary password must be at least 10 characters.")
    if collection("users").find_one({"emailNormalized": normalize_email(owner_email)}):
        raise AppError(409, "A user already exists for this owner email.")
    plan = str(data.get("plan", "free")).strip() or "free"
    status = str(data.get("status", "Trial")).strip() or "Trial"
    if plan not in PLATFORM_PLANS:
        raise AppError(400, "Choose a valid plan.")
    if status not in PLATFORM_ORG_STATUSES:
        raise AppError(400, "Choose a valid tenant status.")
    salt, digest = hash_password(password)
    owner = create_workspace_with_owner(owner_name, owner_email, salt, digest, business_name)
    workspace_id = owner["workspaceId"]
    updates = {
        "name": business_name,
        "category": str(data.get("category", "General")).strip() or "General",
        "address": str(data.get("address", "")).strip(),
        "country": str(data.get("country", "NP")).strip() or "NP",
        "timezone": str(data.get("timezone", "Asia/Kathmandu")).strip() or "Asia/Kathmandu",
        "plan": plan,
        "status": status,
        "subscriptionStatus": subscription_status_for_workspace_status(status),
        "updatedAt": iso_now(),
    }
    collection("workspaces").update_one({"id": workspace_id}, {"$set": updates})
    collection("businesses").update_one(
        {"workspaceId": workspace_id, "isPrimary": True},
        {"$set": {"name": business_name, "category": updates["category"], "address": updates["address"], "updatedAt": iso_now()}},
    )
    organization = next((item for item in platform_organizations() if item["id"] == workspace_id), None)
    return {"organization": organization, "bootstrap": platform_bootstrap(actor)}


def patch_platform_organization(actor: dict[str, Any], org_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    require_platform_role(actor, {"Platform Owner", "Super Admin"}, "Platform organization controls require Super Admin access.")
    workspace = strip_mongo_id(collection("workspaces").find_one({"id": org_id}))
    if workspace is None:
        raise AppError(404, "Organization not found.")
    allowed = {"plan", "status", "name", "category", "address"}
    updates = {key: patch[key] for key in allowed if key in patch}
    if "plan" in updates and updates["plan"] not in PLATFORM_PLANS:
        raise AppError(400, "Choose a valid plan.")
    if "status" in updates and updates["status"] not in PLATFORM_ORG_STATUSES:
        raise AppError(400, "Choose a valid tenant status.")
    if updates:
        if "status" in updates:
            updates["subscriptionStatus"] = subscription_status_for_workspace_status(str(updates["status"]))
        updates["updatedAt"] = iso_now()
        collection("workspaces").update_one({"id": org_id}, {"$set": updates})
    organization = next((item for item in platform_organizations() if item["id"] == org_id), None)
    return {"organization": organization, "bootstrap": platform_bootstrap(actor)}


def delete_platform_organization(actor: dict[str, Any], org_id: str) -> dict[str, Any]:
    require_platform_role(actor, {"Platform Owner", "Super Admin"}, "Tenant deletion requires Super Admin access.")
    workspace = strip_mongo_id(collection("workspaces").find_one({"id": org_id, "deletedAt": {"$exists": False}}))
    if workspace is None:
        raise AppError(404, "Organization not found.")
    now = iso_now()
    user_ids = [item["id"] for item in collection("users").find({"workspaceId": org_id}, {"id": 1})]
    if user_ids:
        collection("sessions").update_many({"userId": {"$in": user_ids}}, {"$set": {"revokedAt": now}})
    collection("workspaces").update_one(
        {"id": org_id},
        {"$set": {"status": "Expired", "subscriptionStatus": "expired", "deletedAt": now, "updatedAt": now}},
    )
    collection("records").update_many({"workspaceId": org_id}, {"$set": {"deletedAt": now}})
    return {"ok": True, "bootstrap": platform_bootstrap(actor)}


def create_platform_feature_flag(actor: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
    require_platform_role(actor, {"Platform Owner", "Super Admin"}, "Feature flag controls require Super Admin access.")
    name = require_text(data, "name", "Feature name")
    area = str(data.get("area", "Platform")).strip() or "Platform"
    risk = str(data.get("risk", "Low")).strip() or "Low"
    rollout = int(data.get("rollout", 0))
    if area not in FEATURE_AREAS:
        raise AppError(400, "Choose a valid feature area.")
    if risk not in FEATURE_RISKS:
        raise AppError(400, "Choose Low, Medium, or High risk.")
    if rollout < 0 or rollout > 100:
        raise AppError(400, "Rollout must be between 0 and 100.")
    now = iso_now()
    flag = {
        "id": make_id("pflag"),
        "name": name,
        "description": str(data.get("description", "")).strip(),
        "area": area,
        "enabled": bool(data.get("enabled", False)),
        "rollout": rollout,
        "risk": risk,
        "createdAt": now,
        "updatedAt": now,
    }
    collection("platform_feature_flags").insert_one(flag)
    return {"featureFlag": strip_mongo_id(flag) or flag, "bootstrap": platform_bootstrap(actor)}


def patch_platform_feature_flag(actor: dict[str, Any], flag_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    require_platform_role(actor, {"Platform Owner", "Super Admin"}, "Feature flag controls require Super Admin access.")
    ensure_platform_feature_flags()
    flag = strip_mongo_id(collection("platform_feature_flags").find_one({"id": flag_id}))
    if flag is None:
        raise AppError(404, "Feature flag not found.")
    updates: dict[str, Any] = {}
    if "enabled" in patch:
        updates["enabled"] = bool(patch.get("enabled"))
    if "rollout" in patch:
        rollout = int(patch.get("rollout", 0))
        if rollout < 0 or rollout > 100:
            raise AppError(400, "Rollout must be between 0 and 100.")
        updates["rollout"] = rollout
    if "risk" in patch:
        risk = str(patch.get("risk", "")).strip()
        if risk not in FEATURE_RISKS:
            raise AppError(400, "Choose Low, Medium, or High risk.")
        updates["risk"] = risk
    if "area" in patch:
        area = str(patch.get("area", "")).strip()
        if area not in FEATURE_AREAS:
            raise AppError(400, "Choose a valid feature area.")
        updates["area"] = area
    if "description" in patch:
        updates["description"] = str(patch.get("description", "")).strip()
    if updates:
        updates["updatedAt"] = iso_now()
        collection("platform_feature_flags").update_one({"id": flag_id}, {"$set": updates})
    updated = strip_mongo_id(collection("platform_feature_flags").find_one({"id": flag_id})) or flag
    return {"featureFlag": updated, "bootstrap": platform_bootstrap(actor)}


def delete_platform_feature_flag(actor: dict[str, Any], flag_id: str) -> dict[str, Any]:
    require_platform_role(actor, {"Platform Owner", "Super Admin"}, "Feature flag controls require Super Admin access.")
    if flag_id in DEFAULT_PLATFORM_FLAG_IDS:
        raise AppError(400, "Default platform flags cannot be deleted. Disable them instead.")
    result = collection("platform_feature_flags").delete_one({"id": flag_id})
    if result.deleted_count == 0:
        raise AppError(404, "Feature flag not found.")
    return {"ok": True, "bootstrap": platform_bootstrap(actor)}


def create_platform_support_ticket(actor: dict[str, Any], data: dict[str, Any]) -> dict[str, Any]:
    require_platform_role(actor, {"Platform Owner", "Super Admin", "Support Admin"}, "Support desk access is required.")
    org_id = require_text(data, "orgId", "Tenant")
    workspace = strip_mongo_id(collection("workspaces").find_one({"id": org_id}))
    if workspace is None:
        raise AppError(404, "Tenant organization not found.")
    subject = require_text(data, "subject", "Subject")
    priority = str(data.get("priority", "Medium")).strip()
    if priority not in SUPPORT_PRIORITIES:
        raise AppError(400, "Choose a valid priority.")
    now = iso_now()
    ticket = put_record(
        org_id,
        "support_tickets",
        {
            "id": make_id("TIC"),
            "orgId": org_id,
            "orgName": workspace.get("name", ""),
            "subject": subject,
            "priority": priority,
            "status": "Open",
            "assignedTo": str(data.get("assignedTo") or actor.get("email", "")),
            "channel": str(data.get("channel", "Portal")),
            "createdAt": now,
            "lastUpdatedAt": now,
        },
    )
    return {"supportTicket": ticket, "bootstrap": platform_bootstrap(actor)}


def patch_platform_support_ticket(actor: dict[str, Any], ticket_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    require_platform_role(actor, {"Platform Owner", "Super Admin", "Support Admin"}, "Support desk access is required.")
    record = collection("records").find_one({"kind": "support_tickets", "id": ticket_id})
    if record is None:
        raise AppError(404, "Support ticket not found.")
    updates: dict[str, Any] = {}
    if "status" in patch:
        status = str(patch.get("status", "")).strip()
        if status not in SUPPORT_STATUSES:
            raise AppError(400, "Choose Open, Watching, or Resolved.")
        updates["status"] = status
    if "priority" in patch:
        priority = str(patch.get("priority", "")).strip()
        if priority not in SUPPORT_PRIORITIES:
            raise AppError(400, "Choose a valid priority.")
        updates["priority"] = priority
    if "assignedTo" in patch:
        updates["assignedTo"] = str(patch.get("assignedTo", "")).strip()
    if "subject" in patch:
        updates["subject"] = require_text(patch, "subject", "Subject")
    if updates:
        updates["lastUpdatedAt"] = iso_now()
    ticket = patch_record(str(record["workspaceId"]), "support_tickets", ticket_id, updates) or dict(record.get("payload", {}))
    return {"supportTicket": ticket, "bootstrap": platform_bootstrap(actor)}


def delete_platform_support_ticket(actor: dict[str, Any], ticket_id: str) -> dict[str, Any]:
    require_platform_role(actor, {"Platform Owner", "Super Admin", "Support Admin"}, "Support desk access is required.")
    record = collection("records").find_one({"kind": "support_tickets", "id": ticket_id})
    if record is None:
        raise AppError(404, "Support ticket not found.")
    now = iso_now()
    collection("records").update_one(
        {"workspaceId": record["workspaceId"], "kind": "support_tickets", "id": ticket_id},
        {"$set": {"deletedAt": now, "payload.deletedAt": now, "payload.lastUpdatedAt": now}},
    )
    return {"ok": True, "bootstrap": platform_bootstrap(actor)}


def revoke_platform_session(actor: dict[str, Any], session_id: str) -> dict[str, Any]:
    require_platform_role(actor, {"Platform Owner", "Super Admin"}, "Session controls require Super Admin access.")
    result = collection("platform_sessions").update_one({"accessTokenHash": session_id}, {"$set": {"revokedAt": iso_now()}})
    if result.matched_count == 0:
        raise AppError(404, "Platform session not found.")
    return {"ok": True, "bootstrap": platform_bootstrap(actor)}


def backfill_schema_defaults() -> None:
    ensure_platform_feature_flags()
    now = iso_now()
    for workspace in collection("workspaces").find({}):
        owner = collection("users").find_one({"workspaceId": workspace["id"], "role": "Owner"})
        defaults = {
            "country": "NP",
            "timezone": "Asia/Kathmandu",
            "locale": "en-NP",
            "subscriptionStatus": subscription_status_for_workspace_status(str(workspace.get("status", "Trial"))),
            "planStartedAt": workspace.get("createdAt", now),
            "ownerUserId": (owner or {}).get("id", ""),
            "updatedAt": workspace.get("createdAt", now),
        }
        missing = {key: value for key, value in defaults.items() if key not in workspace}
        if missing:
            collection("workspaces").update_one({"id": workspace["id"]}, {"$set": missing})

    for business in collection("businesses").find({}):
        defaults = {"phone": "", "email": "", "taxId": "", "currency": "NPR", "isPrimary": False, "updatedAt": business.get("createdAt", now)}
        missing = {key: value for key, value in defaults.items() if key not in business}
        if missing:
            collection("businesses").update_one({"id": business["id"]}, {"$set": missing})

    for role in collection("roles").find({}):
        defaults = {"slug": slugify(role.get("name", "")), "createdBy": "system", "updatedAt": role.get("createdAt", now)}
        missing = {key: value for key, value in defaults.items() if key not in role}
        if missing:
            collection("roles").update_one({"id": role["id"]}, {"$set": missing})

    for user in collection("users").find({}):
        defaults = {
            "phone": "",
            "avatarUrl": "",
            "locale": "en-NP",
            "isEmailVerified": False,
            "invitedBy": "",
            "lastLoginAt": "",
            "updatedAt": user.get("createdAt", now),
        }
        missing = {key: value for key, value in defaults.items() if key not in user}
        if missing:
            collection("users").update_one({"id": user["id"]}, {"$set": missing})

    for settings_doc in collection("settings").find({}):
        missing = {key: value for key, value in EMPTY_SETTINGS.items() if key not in settings_doc}
        if missing:
            collection("settings").update_one({"workspaceId": settings_doc["workspaceId"]}, {"$set": missing})

    for session in collection("sessions").find({}):
        missing = {key: "" for key in ["userAgent", "ipAddress"] if key not in session}
        if missing:
            collection("sessions").update_one({"accessTokenHash": session["accessTokenHash"]}, {"$set": missing})

    for reset_token in collection("password_reset_tokens").find({}):
        if "requestedIp" not in reset_token:
            collection("password_reset_tokens").update_one({"id": reset_token["id"]}, {"$set": {"requestedIp": ""}})

    for admin in collection("platform_admins").find({}):
        default_permissions = ["platform.owner"] if admin.get("role") == "Platform Owner" else ["platform.manage"]
        defaults = {
            "phone": "",
            "permissions": default_permissions,
            "lastLoginAt": admin.get("lastActive", ""),
            "updatedAt": admin.get("createdAt", now),
        }
        missing = {key: value for key, value in defaults.items() if key not in admin}
        if missing:
            collection("platform_admins").update_one({"id": admin["id"]}, {"$set": missing})

    for session in collection("platform_sessions").find({}):
        missing = {key: "" for key in ["userAgent", "ipAddress"] if key not in session}
        if missing:
            collection("platform_sessions").update_one({"accessTokenHash": session["accessTokenHash"]}, {"$set": missing})

    for record in collection("records").find({}):
        payload = normalize_record_payload(str(record.get("kind", "")), dict(record.get("payload", {})))
        if payload != record.get("payload", {}):
            collection("records").update_one(
                {"workspaceId": record.get("workspaceId"), "kind": record.get("kind"), "id": record.get("id")},
                {"$set": {"payload": payload, "updatedAt": now, "deletedAt": payload.get("deletedAt")}},
            )


def schema_audit() -> dict[str, Any]:
    db_collections = set(collection("_dummy").database.list_collection_names())
    entity_results = []
    missing_total = 0
    missing_collections: set[str] = set()
    for name, schema in ENTITY_SCHEMAS.items():
        collection_name = schema["collection"]
        if collection_name == "records" and name != "recordEnvelope":
            continue
        if collection_name not in db_collections:
            missing_collections.add(collection_name)
        docs = list(collection(collection_name).find({}).limit(50))
        missing_docs = [
            {"id": str(doc.get("id") or doc.get("accessTokenHash") or doc.get("_id")), "missing": [field for field in schema["required"] if field not in doc]}
            for doc in docs
        ]
        missing_docs = [item for item in missing_docs if item["missing"]]
        missing_total += sum(len(item["missing"]) for item in missing_docs)
        entity_results.append(
            {
                "entity": name,
                "collection": collection_name,
                "collectionExists": collection_name in db_collections,
                "documentsChecked": len(docs),
                "requiredFields": schema["required"],
                "optionalFields": schema["optional"],
                "missingInDocuments": missing_docs,
            }
        )
    record_results = []
    for kind, schema_name in RECORD_SCHEMA_BY_KIND.items():
        schema = ENTITY_SCHEMAS[schema_name]
        if "records" not in db_collections:
            missing_collections.add("records")
        docs = list(collection("records").find({"kind": kind}).limit(50))
        missing_docs = []
        nested_missing_docs = []
        for doc in docs:
            payload = doc.get("payload", {})
            missing = [field for field in schema["required"] if field not in payload]
            if missing:
                missing_docs.append({"id": str(doc.get("id")), "missing": missing})
            if schema_name == "sale":
                line_schema = ENTITY_SCHEMAS["saleLineItem"]
                for index, item in enumerate(payload.get("items", [])):
                    line_missing = [field for field in line_schema["required"] if field not in item]
                    if line_missing:
                        nested_missing_docs.append({"id": str(doc.get("id")), "itemIndex": index, "missing": line_missing})
        missing_total += sum(len(item["missing"]) for item in missing_docs)
        missing_total += sum(len(item["missing"]) for item in nested_missing_docs)
        record_results.append(
            {
                "entity": schema_name,
                "recordKind": kind,
                "documentsChecked": len(docs),
                "requiredFields": schema["required"],
                "optionalFields": schema["optional"],
                "missingInDocuments": missing_docs,
                "nestedMissingInDocuments": nested_missing_docs,
            }
        )
    return {
        "ok": missing_total == 0 and not missing_collections,
        "database": "mongodb",
        "databaseName": settings.MONGO_DB_NAME,
        "missingFieldCount": missing_total,
        "missingCollectionCount": len(missing_collections),
        "missingCollections": sorted(missing_collections),
        "collections": sorted(db_collections),
        "entities": entity_results,
        "recordEntities": record_results,
    }
