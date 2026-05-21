# RhinoPeak Karobar-Parity Feature Roadmap

Date: 2026-05-20

## Source Scope

Feature references were taken from Karobar's public website:

- https://www.karobarapp.com/en-us
- https://www.karobarapp.com/en-us/accounting-and-inventory-app
- https://www.karobarapp.com/en-us/faqs

This plan targets functional similarity for RhinoPeak. It should not copy Karobar branding, private implementation, UI assets, or proprietary flows.

## Public Feature Map

Karobar's public pages position the product around these capability groups:

- Transactions: sales, purchases, expenses, bookkeeping, invoices, billing.
- Parties: customer and supplier ledgers, receivables, payables, reminders.
- Inventory: product stock, real-time updates, low-stock alerts, valuation, pricing.
- Reports: business insights, financial reporting, profit and loss, balance sheet style reporting.
- Staff: multi-staff access, roles, permissions.
- Multi-business: switch between separate businesses.
- Offline and sync: offline entry with later online sync, mobile and web sync.
- Documents: upload bill images and receipts.
- Notifications: payment reminders through WhatsApp and SMS.
- Bank accounts: bank/cash account tracking.
- Subscription: free/paid plan lifecycle.
- Support and learning: FAQ, tutorials, contact/support.
- Mobile-first experience: mobile app plus desktop web version.

## Current RhinoPeak Baseline

Already present in the app:

- SaaS tenant workspaces, auth, roles, permissions, dashboard, sales, customers, inventory, analytics, reports, billing, settings.
- Separate SaaS owner portal at `/super-admin`.
- MongoDB-backed Django API with tenant-scoped records.
- Supplier CRUD, credit customer ledger, accounting summary, sales bill print/download.
- Nepali/English language support in many app surfaces.
- Mobile responsive shell with bottom navigation.

Gaps to close for Karobar-level parity:

- Purchases and supplier payment workflow are not complete.
- Expense tracking is not a first-class module.
- Accounting is summary-based, not full ledger/double-entry yet.
- Bank/cash account module is missing.
- Bill image upload and receipt attachment workflow is missing.
- Reminder delivery through SMS/WhatsApp is missing.
- Offline sync is local optimistic state, not a proper device sync engine.
- Reports need full accounting statements and export formats.
- Mobile UX needs simplified transaction flows for low-literacy users.

## Target Information Architecture

Workspace portal menu:

- Home
- Quick Add
- Sales
- Purchases
- Expenses
- Parties
- Inventory
- Cash & Bank
- Accounting
- Reports
- Reminders
- Documents
- Staff & Roles
- Billing
- Settings

Mobile bottom nav:

- Home
- Add
- Parties
- Inventory
- More

The `Add` tab should open a simple action sheet: Sale, Purchase, Expense, Credit payment, Supplier payment, Stock movement, Upload bill.

## Phase 1: Product Specification And Data Model

Tasks:

1. Create a parity checklist from the public Karobar feature groups.
2. Decide RhinoPeak naming for Nepal SME users: Parties, Udhar/Credit, Bills, Stock, Cash, Reports.
3. Define feature flags and plan gates: Free, Pro, Enterprise.
4. Extend the domain model with these entities:
   - Party: customer, supplier, or both.
   - PartyLedgerEntry: sale credit, purchase credit, receipt, payment, adjustment.
   - Purchase: supplier bill, items, taxes, discount, due date, status.
   - Expense: category, vendor, amount, tax, payment account, receipt image.
   - CashBankAccount: cash drawer, bank account, wallet, opening balance.
   - MoneyMovement: receipt, payment, transfer, bank deposit, withdrawal.
   - Account: chart of accounts.
   - JournalEntry and JournalLine: debit/credit ledger foundation.
   - InvoiceTemplate: print/download configuration.
   - DocumentAttachment: bill image, receipt, file metadata.
   - ReminderTemplate and ReminderLog.
   - DeviceSyncState and SyncOperation.
5. Update Mongo schema validation and indexes for each entity.
6. Update API bootstrap payloads and mobile bootstrap payloads.

