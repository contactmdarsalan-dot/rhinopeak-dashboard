# RhinoPeak Dashboard

RhinoPeak Dashboard is a secondary SaaS product for Nepalese SMEs. It combines a Next.js workspace portal, a separate SaaS owner portal, and a Django REST-style JSON API backed by MongoDB.

## Tech Stack

- Frontend: Next.js, TypeScript, Zustand, Recharts, Lucide icons
- Backend: Django JSON API organized by `domain`, `models`, `data`, `services`, and `controllers`
- Database: MongoDB with tenant-scoped collections and indexed lookup paths
- Local state: Zustand persistence for optimistic UI and offline fallback messages

## First Account

The tenant database starts empty. Open the app, choose Register, and create the first workspace owner account. Workspace login, registration, password reset, refresh, logout, and mobile bootstrap are wired through the backend API.

The platform owner portal is separate at `/super-admin`. The first platform owner is created from that page, then that owner can create Super Admin and Support Admin accounts.

## Current Implementation Status

This is an honest status list based on the current codebase, not a sales promise.

### Built

- Auth flow: registration, login, password reset code flow, refresh, logout, and server-side bearer access/refresh tokens. This is not JWT yet.
- Multi-tenant workspace structure: workspace-scoped users, roles, records, sessions, settings, audit logs, and platform records in MongoDB.
- Dashboard: KPI cards, revenue trend, top products, YTD revenue, average order value, usage limits, and low-stock alerts.
- Sales: add sale, CSV import/export, search/filter, status update, soft delete, audit trail, payment method tags, tax, discount, and Pro duplicate warning.
- Customers: profile creation/editing, segmentation, lifetime value, repeat customer badge, purchase timeline, search/filter, and CSV export gate.
- Inventory: product catalog, stock movement entry, low-stock status, supplier fields, movement history, and FIFO-style valuation display.
- Analytics: date/category/segment filters, comparison charts, product ranking, category breakdown, customer split, LTV histogram, and Pro heatmap gate.
- Reports: branded report records, template choices, scheduled status, CSV export, HTML download, and browser print flow.
- Billing UI: Free/Pro plan comparison, usage counters, simulated Stripe/eSewa/Khalti upgrade buttons, and billing history export.
- RBAC: custom role creation, feature-level permissions, Pro invite flow, team management, and permission-gated modules.
- SaaS owner portal: separate `/super-admin` portal with tenant list, MRR/ARR metrics, expired subscription category, organization CRUD, admin CRUD, support ticket CRUD, feature flag CRUD, session revoke, and database health display.
- Settings: business profile, Nepali/English language preference, timezone, invoice defaults, tax defaults, notification toggles, multi-business Pro gate, and 2FA setting toggle.
- Mobile bootstrap API: `/api/mobile/bootstrap` returns the authenticated workspace payload plus sync metadata.

### Partial Or Simulated

- Payments are not live integrations. Stripe, eSewa, and Khalti actions currently record plan changes and billing history inside the app/backend.
- Reports do not use a server-side PDF generator. The app supports HTML download and browser print/PDF.
- 2FA is a stored setting toggle, not a real OTP/authenticator enforcement flow.
- Team invites create invited users, but there is no email delivery service or invite acceptance page yet.
- The frontend keeps optimistic Zustand state and syncs to MongoDB. When the API is offline, some changes remain local and show backend-offline messages.
- The MongoDB schema and indexes exist, but the platform still needs pressure testing with real multi-tenant data volume.

### Production Gaps

- Add real JWT or keep opaque tokens intentionally and document token rotation, expiry, revocation, and mobile refresh behavior.
- Add live payment gateway integrations, webhook validation, invoice reconciliation, and failed-payment lifecycle handling.
- Add email/SMS delivery for password resets, team invites, billing notices, and support notifications.
- Add automated backend tests, frontend integration tests, and multi-tenant isolation tests.
- Add rate limiting, request logging, structured audit exports, production CORS, and managed secret configuration.
- Run load tests against MongoDB with realistic tenant, sales, inventory, and reporting data.

Readiness score: 5/10. The product is more complete than a static dashboard prototype, but it still needs real payment, notification, security, test, and stress-test work before production launch.

## Development

Start the backend API in one terminal:

```bash
npm run backend
```

Start the Next.js app in another terminal:

```bash
npm run dev
```

Open `http://localhost:3000` by default. The frontend reads `NEXT_PUBLIC_API_URL` and defaults to `http://localhost:8000/api`.

MongoDB defaults to `mongodb://localhost:27017` and database `rhinopeak_dashboard`. Override with `RHINOPEAK_MONGO_URI` and `RHINOPEAK_MONGO_DB_NAME`.

Useful backend checks:

```bash
python backend/server.py --check
curl http://localhost:8000/api/schema/audit
```

## Verification

```bash
npm run lint
npm run build
```

The build script uses Webpack for steadier Windows filesystem behavior. `next.config.ts` allows `NEXT_DIST_DIR` override and defaults to `.next-build`.

## Backend Notes

The backend is Django and organized into `domain`, `models`, `data`, `services`, and `controllers` layers under `backend/apps/rhinopeak`. Tenant owners are workspace admins, while platform owners and super admins use separate platform auth models and routes. MongoDB is used locally with indexed tenant collections and server-side sessions. For higher traffic deployment, run Django behind a production WSGI/ASGI server, keep Mongo indexes in place, and move secrets into environment variables.
