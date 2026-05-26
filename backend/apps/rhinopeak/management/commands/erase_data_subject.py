from __future__ import annotations

import hashlib

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.rhinopeak.data.mongo import collection


class Command(BaseCommand):
    help = "Anonymize a customer/user data subject inside one workspace."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--workspace-id", required=True)
        parser.add_argument("--email")
        parser.add_argument("--customer-id")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options) -> None:
        workspace_id = options["workspace_id"]
        email = (options.get("email") or "").strip().lower()
        customer_id = (options.get("customer_id") or "").strip()
        dry_run = bool(options["dry_run"])
        if not email and not customer_id:
            raise CommandError("Provide --email or --customer-id.")

        subject_key = email or customer_id
        digest = hashlib.sha256(f"{workspace_id}:{subject_key}".encode("utf-8")).hexdigest()[:12]
        now = timezone.now().isoformat()
        anonymous_name = f"Erased Subject {digest}"
        anonymous_email = f"erased-{digest}@privacy.rhinopeak.local"

        actions: list[tuple[str, object, dict, dict]] = []
        if email:
            actions.append(
                (
                    "users",
                    collection("users"),
                    {"workspaceId": workspace_id, "emailNormalized": email},
                    {
                        "$set": {
                            "name": anonymous_name,
                            "email": anonymous_email,
                            "emailNormalized": anonymous_email,
                            "phone": "",
                            "avatarUrl": "",
                            "status": "Erased",
                            "passwordSalt": "",
                            "passwordHash": "",
                            "erasedAt": now,
                            "updatedAt": now,
                        }
                    },
                )
            )
        if customer_id:
            actions.append(
                (
                    "customer record",
                    collection("records"),
                    {"workspaceId": workspace_id, "kind": "customers", "id": customer_id},
                    {
                        "$set": {
                            "payload.name": anonymous_name,
                            "payload.email": anonymous_email,
                            "payload.phone": "",
                            "payload.address": "",
                            "payload.notes": "",
                            "payload.status": "Erased",
                            "payload.erasedAt": now,
                            "payload.updatedAt": now,
                        }
                    },
                )
            )
            actions.append(
                (
                    "customer-linked sales",
                    collection("records"),
                    {"workspaceId": workspace_id, "kind": "sales", "payload.customerId": customer_id},
                    {"$set": {"payload.customer": anonymous_name, "payload.customerName": anonymous_name, "payload.erasedCustomerAt": now}},
                )
            )
            actions.append(
                (
                    "customer-linked ledgers",
                    collection("records"),
                    {"workspaceId": workspace_id, "kind": {"$in": ["credit_ledger", "party_ledger"]}, "payload.customerId": customer_id},
                    {"$set": {"payload.customerName": anonymous_name, "payload.partyName": anonymous_name, "payload.erasedCustomerAt": now}},
                )
            )

        for label, coll, query, update in actions:
            count = coll.count_documents(query)
            if not dry_run:
                coll.update_many(query, update)
            verb = "Would anonymize" if dry_run else "Anonymized"
            self.stdout.write(f"{verb} {count} {label}.")
