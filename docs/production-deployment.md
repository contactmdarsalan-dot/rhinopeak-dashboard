# RhinoPeak Production Deployment

This guide covers a production-style deployment for the RhinoPeak dashboard with Next.js, Django, MongoDB Atlas, and Nginx.

## Required Environment

Set these variables on the server or in your process manager:

```bash
RHINOPEAK_SECRET_KEY=change-me
RHINOPEAK_DEBUG=0
RHINOPEAK_MONGO_URI=mongodb+srv://user:password@cluster.example.mongodb.net
RHINOPEAK_MONGO_DB_NAME=rhinopeak_dashboard
RHINOPEAK_CORS_ORIGINS=https://app.rhinopeak.example
RHINOPEAK_FRONTEND_URL=https://app.rhinopeak.example
RHINOPEAK_BACKEND_URL=https://app.rhinopeak.example
BREVO_SMTP_USER=your-brevo-login
BREVO_SMTP_PASS=your-brevo-smtp-key
RHINOPEAK_FROM_EMAIL=noreply@rhinopeak.example
ESEWA_MERCHANT_CODE=your-esewa-code
ESEWA_SECRET_KEY=your-esewa-secret
ESEWA_BASE_URL=https://epay.esewa.com.np
KHALTI_SECRET_KEY=your-khalti-secret
KHALTI_BASE_URL=https://a.khalti.com
```

## Backend

From `backend/`:

```bash
python manage.py check
gunicorn -c gunicorn.conf.py
```

Use a process manager such as systemd, Supervisor, or PM2 to keep Gunicorn running.

## Frontend

From the repository root:

```bash
npm ci
npm run build
npm run start
```

Set `NEXT_PUBLIC_API_URL=https://app.rhinopeak.example/api` for browser API calls.

## Nginx

Use `backend/nginx.conf` as a starting point. Replace `app.rhinopeak.example` with your real domain and terminate TLS with Certbot or your platform load balancer.

## MongoDB Atlas

1. Create an Atlas cluster in the nearest available region.
2. Add the application server IP to the Atlas network access list.
3. Create a least-privilege database user.
4. Put the Atlas connection string in `RHINOPEAK_MONGO_URI`.
5. Start the backend once so indexes are ensured.

## Smoke Checks

```bash
python manage.py check
curl https://app.rhinopeak.example/api/health
curl https://app.rhinopeak.example/dashboard
```

Confirm login, password reset email, team invite email, eSewa sandbox payment, and Khalti sandbox payment before switching to live gateway credentials.
