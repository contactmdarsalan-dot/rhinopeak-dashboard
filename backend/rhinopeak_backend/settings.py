from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
MONGO_URI = os.environ.get("RHINOPEAK_MONGO_URI", os.environ.get("MONGO_URI", "mongodb://localhost:27017"))
MONGO_DB_NAME = os.environ.get("RHINOPEAK_MONGO_DB_NAME", os.environ.get("RHINOPEAK_DB", "rhinopeak_dashboard"))
MONGO_SERVER_SELECTION_TIMEOUT_MS = int(os.environ.get("RHINOPEAK_MONGO_TIMEOUT_MS", "3000"))

# PRODUCTION-REQUIRED: set these env vars before deployment.
# DO NOT commit real values to source control.
SECRET_KEY = os.environ.get("RHINOPEAK_SECRET_KEY", "")
if not SECRET_KEY:
    raise RuntimeError("RHINOPEAK_SECRET_KEY environment variable is required.")
DEBUG = os.environ.get("RHINOPEAK_DEBUG", "0") == "1"
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("RHINOPEAK_ALLOWED_HOSTS", "").split(",")
    if host.strip()
]
# Hard-block startup if critical env vars are missing in non-debug mode
if not DEBUG:
    missing = []
    if SECRET_KEY == "rhinopeak-local-development-key" or len(SECRET_KEY) < 32:
        missing.append("RHINOPEAK_SECRET_KEY (must be ≥32 random chars)")
    if not ALLOWED_HOSTS:
        missing.append("RHINOPEAK_ALLOWED_HOSTS (comma-separated hostnames)")
    if not os.environ.get("RHINOPEAK_MONGO_URI"):
        missing.append("RHINOPEAK_MONGO_URI")
    if not os.environ.get("RHINOPEAK_CORS_ORIGINS"):
        missing.append("RHINOPEAK_CORS_ORIGINS")
    if missing:
        raise RuntimeError(f"Missing production environment variables: {', '.join(sorted(set(missing)))}")

INSTALLED_APPS = [
    "apps.rhinopeak.apps.RhinoPeakConfig",
]

MIDDLEWARE: list[str] = []
ROOT_URLCONF = "rhinopeak_backend.urls"
TEMPLATES: list[dict] = []
WSGI_APPLICATION = "rhinopeak_backend.wsgi.application"
ASGI_APPLICATION = "rhinopeak_backend.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django_mongodb_backend",
        "NAME": MONGO_DB_NAME,
        "CLIENT": {
            "host": MONGO_URI,
        },
    }
}

USE_TZ = True
TIME_ZONE = "UTC"
DEFAULT_AUTO_FIELD = "django_mongodb_backend.fields.ObjectIdAutoField"
APPEND_SLASH = False

SESSION_TTL_MINUTES = int(os.environ.get("RHINOPEAK_SESSION_TTL_MINUTES", "60"))
REFRESH_TTL_DAYS = int(os.environ.get("RHINOPEAK_REFRESH_TTL_DAYS", "30"))
PASSWORD_RESET_TTL_MINUTES = int(os.environ.get("RHINOPEAK_PASSWORD_RESET_TTL_MINUTES", "15"))
EXPOSE_RESET_TOKEN = os.environ.get("RHINOPEAK_EXPOSE_RESET_TOKEN", "1") != "0"
PLATFORM_SETUP_TOKEN = os.environ.get("RHINOPEAK_PLATFORM_SETUP_TOKEN", "")
# ── CORS (Django middleware level — also enforced per-request in api.py) ──
# Comma-separated list of allowed origins for browser requests.
# Do NOT use "*" in production — the app will block it.
RHINOPEAK_CORS_ORIGINS = {
    origin.strip()
    for origin in os.environ.get(
        "RHINOPEAK_CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://127.0.0.1:3002",
    ).split(",")
    if origin.strip()
}

# CORS enforcement: if not DEBUG and we receive a wildcard in env, reject it
# so nobody accidentally deploys with '*' CORS.
if not DEBUG:
    if "*" in RHINOPEAK_CORS_ORIGINS:
        raise RuntimeError(
            "RHINOPEAK_CORS_ORIGINS contains '*' which is not allowed in production. "
            "Provide a specific list of allowed origins."
        )
