# RhinoPeak Flutter Mobile App Requirements And Implementation Plan

Date: May 20, 2026  
Product: RhinoPeak Business Mobile App  
Backend dependency: Django API + MongoDB at `/api`  
Primary users: Tenant owners, managers, sales staff, inventory staff, accountants  
Languages: English and Nepali  
Platforms: Android first, iOS-ready architecture  

## Goal

Create a production-quality Flutter mobile app for RhinoPeak Business Dashboard that uses the existing backend API, supports tenant-scoped data, works well for non-technical shop users, and provides fast daily workflows for sales, stock, customers, credit, expenses, and reports.

## Requirements Gathered From Existing Product

### Backend API Requirements

The app must use the existing backend endpoints:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/password/request`
- `POST /api/auth/password/reset`
- `GET /api/bootstrap`
- `GET /api/mobile/bootstrap`
- `POST/PATCH/DELETE /api/sales`
- `POST/PATCH /api/customers`
- `POST/PATCH/DELETE /api/parties`
- `POST /api/party-ledger`
- `POST/PATCH/DELETE /api/purchases`
- `POST/PATCH/DELETE /api/expenses`
- `POST/PATCH/DELETE /api/expenses/categories`
- `POST/PATCH/DELETE /api/cash-bank-accounts`
- `POST /api/money-movements`
- `POST/PATCH/DELETE /api/suppliers`
- `POST /api/credit-ledger`
- `POST/PATCH/DELETE /api/inventory/categories`
- `POST /api/inventory`
- `POST /api/inventory/movements`
- `POST /api/documents`
- `POST /api/reminder-templates`
- `POST /api/reminders`
- `POST /api/sync/push`
- `GET /api/sync/pull`
- `POST /api/reports`
- `PATCH /api/settings`
- `PATCH /api/billing/plan`

### App Feature Requirements

| Module | Required mobile features |
| --- | --- |
| Auth | Login, register, password reset, refresh token, logout |
| Workspace | Tenant bootstrap, plan state, business profile, language setting |
| Dashboard | Today revenue, monthly revenue, customers, orders, low stock, credit summary |
| Quick Add | Central mobile action for sale, expense, stock, customer, payment |
| Sales | Add sale, VAT/tax, discount, credit/cash payment, print/share bill, sale history |
| Customers | Add customer, credit balance, history, payment received |
| Parties | Customer/supplier ledger, receivable/payable entries |
| Inventory | Products, custom categories, units like pcs/kg/liter, supplier, stock movement |
| Suppliers | Supplier list, CRUD, payable summary |
| Purchases | Purchase bill entry, credit/cash, stock update |
| Expenses | Expense entry, custom categories, VAT input, payment account |
| Cash/Bank | Cash account, bank account, receipts, payments, balance |
| Accounting | Nepal VAT view, journal list, receivable/payable, profit/cash summary |
| Documents | Capture/upload receipt or bill image |
| Reminders | Credit reminders, Nepali/English message templates |
| Reports | Summary reports, HTML/PDF/print/share options where supported |
| Settings | Language, business name, PAN/VAT, currency, timezone, invoice defaults |
| Offline Sync | Cache bootstrap data, queue writes, sync when online |
| RBAC | Hide/disable features based on permissions from backend role definitions |

### UX Requirements

- Mobile-first workflow with bottom navigation.
- Center Quick Add action as the largest primary action.
- Use cards instead of tables on mobile.
- Use simple labels and helper text for non-technical users.
- Support English and Nepali for all visible app strings.
- Use large touch targets, clear icons, clear pressed/loading/error states.
- Keep forms short with progressive disclosure.
- Use native date pickers, numeric keyboards, phone/email keyboards, and camera picker.
- Keep all major daily tasks reachable within 1-2 taps.
- Support dark and light theme through design tokens.

### Technical Requirements

- Flutter stable.
- Clean architecture with presentation, application, domain, data, core layers.
- API client with token refresh and retry.
- Secure token storage.
- Local offline cache and write queue.
- Typed models generated or manually maintained from API contracts.
- Riverpod or Bloc for state management; recommended: Riverpod for this app.
- GoRouter for navigation and deep linking.
- Dio for HTTP.
- Hive/Isar/Drift for local cache; recommended: Drift for relational offline queries or Isar for document-style speed.
- Freezed/json_serializable for immutable models.
- intl for dates, currency, and localization.
- fl_chart or syncfusion_flutter_charts for analytics.
- printing/pdf for receipts/reports.
- image_picker/file_picker for receipt capture.

## Recommended Architecture

```text
mobile/
  lib/
    main.dart
    app/
      app.dart
      router.dart
      theme/
      localization/
    core/
      config/
      constants/
      errors/
      network/
      storage/
      sync/
      utils/
      widgets/
    features/
      auth/
        data/
        domain/
        presentation/
      dashboard/
      quick_add/
      sales/
      customers/
      parties/
      inventory/
      suppliers/
      purchases/
      expenses/
      cash_bank/
      accounting/
      documents/
      reminders/
      reports/
      settings/
      billing/
    shared/
      models/
      repositories/
      widgets/
  test/
  integration_test/