Acceptance criteria:

- Each business record is tenant-scoped.
- Every money record has currency, date, createdBy, updatedAt, audit metadata.
- Every stock-changing record creates a stock movement.
- Every credit-changing record creates a party ledger entry.

## Phase 2: Backend API And Services

Tasks:

1. Add Django service modules by domain:
   - `party_service.py`
   - `purchase_service.py`
   - `expense_service.py`
   - `accounting_service.py`
   - `cash_bank_service.py`
   - `document_service.py`
   - `reminder_service.py`
   - `sync_service.py`
2. Add REST-style endpoints:
   - `/parties`
   - `/party-ledger`
   - `/purchases`
   - `/expenses`
   - `/cash-bank-accounts`
   - `/money-movements`
   - `/accounts`
   - `/journal-entries`
   - `/documents`
   - `/reminders`
   - `/sync/pull`
   - `/sync/push`
3. Add validation for required fields, amount signs, inventory availability, duplicate invoice numbers, and tenant ownership.
4. Add audit logs for create, update, delete, print, export, payment clear, and stock adjustment.
5. Add idempotency keys for mobile/offline writes.
6. Add role permission checks for every new endpoint.
7. Add pagination, search, date filters, and summary endpoints for large datasets.

Acceptance criteria:

- API returns stable JSON shapes for web and future mobile apps.
- Repeated offline sync requests do not duplicate records.
- Tenant A cannot read or mutate Tenant B records.

## Phase 3: Parties, Credit, Receivable And Payable

Tasks:

1. Merge customer and supplier experience into a `Parties` module while keeping customer/supplier quick filters.
2. Add party profile fields:
   - Name, phone, address, PAN/VAT, type, opening balance, credit limit, due days, notes.
3. Add party ledger timeline:
   - Sale, purchase, payment received, payment paid, return, adjustment.
4. Add customer credit summary:
   - Total receivable, overdue, due today, recently cleared.
5. Add supplier payable summary:
   - Total payable, overdue, due today, recently paid.
6. Add clear credit/payment flow with simple labels and confirmation receipt.
7. Add party statement print/download.
8. Add WhatsApp/SMS reminder placeholders with provider-ready abstraction.

Acceptance criteria:

- Users can open one party and understand "they owe us" or "we owe them" without accounting knowledge.
- Party balance updates automatically from sales, purchases, receipts, and payments.

## Phase 4: Purchases And Supplier Workflow

Tasks:

1. Add Purchases page.
2. Add purchase bill form:
   - Supplier, bill number, date, due date, items, quantities, unit, unit cost, discount, VAT, payment method.
3. Auto-increase inventory stock on completed purchases.
4. Support cash purchase and credit purchase.
5. Add supplier payment modal.
6. Add purchase return and damaged stock adjustment.
7. Add purchase bill print/download.
8. Add supplier bill image attachment.

Acceptance criteria:

- Purchase entry updates stock, supplier payable, and accounting summaries.
- Supplier credit can be partially or fully paid.

## Phase 5: Expenses

Tasks:

1. Add Expenses page.
2. Add expense categories CRUD:
   - Rent, salary, transport, utilities, marketing, repair, miscellaneous.
3. Add expense form:
   - Category, amount, tax, paid from, vendor, date, note, attachment.
4. Add recurring expense templates.
5. Add expense report by category and date.
6. Add receipt image upload.

Acceptance criteria:

- Users can record daily expenses in under 20 seconds on mobile.
- Expenses appear in profit/loss and cash/bank summaries.

## Phase 6: Inventory Parity

Tasks:

1. Add advanced product fields:
   - Barcode/SKU, brand, category, unit, secondary unit, conversion rate, expiry date, batch, warranty, opening stock.
2. Add unit support for pieces, kg, gram, liter, ml, meter, packet, box, crate.
3. Add stock movements:
   - Purchase, sale, return, adjustment, damage, transfer.
4. Add low-stock and overstock alerts.
5. Add valuation options:
   - FIFO, weighted average. LIFO can be prepared but should be optional because accounting acceptance depends on policy.
