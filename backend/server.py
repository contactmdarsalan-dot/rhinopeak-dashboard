from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "rhinopeak_backend.settings")


def prepare_database() -> None:
    import django

    django.setup()
    from apps.rhinopeak.data.mongo import ensure_indexes
    from apps.rhinopeak.services.mongo_service import backfill_schema_defaults

    ensure_indexes()
    backfill_schema_defaults()


def health_payload() -> dict[str, object]:
    from apps.rhinopeak.services.mongo_service import health_payload as mongo_health_payload

    return mongo_health_payload()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the RhinoPeak Django API server.")
    parser.add_argument("--host", default=os.environ.get("RHINOPEAK_HOST", "127.0.0.1"))
    parser.add_argument("--port", default=os.environ.get("RHINOPEAK_PORT", "8000"))
    parser.add_argument("--check", action="store_true", help="Initialize the database and print API health.")
    parser.add_argument("--init-only", action="store_true", help="Initialize the database without starting the server.")
    parser.add_argument("--reload", action="store_true", help="Enable Django's development autoreloader.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    prepare_database()

    if args.check:
        print(json.dumps(health_payload(), indent=2))
        return

    if args.init_only:
        print(json.dumps({"ok": True, "database": "mongodb"}, indent=2))
        return

    from django.core.management import execute_from_command_line

    command = [sys.argv[0], "runserver", f"{args.host}:{args.port}"]
    if not args.reload:
        command.append("--noreload")
    execute_from_command_line(command)


if __name__ == "__main__":
    main()