```

Each feature should follow:

```text
feature/
  data/
    dto/
    remote/
    local/
    repository_impl.dart
  domain/
    entities/
    repositories/
    usecases/
  presentation/
    controllers/
    screens/
    widgets/
```

## Navigation Plan

### Bottom Navigation

Use 5 items maximum:

1. Home
2. Sales
3. Quick Add - center, large circular primary action
4. Stock
5. More

### More Menu

More contains:

- Customers
- Parties
- Purchases
- Expenses
- Cash/Bank
- Accounting
- Documents
- Reminders
- Reports
- Billing
- Settings
- Logout

## Implementation Steps

### Phase 1 - Discovery And Setup

1. Confirm app name, package ID, launcher icon, splash screen, and brand colors.
2. Confirm Android-only first or Android+iOS.
3. Confirm production API base URL and local dev API URL.
4. Confirm whether offline-first writes are required for all modules or only Quick Add.
5. Confirm PDF/print requirement for Bluetooth printers or system share only.
6. Create Flutter project under `mobile/`.
7. Add dependencies and lint rules.
8. Create base folder architecture.
9. Add environment config for dev/staging/prod.
10. Add app theme, typography, spacing, icons, and localization shell.

### Phase 2 - Core Infrastructure

1. Build API client with Dio.
2. Add auth interceptor.
3. Add token refresh flow.
4. Add secure token storage.
5. Add global error mapping.
6. Add offline/network status detector.
7. Add local database/cache.
8. Add sync queue for offline writes.
9. Add common loading, empty, error, and retry widgets.
10. Add permission guard helper for RBAC.

### Phase 3 - Auth And Bootstrap

1. Build login screen.
2. Build register screen.
3. Build forgot/reset password screens.
4. Build authenticated app shell.
5. Call `/mobile/bootstrap` after login.
6. Store bootstrap data locally.
7. Hydrate app state from cache on cold start.
8. Implement logout and session expiry handling.

### Phase 4 - Main Mobile Shell

1. Build Home dashboard.
2. Build bottom navigation.
3. Build large center Quick Add action.
4. Build More menu.
5. Add language switcher.
6. Add notification/alert indicator.
7. Add permission-aware menu visibility.

### Phase 5 - Daily Operations

1. Sales add/list/detail.
2. Bill preview and share/download.
3. Customer add/list/detail.
4. Credit ledger entry and payment received.
5. Inventory list/detail.
6. Product add with units including liter/kg/pcs.
7. Inventory category CRUD.
8. Supplier CRUD.
9. Stock movement.
10. Quick Add shortcuts for sale, expense, stock, customer, payment.

### Phase 6 - Finance And Accounting

1. Expense category CRUD.
2. Expense add/list/detail.
3. Purchase add/list/detail.
4. Cash/bank accounts CRUD.
5. Money movement entry.
6. Accounting summary.
7. Journal entry list.
8. VAT input/output summary.
9. Receivable/payable summary.

### Phase 7 - Documents, Reminders, Reports

1. Receipt/bill camera capture.
2. Attach document to sale/purchase/expense.
3. Reminder template list/create.
4. Reminder send log.
5. Report list/create.
6. Report share/download/print flow.

### Phase 8 - Settings And Billing

1. Business profile settings.
2. PAN/VAT and invoice defaults.
3. Language English/Nepali.
4. Timezone and fiscal year.
5. Plan and billing screen.
6. Upgrade flow placeholder or live gateway integration when ready.

### Phase 9 - Offline Sync

1. Cache all bootstrap module data.
2. Allow offline reads.
3. Queue supported writes.
4. Sync queued writes on network restore.
5. Show conflict/error state.
6. Add manual sync button.
7. Add sync audit screen in Settings.

### Phase 10 - QA And Release

1. Unit tests for repositories, use cases, controllers.
2. Widget tests for auth, dashboard, quick add, forms.
3. Integration tests for login, sale, inventory, expense, sync.
4. API contract tests against backend test server.
5. Android emulator QA for small/large screens.
6. iOS simulator QA if enabled.
7. Accessibility test with text scaling and screen reader labels.
8. Offline/online sync test.
9. Build Android APK/AAB.
10. Prepare release checklist and deployment docs.

## Open Questions To Confirm Before Coding

1. App package ID: should it be `com.rhinopeak.business`?
2. App display name: `RhinoPeak Business` or `RhinoPeak Dashboard`?
3. First release target: Android only or Android and iOS?
4. Offline writes: all modules or only quick sale/expense/stock?
5. Receipt printing: system print/share only, or Bluetooth thermal printer support?
6. Login users: tenant users only, or include platform owner mobile access too?
7. Payment integration in mobile: placeholder flow or live eSewa/Khalti sandbox?
8. Should the mobile app be inside this repo under `mobile/`?

