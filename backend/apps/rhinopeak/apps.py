from __future__ import annotations

from django.apps import AppConfig


class RhinoPeakConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.rhinopeak"
    label = "rhinopeak"
    verbose_name = "RhinoPeak"

    def ready(self) -> None:
        """
        Called once by Django after all apps are loaded.
        Ensures compound MongoDB indexes exist so bootstrap_payload
        and list_records queries use index scans instead of collection scans.
        """
        try:
            from apps.rhinopeak.services.mongo_service import ensure_indexes
            ensure_indexes()
        except Exception as exc:
            # Don't crash startup if MongoDB is not yet reachable
            import sys
            print(f"[RhinoPeak] Could not ensure indexes on startup: {exc}", file=sys.stderr)

