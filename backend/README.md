# RhinoPeak Backend

This is the Django REST backend for RhinoPeak. It keeps the existing frontend API contract while organizing the backend into domain, services, controllers, data, and models layers.

## Architecture

- `rhinopeak_backend/` contains Django settings, ASGI/WSGI entrypoints, and URL routing.
- `apps/rhinopeak/domain/` contains permissions, constants, security helpers, and shared domain errors.
- `apps/rhinopeak/models/` contains Mongo schema contracts plus legacy Django model definitions kept out of the request path.
- `apps/rhinopeak/data/` contains Mongo connection, index, and database helper code.
- `apps/rhinopeak/services/` contains auth, workspace, role, record, billing, settings, and platform business logic.
- `apps/rhinopeak/controllers/` contains HTTP controllers that map routes to services.

## Run

```bash
npm run backend
```

The API starts at `http://localhost:8000/api`. It connects to local MongoDB by default:

```bash
RHINOPEAK_MONGO_URI=mongodb://localhost:27017
RHINOPEAK_MONGO_DB_NAME=rhinopeak_dashboard
```

`python backend/server.py --check` pings MongoDB, ensures indexes, backfills safe defaults for newly required fields, and prints collection counts.

## First Account

The database starts empty. Create the first owner account through `POST /api/auth/register` or the frontend Register screen.

## Platform Owner

Super admin access is separate from tenant workspaces. Open `/super-admin` in the frontend and create the one-time SaaS platform owner. After that, the platform owner can create Super Admin accounts from the platform portal.

Set `RHINOPEAK_PLATFORM_SETUP_TOKEN` in production to require a setup code for the first platform owner.

Local development owner created for this workspace:

- Portal: `http://localhost:3002/super-admin`
- Email: `owner@rhinopeak.local`
- Role: `Platform Owner`

## Useful Commands

```bash
python backend/server.py --check
python backend/server.py --init-only
python backend/server.py --reload
```

## Endpoints

- `GET /api/health`
- `GET /api/schema/audit`
- `GET /api/bootstrap`
- `GET /api/mobile/bootstrap`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/password/request`
- `POST /api/auth/password/reset`
- `POST /api/roles`
- `PATCH /api/roles/{id}`
- `DELETE /api/roles/{id}`
- `POST /api/users/invite`
- `PATCH /api/users/{id}/role`
- `POST /api/sales`
- `PATCH /api/sales/{id}`
- `DELETE /api/sales/{id}`
- `POST /api/customers`
- `PATCH /api/customers/{id}`
- `POST /api/inventory`
- `POST /api/inventory/movements`
- `POST /api/reports`
- `PATCH /api/settings`
- `PATCH /api/billing/plan`
- `GET /api/platform/auth/state`
- `POST /api/platform/auth/setup-owner`
- `POST /api/platform/auth/login`
- `POST /api/platform/auth/logout`
- `GET /api/platform/bootstrap`
- `POST /api/platform/admins`
- `PATCH /api/platform/admins/{id}`
- `DELETE /api/platform/admins/{id}`
- `POST /api/platform/organizations`
- `PATCH /api/platform/organizations/{id}`
- `DELETE /api/platform/organizations/{id}`
- `POST /api/platform/feature-flags`
- `PATCH /api/platform/feature-flags/{id}`
- `DELETE /api/platform/feature-flags/{id}`
- `POST /api/platform/support-tickets`
- `PATCH /api/platform/support-tickets/{id}`
- `DELETE /api/platform/support-tickets/{id}`
- `PATCH /api/platform/sessions/{id}`

## Production Note

MongoDB is the application database. The API keeps tenants separated by `workspaceId`, indexes high-use lookup paths, and stores tenant and platform sessions server-side. For production or high traffic, use a managed MongoDB cluster, restrict CORS, set `RHINOPEAK_SECRET_KEY` and `RHINOPEAK_PLATFORM_SETUP_TOKEN`, and run Django behind a production WSGI/ASGI server while keeping this service/controller structure stable for web and mobile clients.
