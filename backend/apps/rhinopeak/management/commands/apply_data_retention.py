from __future__ import annotations

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.rhinopeak.data.mongo import collection


def cutoff_iso(days: int) -> str:
    return (timezone.now() - timedelta(days=days)).isoformat()


class Command(BaseCommand):
    help = "Apply RhinoPeak data-retention cleanup rules."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--audit-days", type=int, default=365)
        parser.add_argument("--session-days", type=int, default=90)
        parser.add_argument("--reset-token-days", type=int, default=7)
        parser.add_argument("--failed-scan-days", type=int, default=30)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options) -> None:
        dry_run = bool(options["dry_run"])
        actions = [
            (
                "expired password reset tokens",
                collection("password_reset_tokens"),
                {"createdAt": {"$lt": cutoff_iso(options["reset_token_days"])}},
            ),
            (
                "old revoked sessions",
                collection("sessions"),
                {"revokedAt": {"$ne": None, "$lt": cutoff_iso(options["session_days"])}},
            ),
            (
                "old audit logs",
                collection("records"),
                {
                    "kind": "audit_logs",
                    "$or": [
                        {"createdAt": {"$lt": cutoff_iso(options["audit_days"])}},
                        {"payload.createdAt": {"$lt": cutoff_iso(options["audit_days"])}},
                    ],
                },
            ),
            (
                "old failed bill scan images",
                collection("records"),
                {
                    "kind": "bill_scans",
                    "payload.status": {"$in": ["Failed", "Rejected"]},
                    "payload.createdAt": {"$lt": cutoff_iso(options["failed_scan_days"])},
                    "payload.imageDataUrl": {"$exists": True, "$ne": ""},
                },
            ),
        ]

        for label, coll, query in actions:
            count = coll.count_documents(query)
            if not dry_run:
                if label == "old failed bill scan images":
                    coll.update_many(query, {"$set": {"payload.imageDataUrl": "", "payload.imagePurgedAt": timezone.now().isoformat()}})
                else:
                    coll.delete_many(query)
            verb = "Would process" if dry_run else "Processed"
            self.stdout.write(f"{verb} {count} {label}.")
