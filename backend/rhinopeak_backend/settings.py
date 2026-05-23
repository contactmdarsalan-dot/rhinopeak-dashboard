from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
MONGO_URI = os.environ.get("RHINOPEAK_MONGO_URI", os.environ.get("MONGO_URI", "mongodb://localhost:27017"))
MONGO_DB_NAME = os.environ.get("RHINOPEAK_MONGO_DB_NAME", os.environ.get("RHINOPEAK_DB", "rhinopeak_dashboard"))
MONGO_SERVER_SELECTION_TIMEOUT_MS = int(os.environ.get("RHINOPEAK_MONGO_TIMEOUT_MS", "3000"))

SECRET_KEY = os.environ.get("RHINOPEAK_SECRET_KEY", "rhinopeak-local-development-key")
DEBUG = os.environ.get("RHINOPEAK_DEBUG", "1") != "0"
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("RHINOPEAK_ALLOWED_HOSTS", "*" if DEBUG else "").split(",")
    if host.strip()
]
if not DEBUG:
    missing = [
        name
        for name in ("RHINOPEAK_SECRET_KEY", "RHINOPEAK_MONGO_URI", "RHINOPEAK_CORS_ORIGINS")
        if not os.environ.get(name)
    ]
    if SECRET_KEY == "rhinopeak-local-development-key":
        missing.append("RHINOPEAK_SECRET_KEY")
    if not ALLOWED_HOSTS:
        missing.append("RHINOPEAK_ALLOWED_HOSTS")
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
CORS_ORIGINS = {
    origin.strip()
    for origin in os.environ.get(
        "RHINOPEAK_CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://127.0.0.1:3002",
    ).split(",")
    if origin.strip()
}
