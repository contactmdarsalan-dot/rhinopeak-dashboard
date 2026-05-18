from __future__ import annotations

ALL_PERMISSIONS: list[str] = [
    "dashboard.view",
    "sales.view",
    "sales.create",
    "sales.update",
    "sales.delete",
    "customers.view",
    "customers.manage",
    "inventory.view",
    "inventory.manage",
    "analytics.view",
    "reports.view",
    "reports.generate",
    "team.view",
    "users.invite",
    "users.manage",
    "roles.manage",
    "billing.manage",
    "settings.manage",
    "account.delete",
]

SYSTEM_ROLES = [
    {
        "slug": "owner",
        "name": "Owner",
        "description": "Full tenant owner access, including billing, roles, settings, and account deletion.",
        "permissions": ALL_PERMISSIONS,
    },
    {
        "slug": "manager",
        "name": "Manager",
        "description": "Operational manager access across sales, CRM, inventory, analytics, reports, and team visibility.",
        "permissions": [
            "dashboard.view",
            "sales.view",
            "sales.create",
            "sales.update",
            "customers.view",
            "customers.manage",
            "inventory.view",
            "inventory.manage",
            "analytics.view",
            "reports.view",
            "reports.generate",
            "team.view",
            "users.invite",
            "settings.manage",
        ],
    },
    {
        "slug": "staff",
        "name": "Staff",
        "description": "Frontline user with limited sales entry and stock movement permissions.",
        "permissions": ["dashboard.view", "sales.view", "sales.create", "customers.view", "inventory.view", "inventory.manage"],
    },
    {
        "slug": "viewer",
        "name": "Viewer",
        "description": "Read-only access for dashboard, analytics, reports, and operational history.",
        "permissions": ["dashboard.view", "sales.view", "customers.view", "inventory.view", "analytics.view", "reports.view"],
    },
]

EMPTY_SETTINGS = {
    "businessName": "",
    "currency": "NPR",
    "language": "en",
    "timezone": "Asia/Kathmandu",
    "fiscalYearStart": "July",
    "dateFormat": "YYYY-MM-DD",
    "numberFormat": "en-NP",
    "taxRate": 13,
    "invoicePrefix": "RP",
    "receiptFooter": "Thank you for your business.",
    "defaultPaymentMethod": "Cash",
    "compactTables": False,
    "lowStockAlerts": True,
    "dailySalesSummary": False,
    "newCustomerSignup": False,
    "twoFactorEnabled": False,
    "scheduledReports": False,
}

PLAN_PRICES = {
    "free": 0,
    "pro_monthly": 1499,
    "pro_annual": 14990,
}

RECORD_KINDS = {
    "sales",
    "customers",
    "inventory",
    "inventory_movements",
    "reports",
    "audit_logs",
    "billing_history",
    "feature_flags",
    "support_tickets",
}
