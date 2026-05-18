# RhinoPeak Business Dashboard - MongoDB Data Model

This document describes the current MongoDB collections used by the Django API. Tenant data is scoped by `workspaceId`; the SaaS platform portal uses separate platform admin collections.

```mermaid
erDiagram
    workspaces ||--o{ businesses : owns
    workspaces ||--o{ roles : defines
    workspaces ||--|| settings : configures
    workspaces ||--o{ users : contains
    workspaces ||--o{ records : stores
    roles ||--o{ users : assigned_to
    users ||--o{ sessions : creates
    users ||--o{ password_reset_tokens : requests
    platform_admins ||--o{ platform_sessions : creates

    workspaces {
        string id PK
        string name
        string category
        string address
        string country
        string timezone
        string locale
        string plan
        string billingCycle
        string status
        string subscriptionStatus
        string trialEndsAt
        string planStartedAt
        string ownerUserId FK
        string createdAt
        string updatedAt
    }

    businesses {
        string id PK
        string workspaceId FK
        string name
        string category
        string address
        string phone
        string email
        string taxId
        string currency
        boolean isPrimary
        string createdAt
        string updatedAt
    }

    roles {
        string id PK
        string workspaceId FK
        string name
        string slug
        string description
        boolean systemRole
        json permissions
        string createdBy
        string createdAt
        string updatedAt
    }

    users {
        string id PK
        string workspaceId FK
        string roleId FK
        string name
        string email
        string emailNormalized
        string role
        string status
        string lastActive
        string phone
        string avatarUrl
        string locale
        boolean isEmailVerified
        string invitedBy
        string lastLoginAt
        string passwordSalt
        string passwordHash
        string createdAt
        string updatedAt
    }

    settings {
        string workspaceId PK
        string businessName
        string currency
        string language
        string timezone
        string fiscalYearStart
        string dateFormat
        string numberFormat
        number taxRate
        string invoicePrefix
        string receiptFooter
        string defaultPaymentMethod
        boolean compactTables
        boolean lowStockAlerts
        boolean dailySalesSummary
        boolean newCustomerSignup
        boolean twoFactorEnabled
        boolean scheduledReports
    }

    records {
        string id PK
        string workspaceId FK
        string kind
        json payload
        string createdAt
        string updatedAt
        string deletedAt
    }

    sessions {
        string accessTokenHash PK
        string refreshTokenHash
        string userId FK
        string expiresAt
        string refreshExpiresAt
        string userAgent
        string ipAddress
        string createdAt
        string revokedAt
    }

    password_reset_tokens {
        string id PK
        string userId FK
        string tokenHash
        string requestedIp
        string expiresAt
        string createdAt
        string usedAt
    }

    platform_admins {
        string id PK
        string name
        string email
        string emailNormalized
        string role
        string status
        string lastActive
        string phone
        json permissions
        string lastLoginAt
        string passwordSalt
        string passwordHash
        string createdBy
        string createdAt
        string updatedAt
    }

    platform_sessions {
        string accessTokenHash PK
        string adminId FK
        string expiresAt
        string userAgent
        string ipAddress
        string createdAt
        string revokedAt
    }
```

Record payload kinds are `sales`, `customers`, `inventory`, `inventory_movements`, `reports`, `audit_logs`, `billing_history`, `feature_flags`, and `support_tickets`.

Important payload attributes now audited by `GET /api/schema/audit`:

- Sales: invoice number, business, customer, subtotal, discount, tax, amount, currency, payment, status, notes, audit trail, timestamps, and complete line item totals.
- Customers: company, source, tax ID, credit limit, balance, language preference, segment, purchase totals, and timestamps.
- Inventory: description, SKU, barcode, brand, category, unit, stock, reorder level, pricing, tax rate, supplier, location, status, active flag, and timestamps.
- Billing: plan, billing cycle, currency, invoice number, gateway, paid date, amount, and status.
- Platform: platform owners, super admins, support admins, platform sessions, tenant subscription status, health metrics, and organization controls.

Run `GET /api/schema/audit` to verify required collections and required payload fields in the active MongoDB database.