6. Add price lists:
   - Retail, wholesale, custom party price.
7. Add barcode scan-ready product lookup for mobile.
8. Add import/export for products.

Acceptance criteria:

- Stock is always traceable from movement history.
- Milk or other liter-based items can be sold and purchased naturally.

## Phase 7: Invoicing And Billing

Tasks:

1. Add invoice template settings:
   - Logo, business name, address, phone, PAN/VAT, footer, terms.
2. Add invoice numbering rules:
   - Prefix, fiscal year, sequence, reset policy.
3. Add bill types:
   - Normal bill, tax invoice, abbreviated tax invoice, receipt, purchase bill, party statement.
4. Add print layout optimized for A4 and thermal receipt.
5. Add browser PDF download and server-side PDF generation option.
6. Add invoice share action:
   - Download, print, WhatsApp link, email-ready payload.
7. Add credit note and debit note foundation.

Acceptance criteria:

- Printed bill is readable on desktop and mobile.
- PDF works without layout clipping.
- Invoice data includes seller PAN/VAT and buyer PAN when provided.

## Phase 8: Accounting And Nepal SME Reporting

Tasks:

1. Add chart of accounts seed for Nepal SME use:
   - Cash, bank, accounts receivable, inventory, accounts payable, sales, purchase, expenses, VAT payable, capital.
2. Generate journal entries from:
   - Sales, purchases, expenses, customer receipt, supplier payment, inventory adjustment.
3. Add reports:
   - Profit and loss.
   - Balance sheet.
   - Cash flow.
   - Trial balance.
   - Sales book.
   - Purchase book.
   - VAT summary.
   - Party receivable/payable aging.
   - Inventory valuation.
4. Add Nepali fiscal year and date filter support.
5. Add CSV, HTML, print, and PDF exports.
6. Add accountant review status for locked periods.

Acceptance criteria:

- Accounting reports are generated from ledger entries, not one-off UI calculations.
- Locked periods cannot be edited without admin permission and audit trail.

## Phase 9: Cash, Bank And Wallet Accounts

Tasks:

1. Add Cash & Bank page.
2. Add cash drawer and bank account CRUD.
3. Record money in/out:
   - Customer receipt, supplier payment, expense payment, owner deposit, owner withdrawal, bank transfer.
4. Add account ledger.
5. Add daily cash closing summary.
6. Add reconciliation status.

Acceptance criteria:

- User can see how much cash is in shop and how much is in bank/wallet.
- Money movement connects to invoices, expenses, and party ledger.

## Phase 10: Documents And Bill Image Upload

Tasks:

1. Add Documents page.
2. Support upload for bill images, receipts, supplier bills, expense receipts.
3. Store metadata:
   - Linked record type, linked record id, uploadedBy, file name, mime type, size, createdAt.
4. Add image preview and download.
5. Add mobile camera capture-ready input.
6. Add storage adapter:
   - Local dev storage first, S3/R2 compatible later.

Acceptance criteria:

- Any sale, purchase, or expense can have files attached.
- File access is tenant-scoped.

## Phase 11: Reminders And Notifications

Tasks:

1. Add reminder rules:
   - Before due date, on due date, after due date.
2. Add templates in English and Nepali.
3. Add WhatsApp deep-link share first.
4. Add SMS provider abstraction.
5. Add reminder log per party.
6. Add notification center.

Acceptance criteria:

- User can send a payment reminder from a credit customer screen.
- Reminder history is visible and auditable.

## Phase 12: Staff, Roles And Multi-Business

Tasks:

1. Harden invite acceptance flow.
2. Add staff activity log.
3. Add common role presets:
   - Owner, manager, cashier, inventory staff, accountant, read-only.
4. Add feature-level permission presets.
5. Add multiple business switcher for Pro/Enterprise.
6. Add cross-business comparison reports.

Acceptance criteria:

- Owner can safely give cashier access without exposing accounting settings.
- User can switch businesses without leaking data between tenants.

## Phase 13: Offline And Mobile Sync

Tasks:

1. Add local operation queue with idempotency keys.
2. Add sync status UI:
   - Synced, pending, failed, conflict.
