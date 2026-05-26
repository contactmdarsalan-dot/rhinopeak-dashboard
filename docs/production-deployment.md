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
RHINOPEAK_ENABLE_METRICS=1
RHINOPEAK_ENABLE_AUDIT_LOGGING=1
RHINOPEAK_REDIS_URL=redis://redis.example:6379/0
BREVO_SMTP_USER=your-brevo-login
BREVO_SMTP_PASS=your-brevo-smtp-key
RHINOPEAK_FROM_EMAIL=noreply@rhinopeak.example
ESEWA_MERCHANT_CODE=your-esewa-code
ESEWA_SECRET_KEY=your-esewa-secret
ESEWA_BASE_URL=https://epay.esewa.com.np
KHALTI_SECRET_KEY=your-khalti-secret
KHALTI_BASE_URL=https://a.khalti.com
RHINOPEAK_JWT_ALGORITHM=RS256
RHINOPEAK_RSA_PRIVATE_KEY_PATH=/run/secrets/rhinopeak-jwt-private.pem
RHINOPEAK_RSA_PUBLIC_KEY_PATH=/run/secrets/rhinopeak-jwt-public.pem
RHINOPEAK_EXPOSE_RESET_TOKEN=0
RHINOPEAK_ALLOW_DEMO_PAYMENTS=0
RHINOPEAK_SENTRY_DSN=https://example@sentry.io/project
```

Use a cloud secret manager or Vault for the values above in staging and production. Do not store live payment, SMTP, MongoDB, Redis, JWT, Android signing, APNs, or Sentry credentials in source control.

## Backend

From `backend/`:

```bash
python manage.py check
gunicorn -c gunicorn.conf.py
```

Use a process manager such as systemd, Supervisor, or PM2 to keep Gunicorn running.

Health and metrics endpoints:

```bash
curl https://app.rhinopeak.example/api/health/ready
curl https://app.rhinopeak.example/api/health/details
curl https://app.rhinopeak.example/api/metrics
```

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

## Containers

For local production rehearsal:

```bash
docker compose up --build
```

The compose stack includes MongoDB, Redis, backend, frontend, Nginx, Prometheus, Grafana, Alertmanager, and exporters. Grafana is available at `http://localhost:3001`.

## Kubernetes

The `k8s/` directory contains baseline manifests for backend/frontend deployments, services, HPA, ingress, network policy, config, and secret placeholders. Replace the example image names and secret values before applying:

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/ingress.yaml
```

Put the ingress behind your cloud WAF/DDoS layer and CDN. Enable TLS at the load balancer or ingress controller, and keep origin traffic restricted to trusted network paths.

## Backups

Use `scripts/disaster-recovery.sh` for MongoDB and Redis backups:

```bash
RHINOPEAK_MONGO_URI=mongodb+srv://... \
RHINOPEAK_REDIS_URL=redis://... \
RHINOPEAK_BACKUP_S3_BUCKET=rhinopeak-backups \
scripts/disaster-recovery.sh full
```

If `RHINOPEAK_BACKUP_S3_BUCKET` is omitted, backups are written locally under `./backups`.

Schedule `scripts/disaster-recovery.sh full` daily and perform a restore drill before launch. Keep at least 30 days of encrypted backups for MongoDB and Redis.

## Data Retention And Privacy

Run the retention job daily:

```bash
cd backend
python manage.py apply_data_retention --dry-run
python manage.py apply_data_retention
```

For verified erasure requests, use:

```bash
cd backend
python manage.py erase_data_subject --workspace-id <workspace> --user-id <user>
```

Always run with `--dry-run` first and keep the audit output with the support ticket.

## Mobile Release

The Flutter app now includes platform channels for camera/gallery capture, biometric unlock, local notifications, push-token registration, and deep links.

Android release builds read signing credentials from:

```bash
RHINOPEAK_ANDROID_KEYSTORE=/secure/path/release.jks
RHINOPEAK_ANDROID_STORE_PASSWORD=...
RHINOPEAK_ANDROID_KEY_ALIAS=...
RHINOPEAK_ANDROID_KEY_PASSWORD=...
```

iOS release builds require Apple signing setup, APNs capability, associated domains for `https://app.rhinopeak.com`, and these privacy descriptions in `Info.plist`: camera, photo library, notifications, and Face ID.

## AI Quality Gate

Run the holdout evaluator before release:

```bash
cd backend
python manage.py evaluate_gpt_model --min-document-success=0.60 --min-line-item-f1=0.70 --max-latency-ms=100
```

The CI pipeline runs the same gate so scanner changes cannot silently reduce extraction quality.

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

Also confirm:

- `/api/health/ready`, `/api/health/details`, and `/api/metrics` return healthy responses.
- Grafana receives Prometheus metrics and Alertmanager test alerts route to the configured receiver.
- Password reset responses do not include reset tokens unless `RHINOPEAK_EXPOSE_RESET_TOKEN=1` is set in a non-production test environment.
- Mobile camera capture uploads a real `imageDataUrl`, and mobile push-token registration creates a `device_tokens` record.
- eSewa/Khalti fail closed in production when live credentials are missing.
