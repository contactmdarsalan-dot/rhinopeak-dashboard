# RhinoPeak Business Dashboard

Interactive implementation of the RhinoPeak Business Dashboard SRS. The app uses Next.js, Zustand, Recharts, a Django REST backend, and local MongoDB for a clean multi-tenant SaaS workflow for Nepalese SMEs.

## First Account

The database starts empty. Open the app, choose Register, and create the first workspace owner account. Login, reset, refresh, logout, and mobile bootstrap all go through the backend API.

## Implemented Feature Areas

- Auth screens: API-backed login, registration, password reset code flow, refresh tokens, and logout.
- Dashboard: KPI cards, revenue trend, top products, YTD revenue, AOV, plan usage, low-stock alerts.
- Sales: add sale, CSV import/export, search/filter, status update, soft delete, audit trail, payment tags, tax/discount tracking, duplicate warning on Pro.
- Customers: profile creation, segmentation, LTV, repeat badge, purchase history timeline, advanced search/filter, CSV export gate.
- Inventory: product catalog, stock movement entry, low-stock status, supplier data, FIFO-style valuation, movement history.
- Analytics: date/category/segment filters, comparison chart, product ranking, category breakdown, customer split, LTV histogram, Pro heatmap.
- Reports: branded report generation, template choice, scheduled reports, HTML download, and print/PDF flow.
- Billing: Free/Pro plan comparison, usage limits, Stripe/eSewa/Khalti upgrade flow, billing history export.
- Team & roles: multi-user SaaS RBAC, custom role creation, feature-level permissions, Pro invite flow, team management, activity log.
- Platform Portal: separate `/super-admin` portal for the SaaS platform owner and super admins, with tenant analytics, platform MRR/ARR, organization controls, admin creation, and account health.
- Settings: business profile, Nepali/English language preference, timezone, invoice defaults, tax defaults, multi-business gate, notification toggles, 2FA toggle, GDPR-style data export/delete.
- Backend API: auth, bootstrap, roles, permissions, users, sales, customers, inventory, reports, settings, and separate platform admin endpoints.
- Mobile-ready API: `/api/mobile/bootstrap` provides the authenticated workspace payload plus sync metadata for app clients.
- Database: MongoDB schema with tenant-scoped workspaces, users, roles, sessions, settings, sales, customers, inventory, reports, billing, audit records, and platform admin sessions. No startup tenant data is created.

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

Backend health check:

```bash
python backend/server.py --check
```

MongoDB defaults to `mongodb://localhost:27017` and database `rhinopeak_dashboard`. Override with `RHINOPEAK_MONGO_URI` and `RHINOPEAK_MONGO_DB_NAME`.

Schema audit:

```bash
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