3. Add conflict resolver for edited records.
4. Add background retry behavior.
5. Add `/sync/pull` and `/sync/push` backend APIs.
6. Add mobile bootstrap payload versioning.
7. Prepare React Native/Expo API compatibility.

Acceptance criteria:

- User can record a sale while offline and it syncs once online.
- Duplicate sales are prevented during retry.

## Phase 14: Reports, Search And Insights

Tasks:

1. Add global search across sales, parties, products, bills.
2. Add report builder filters:
   - Date, party, category, product, staff, payment method.
3. Add saved reports.
4. Add dashboard cards:
   - Cash today, credit due, supplier payable, low stock, profit estimate, top products.
5. Add export queue for large reports.
6. Add mobile card summaries for report tables.

Acceptance criteria:

- Reports remain usable with thousands of records.
- Mobile reports avoid wide tables.

## Phase 15: SaaS Owner Portal Updates

Tasks:

1. Add feature usage analytics by tenant.
2. Add tenant storage usage for document uploads.
3. Add failed sync and offline activity diagnostics.
4. Add subscription feature-gate configuration.
5. Add support impersonation request flow with audit approval.
6. Add tenant health score:
   - API sync, database records, overdue subscription, failed payments, support tickets.

Acceptance criteria:

- Platform owner can manage tenants without entering tenant data silently.
- Every administrative action is audited.

## Phase 16: Localization And Beginner-Friendly UX

Tasks:

1. Complete English and Nepali translation keys for every new module.
2. Add simple labels:
   - "Customer gave money", "Customer took credit", "We paid supplier", "Stock came in".
3. Add helper text only where the user may be confused.
4. Add icons and large touch targets in mobile quick-add flows.
5. Add empty states with direct action buttons.
6. Add optional Nepali date display.

Acceptance criteria:

- A non-accounting user can record sale, purchase, expense, and credit payment without knowing accounting terms.
- Switching language changes the full visible app surface.

## Phase 17: Testing, Security And Performance

Tasks:

1. Backend tests:
   - Multi-tenant isolation.
   - Sales ledger generation.
   - Purchase stock update.
   - Credit clear behavior.
   - Role permission enforcement.
2. Frontend tests:
   - Quick add sale.
   - Purchase entry.
   - Credit clear.
   - Invoice print/download.
   - Mobile navigation.
3. Add rate limiting and request size limits.
4. Add structured backend logs.
5. Add Mongo indexes for tenant/date/status/search fields.
6. Add seed script for demo business.
7. Run load tests with realistic transaction volume.

Acceptance criteria:

- Critical money and stock flows have automated coverage.
- Large tenants do not degrade common dashboard pages.

## Recommended Build Order

1. Parties unification and ledger foundation.
2. Purchases and supplier payable.
3. Expenses.
4. Cash and bank accounts.
5. Full accounting journal generation.
6. Invoice templates and PDF hardening.
7. Documents and upload.
8. Reminder system.
9. Offline sync engine.
10. Report expansion.
11. Staff/multi-business hardening.
12. SaaS owner portal analytics.
13. Mobile UX polish and full Nepali coverage.
14. Tests, indexes, load testing, production hardening.

## Initial Implementation Milestones

### Milestone 1: Daily Business Core

- Parties module.
- Purchases module.
- Expenses module.
- Customer and supplier ledger.
- Basic P&L report.

### Milestone 2: Billing And Inventory Completeness

- Invoice templates.
- Thermal/A4 print.
- Purchase bill print.
- Product units and valuation settings.
- Stock movement audit.

### Milestone 3: Money Control

- Cash and bank accounts.
- Receipts and payments.
- Daily cash closing.
- Payable/receivable aging.

### Milestone 4: Mobile And Reminder Experience

- Quick Add mobile flow.
- WhatsApp reminders.
- Bill image upload.
- Offline operation queue.

### Milestone 5: Production Readiness

- Full accounting reports.
- Role hardening.
- Automated tests.
- Mongo indexing and load test.
- SaaS owner feature analytics.
