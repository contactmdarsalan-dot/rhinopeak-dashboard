from __future__ import annotations

import json
import os
import time
from collections import defaultdict
from typing import Any
from urllib.parse import quote, unquote

from django.conf import settings
from django.http import HttpRequest, HttpResponse, HttpResponseRedirect, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.rhinopeak.domain.errors import AppError

# ---------------------------------------------------------------------------
# Simple in-memory rate limiter (resets on server restart, good enough for
# low-traffic protection against brute-force on auth endpoints).
# ---------------------------------------------------------------------------
_rate_limit_store: dict[str, list[float]] = defaultdict(list)
_redis_client = None


def _get_redis_client():
    """Lazily connect to Redis; falls back to in-memory store on failure."""
    global _redis_client
    if _redis_client is None:
        import os
        try:
            import redis
            redis_url = os.environ.get("RHINOPEAK_REDIS_URL", "redis://localhost:6379/0")
            _redis_client = redis.from_url(redis_url, socket_connect_timeout=2)
            _redis_client.ping()
        except Exception:
            _redis_client = None
    return _redis_client


def _check_rate_limit(key: str, max_attempts: int, window_seconds: int) -> None:
    """Raise AppError 429 if key exceeds max_attempts within window_seconds.

    Uses Redis (via RHINOPEAK_REDIS_URL) when available; falls back to the
    in-memory dict if Redis is unreachable so the app stays functional in dev.
    """
    import time as _time

    redis = _get_redis_client()
    now = _time.time()

    if redis:
        # Redis: atomic pipeline with window expiry
        pipe = redis.pipeline()
        pipe.zremrangebyscore(key, 0, now - window_seconds)
        pipe.zcard(key)
        pipe.zadd(key, {str(now): now})
        pipe.expire(key, window_seconds)
        counts, _ = pipe.execute()[1:3]
        if counts and int(counts[0]) >= max_attempts:
            raise AppError(429, "Too many attempts. Please try again later.")
        return

    # In-memory fallback for local dev without Redis
    window_start = now - window_seconds
    _rate_limit_store[key] = [t for t in _rate_limit_store[key] if t > window_start]
    if len(_rate_limit_store[key]) >= max_attempts:
        raise AppError(429, "Too many attempts. Please try again later.")
    _rate_limit_store[key].append(now)
from apps.rhinopeak.services.assistant_service import handle_assistant_command
from apps.rhinopeak.services.bill_scan_service import (
    approve_bill_scan,
    get_bill_scan,
    list_bill_scans,
    parse_bill_scan,
    upload_bill_scan,
)
from apps.rhinopeak.services.mongo_service import (
    accept_invite,
    authenticate_access_token,
    authenticate_platform_token,
    bootstrap_payload,
    complete_payment_session,
    create_customer,
    create_cash_bank_account,
    create_credit_entry,
    create_document,
    create_expense,
    create_expense_category,
    create_inventory_category,
    create_money_movement,
    create_movement,
    create_party,
    create_party_ledger_entry,
    create_platform_admin,
    create_platform_feature_flag,
    create_platform_organization,
    create_platform_support_ticket,
    create_payment_session,
    create_product,
    create_purchase,
    create_reminder_log,
    create_reminder_template,
    create_report,
    create_role,
    create_sale,
    create_supplier,
    delete_platform_admin,
    delete_platform_feature_flag,
    delete_platform_organization,
    delete_platform_support_ticket,
    delete_document,
    delete_cash_bank_account,
    delete_expense,
    delete_expense_category,
    delete_party,
    delete_purchase,
    delete_role,
    delete_inventory_category,
    delete_sale,
    delete_supplier,
    detail_payload,
    health_payload,
    invite_user,
    login_user,
    login_platform_admin,
    logout,
    logout_platform_admin,
    patch_platform_organization,
    patch_platform_admin,
    patch_platform_feature_flag,
    patch_platform_support_ticket,
    patch_sale,
    push_sync_operation,
    platform_bootstrap,
    platform_state,
    refresh_session,
    register_user,
    request_password_reset,
    reset_password,
    revoke_platform_session,
    schema_audit,
    setup_platform_owner,
    update_billing_plan,
    update_generic_record,
    update_customer,
    update_cash_bank_account,
    update_expense,
    update_expense_category,
    update_inventory_category,
    update_party,
    update_purchase,
    update_role,
    update_settings,
    update_supplier,
    update_user_role,
    delete_generic_record,
    get_dashboard_kpis,
    get_invite,
    iso_now,
    list_records_since,
    workspace_for,
)


@csrf_exempt
def api_entry(request: HttpRequest, route: str = "") -> HttpResponse:
    if request.method == "OPTIONS":
        return with_cors(HttpResponse(status=204), request)
    try:
        payload = dispatch(request, route)
        if isinstance(payload, HttpResponse):
            return with_cors(payload, request)
        return with_cors(JsonResponse(payload, safe=isinstance(payload, dict)), request)
    except AppError as error:
        return with_cors(JsonResponse({"error": error.message}, status=error.status), request)
    except json.JSONDecodeError:
        return with_cors(JsonResponse({"error": "Invalid JSON body."}, status=400), request)
    except Exception as error:
        return with_cors(JsonResponse({"error": str(error) or "Internal server error."}, status=500), request)


def dispatch(request: HttpRequest, route: str) -> dict[str, Any]:
    method = request.method.upper()
    segments = [segment for segment in route.strip("/").split("/") if segment]
    body = read_json(request) if method in {"POST", "PATCH", "DELETE"} else {}

    if method == "GET" and segments == ["health"]:
        return health_payload()
    if method == "GET" and segments == ["schema", "audit"]:
        return schema_audit()
    if method == "POST" and segments == ["auth", "register"]:
        return register_user(body)
    if method == "POST" and segments == ["auth", "login"]:
        client_ip = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "unknown"))
        _check_rate_limit(f"login:{client_ip}", max_attempts=10, window_seconds=60)
        return login_user(body)
    if method == "POST" and segments == ["auth", "refresh"]:
        return refresh_session(body)
    if method == "POST" and segments == ["auth", "logout"]:
        return logout(bearer_token(request, required=False), body)
    if method == "POST" and segments == ["auth", "password", "request"]:
        client_ip = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "unknown"))
        _check_rate_limit(f"pwreset:{client_ip}", max_attempts=3, window_seconds=3600)
        return request_password_reset(body)
    if method == "POST" and segments == ["auth", "password", "reset"]:
        return reset_password(body)

    if method == "GET" and len(segments) == 2 and segments[0] == "invites":
        return get_invite(unquote(segments[1]))
    if method == "POST" and segments == ["invites", "accept"]:
        return accept_invite(body)

    if method == "GET" and len(segments) == 3 and segments[:2] == ["payments", "esewa"] and segments[2] == "callback":
        # eSewa redirects browser here after payment: ?oid=...&amt=...&refId=...&plan=...
        from apps.rhinopeak.services.payment_service import verify_esewa_payment

        oid   = request.GET.get("oid", "")
        amt   = request.GET.get("amt", "")
        refId = request.GET.get("refId", "")
        plan  = request.GET.get("plan", "")

        result = verify_esewa_payment(oid, amt, refId)
        frontend_url = os.environ.get("RHINOPEAK_FRONTEND_URL", "http://localhost:3000")

        if result.get("success"):
            try:
                complete_payment_session(oid, "eSewa", str(result.get("transaction_code", refId)))
            except Exception as payment_error:
                return HttpResponseRedirect(
                    f"{frontend_url}/billing?payment=error&reason={quote(str(payment_error))}"
                )
            return HttpResponseRedirect(f"{frontend_url}/billing?payment=success&gateway=esewa")
        return HttpResponseRedirect(
            f"{frontend_url}/billing?payment=failed&reason={quote(str(result.get('error', 'verification_failed')))}"
        )

    if method == "POST" and segments == ["payments", "esewa", "verify"]:
        # Server-side verification endpoint (called from frontend after eSewa redirect)
        from apps.rhinopeak.services.payment_service import verify_esewa_payment

        result = verify_esewa_payment(
            oid=str(body.get("oid", "")),
            amt=str(body.get("amt", "")),
            refId=str(body.get("refId", "")),
        )
        if result.get("success"):
            try:
                complete_payment_session(
                    str(body.get("oid", "")),
                    "eSewa",
                    str(result.get("transaction_code", body.get("refId", ""))),
                )
            except Exception:
                pass
        return result

    if method == "GET" and segments == ["platform", "auth", "state"]:
        return platform_state()
    if method == "POST" and segments == ["platform", "auth", "setup-owner"]:
        return setup_platform_owner(body)
    if method == "POST" and segments == ["platform", "auth", "login"]:
        return login_platform_admin(body)
    if method == "POST" and segments == ["platform", "auth", "logout"]:
        return logout_platform_admin(bearer_token(request, required=False))

    if segments[:1] == ["platform"]:
        platform_admin = authenticate_platform_token(bearer_token(request, required=True))
        if method == "GET" and segments == ["platform", "bootstrap"]:
            return {"bootstrap": platform_bootstrap(platform_admin)}
        if method == "POST" and segments == ["platform", "admins"]:
            return create_platform_admin(platform_admin, body)
        if method == "PATCH" and len(segments) == 3 and segments[:2] == ["platform", "admins"]:
            return patch_platform_admin(platform_admin, segments[2], body)
        if method == "DELETE" and len(segments) == 3 and segments[:2] == ["platform", "admins"]:
            return delete_platform_admin(platform_admin, segments[2])
        if method == "POST" and segments == ["platform", "organizations"]:
            return create_platform_organization(platform_admin, body)
        if method == "PATCH" and len(segments) == 3 and segments[:2] == ["platform", "organizations"]:
            return patch_platform_organization(platform_admin, segments[2], body)
        if method == "DELETE" and len(segments) == 3 and segments[:2] == ["platform", "organizations"]:
            return delete_platform_organization(platform_admin, segments[2])
        if method == "POST" and segments == ["platform", "feature-flags"]:
            return create_platform_feature_flag(platform_admin, body)
        if method == "PATCH" and len(segments) == 3 and segments[:2] == ["platform", "feature-flags"]:
            return patch_platform_feature_flag(platform_admin, segments[2], body)
        if method == "DELETE" and len(segments) == 3 and segments[:2] == ["platform", "feature-flags"]:
            return delete_platform_feature_flag(platform_admin, segments[2])
        if method == "POST" and segments == ["platform", "support-tickets"]:
            return create_platform_support_ticket(platform_admin, body)
        if method == "PATCH" and len(segments) == 3 and segments[:2] == ["platform", "support-tickets"]:
            return patch_platform_support_ticket(platform_admin, segments[2], body)
        if method == "DELETE" and len(segments) == 3 and segments[:2] == ["platform", "support-tickets"]:
            return delete_platform_support_ticket(platform_admin, segments[2])
        if method == "PATCH" and len(segments) == 3 and segments[:2] == ["platform", "sessions"]:
            return revoke_platform_session(platform_admin, segments[2])
        raise AppError(404, "Platform route not found.")

    token = bearer_token(request, required=True)
    user = authenticate_access_token(token)

    if method == "GET" and segments == ["bootstrap"]:
        return {"bootstrap": bootstrap_payload(user)}
    if method == "GET" and segments == ["mobile", "bootstrap"]:
        return {
            "bootstrap": bootstrap_payload(user),
            "mobile": {
                "apiVersion": "4.0-mongo",
                "offlineCache": True,
                "recommendedSyncSeconds": 30,
                "crudNamespace": "/api/mobile",
                "syncPush": "/api/mobile/sync/push",
                "syncPull": "/api/mobile/sync/pull",
            },
        }
    if method in {"GET", "POST"} and segments in (["mobile", "session"], ["mobile", "auth", "session"]):
        workspace = workspace_for(user)
        return {
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": user["role"],
            },
            "workspace": {
                "id": workspace.get("id", ""),
                "name": workspace.get("name", ""),
                "plan": workspace.get("plan", "free"),
                "currency": workspace.get("currency", "NPR"),
            },
            "apiVersion": "4.1",
            "lastSyncAt": user.get("lastSyncAt", None),
        }
    if method == "GET" and segments == ["mobile", "sync"]:
        since = request.GET.get("since", "")
        kinds = ["sales", "inventory", "customers", "expenses", "purchases"]
        result: dict[str, Any] = {}
        for kind in kinds:
            records = list_records_since(user["workspaceId"], kind, since)
            if records:
                result[kind] = records
        return {"delta": result, "syncedAt": iso_now()}
    if method == "GET" and segments == ["mobile", "dashboard"]:
        return {"kpis": get_dashboard_kpis(user["workspaceId"])}

    if segments[:1] == ["mobile"]:
        segments = segments[1:]

    if method == "GET" and len(segments) == 3 and segments[0] == "details":
        return {"detail": detail_payload(user, segments[1], unquote(segments[2]))}

    if method == "POST" and segments == ["assistant", "command"]:
        return handle_assistant_command(user, body)

    if method == "POST" and segments == ["sales"]:
        return create_sale(user, body)
    if method == "PATCH" and len(segments) == 2 and segments[0] == "sales":
        return patch_sale(user, segments[1], body)
    if method == "DELETE" and len(segments) == 2 and segments[0] == "sales":
        return delete_sale(user, segments[1])

    if method == "POST" and segments == ["parties"]:
        return create_party(user, body)
    if method == "PATCH" and len(segments) == 2 and segments[0] == "parties":
        return update_party(user, segments[1], body)
    if method == "DELETE" and len(segments) == 2 and segments[0] == "parties":
        return delete_party(user, segments[1])
    if method == "POST" and segments == ["party-ledger"]:
        return create_party_ledger_entry(user, body)

    if method == "POST" and segments == ["purchases"]:
        return create_purchase(user, body)
    if method == "PATCH" and len(segments) == 2 and segments[0] == "purchases":
        return update_purchase(user, segments[1], body)
    if method == "DELETE" and len(segments) == 2 and segments[0] == "purchases":
        return delete_purchase(user, segments[1])

    if method == "POST" and segments == ["expenses"]:
        return create_expense(user, body)
    if method == "PATCH" and len(segments) == 2 and segments[0] == "expenses":
        return update_expense(user, segments[1], body)
    if method == "DELETE" and len(segments) == 2 and segments[0] == "expenses":
        return delete_expense(user, segments[1])
    if method == "POST" and segments == ["expenses", "categories"]:
        return create_expense_category(user, body)
    if method == "PATCH" and len(segments) == 3 and segments[:2] == ["expenses", "categories"]:
        return update_expense_category(user, unquote(segments[2]), body)
    if method == "DELETE" and len(segments) == 3 and segments[:2] == ["expenses", "categories"]:
        return delete_expense_category(user, unquote(segments[2]))

    if method == "POST" and segments == ["cash-bank-accounts"]:
        return create_cash_bank_account(user, body)
    if method == "PATCH" and len(segments) == 2 and segments[0] == "cash-bank-accounts":
        return update_cash_bank_account(user, segments[1], body)
    if method == "DELETE" and len(segments) == 2 and segments[0] == "cash-bank-accounts":
        return delete_cash_bank_account(user, segments[1])
    if method == "POST" and segments == ["money-movements"]:
        return create_money_movement(user, body)
    if method == "PATCH" and len(segments) == 2 and segments[0] == "money-movements":
        return update_generic_record(user, "money-movements", segments[1], body)
    if method == "DELETE" and len(segments) == 2 and segments[0] == "money-movements":
        return delete_generic_record(user, "money-movements", segments[1])

    if method == "POST" and segments == ["documents"]:
        return create_document(user, body)
    if method == "PATCH" and len(segments) == 2 and segments[0] == "documents":
        return update_generic_record(user, "documents", segments[1], body)
    if method == "DELETE" and len(segments) == 2 and segments[0] == "documents":
        return delete_document(user, segments[1])

    if method == "GET" and segments == ["bill-scans"]:
        return list_bill_scans(user)
    if method == "POST" and segments == ["bill-scans", "upload"]:
        return upload_bill_scan(user, body)
    if method == "GET" and len(segments) == 2 and segments[0] == "bill-scans":
        return get_bill_scan(user, segments[1])
    if method == "POST" and len(segments) == 3 and segments[0] == "bill-scans" and segments[2] == "parse":
        return parse_bill_scan(user, segments[1], body)
    if method == "POST" and len(segments) == 3 and segments[0] == "bill-scans" and segments[2] == "approve":
        return approve_bill_scan(user, segments[1], body)
    if method == "PATCH" and len(segments) == 2 and segments[0] == "bill-scans":
        return update_generic_record(user, "bill-scans", segments[1], body)
    if method == "DELETE" and len(segments) == 2 and segments[0] == "bill-scans":
        return delete_generic_record(user, "bill-scans", segments[1])

    if method == "POST" and segments == ["reminder-templates"]:
        return create_reminder_template(user, body)
    if method == "PATCH" and len(segments) == 2 and segments[0] == "reminder-templates":
        return update_generic_record(user, "reminder-templates", segments[1], body)
    if method == "DELETE" and len(segments) == 2 and segments[0] == "reminder-templates":
        return delete_generic_record(user, "reminder-templates", segments[1])
    if method == "POST" and segments == ["reminders"]:
        return create_reminder_log(user, body)
    if method == "PATCH" and len(segments) == 2 and segments[0] == "reminders":
        return update_generic_record(user, "reminders", segments[1], body)
    if method == "DELETE" and len(segments) == 2 and segments[0] == "reminders":
        return delete_generic_record(user, "reminders", segments[1])

    if method == "POST" and segments == ["sync", "push"]:
        return push_sync_operation(user, body)
    if method == "GET" and segments == ["sync", "pull"]:
        return {"bootstrap": bootstrap_payload(user)}
    if method == "PATCH" and len(segments) == 2 and segments[0] == "sync-operations":
        return update_generic_record(user, "sync-operations", segments[1], body)
    if method == "DELETE" and len(segments) == 2 and segments[0] == "sync-operations":
        return delete_generic_record(user, "sync-operations", segments[1])

    if method == "POST" and segments == ["customers"]:
        return create_customer(user, body)
    if method == "PATCH" and len(segments) == 2 and segments[0] == "customers":
        return update_customer(user, segments[1], body)
    if method == "DELETE" and len(segments) == 2 and segments[0] == "customers":
        return delete_generic_record(user, "customers", segments[1])

    if method == "POST" and segments == ["suppliers"]:
        return create_supplier(user, body)
    if method == "PATCH" and len(segments) == 2 and segments[0] == "suppliers":
        return update_supplier(user, segments[1], body)
    if method == "DELETE" and len(segments) == 2 and segments[0] == "suppliers":
        return delete_supplier(user, segments[1])
    if method == "POST" and segments == ["credit-ledger"]:
        return create_credit_entry(user, body)
    if method == "PATCH" and len(segments) == 2 and segments[0] == "credit-ledger":
        return update_generic_record(user, "credit-ledger", segments[1], body)
    if method == "DELETE" and len(segments) == 2 and segments[0] == "credit-ledger":
        return delete_generic_record(user, "credit-ledger", segments[1])

    if method == "POST" and segments == ["inventory", "categories"]:
        return create_inventory_category(user, body)
    if method == "PATCH" and len(segments) == 3 and segments[:2] == ["inventory", "categories"]:
        return update_inventory_category(user, unquote(segments[2]), body)
    if method == "DELETE" and len(segments) == 3 and segments[:2] == ["inventory", "categories"]:
        return delete_inventory_category(user, unquote(segments[2]))
    if method == "POST" and segments == ["inventory"]:
        return create_product(user, body)
    if method == "PATCH" and len(segments) == 2 and segments[0] == "inventory":
        return update_generic_record(user, "inventory", segments[1], body)
    if method == "DELETE" and len(segments) == 2 and segments[0] == "inventory":
        return delete_generic_record(user, "inventory", segments[1])
    if method == "POST" and segments == ["inventory", "movements"]:
        return create_movement(user, body)
    if method == "PATCH" and len(segments) == 2 and segments[0] == "inventory-movements":
        return update_generic_record(user, "inventory-movements", segments[1], body)
    if method == "DELETE" and len(segments) == 2 and segments[0] == "inventory-movements":
        return delete_generic_record(user, "inventory-movements", segments[1])

    if method == "POST" and segments == ["reports"]:
        return create_report(user, body)
    if method == "PATCH" and len(segments) == 2 and segments[0] == "reports":
        return update_generic_record(user, "reports", segments[1], body)
    if method == "DELETE" and len(segments) == 2 and segments[0] == "reports":
        return delete_generic_record(user, "reports", segments[1])

    if method == "PATCH" and segments == ["settings"]:
        return update_settings(user, body)
    if method == "PATCH" and segments == ["billing", "plan"]:
        return update_billing_plan(user, body)

    if method == "POST" and segments == ["roles"]:
        return create_role(user, body)
    if method == "PATCH" and len(segments) == 2 and segments[0] == "roles":
        return update_role(user, segments[1], body)
    if method == "DELETE" and len(segments) == 2 and segments[0] == "roles":
        return delete_role(user, segments[1])

    if method == "POST" and segments == ["users", "invite"]:
        return invite_user(user, body)
    if method == "PATCH" and len(segments) == 3 and segments[0] == "users" and segments[2] == "role":
        return update_user_role(user, segments[1], str(body.get("role", "")))

    # ------------------------------------------------------------------
    # Payment routes
    # ------------------------------------------------------------------
    if method == "POST" and segments == ["payments", "initiate"]:
        from apps.rhinopeak.services.payment_service import initiate_esewa_payment, initiate_khalti_payment

        payment_session = create_payment_session(user, body)
        gateway = str(payment_session["gateway"]).lower()
        amount = float(payment_session["amount"])
        plan = str(payment_session["plan"])
        transaction_uuid = str(payment_session["transactionUuid"])
        if gateway == "khalti":
            result = initiate_khalti_payment(
                transaction_uuid, amount, plan,
                customer_name=user.get("name", ""),
                customer_email=user.get("email", ""),
            )
        else:  # default: esewa
            result = initiate_esewa_payment(transaction_uuid, amount, plan)
        return {"payment": result, "transactionUuid": transaction_uuid, "session": payment_session}

    if method == "POST" and segments == ["payments", "khalti", "verify"]:
        from apps.rhinopeak.services.payment_service import verify_khalti_payment

        pidx           = str(body.get("pidx", ""))
        expected_amount = body.get("amount")  # in paisa, optional
        result = verify_khalti_payment(pidx, expected_amount=int(expected_amount) if expected_amount else None)
        if result.get("success"):
            transaction_uuid = str(body.get("transactionUuid") or pidx.removeprefix("demo_"))
            complete_payment_session(transaction_uuid, "Khalti", str(result.get("transaction_id", "")))
        return result

    raise AppError(404, "Route not found.")


def read_json(request: HttpRequest) -> dict[str, Any]:
    if not request.body:
        return {}
    payload = json.loads(request.body.decode("utf-8"))
    if not isinstance(payload, dict):
        raise AppError(400, "JSON body must be an object.")
    return payload


def bearer_token(request: HttpRequest, required: bool) -> str | None:
    header = request.headers.get("Authorization", "")
    if header.lower().startswith("bearer "):
        return header.split(" ", 1)[1].strip()
    if required:
        raise AppError(401, "Missing bearer token.")
    return None


def with_cors(response: HttpResponse, request: HttpRequest) -> HttpResponse:
    origin = request.headers.get("Origin")
    if origin in settings.CORS_ORIGINS:
        response["Access-Control-Allow-Origin"] = origin
        response["Vary"] = "Origin"
    elif settings.DEBUG:
        response["Access-Control-Allow-Origin"] = "*"
    response["Access-Control-Allow-Methods"] = "GET,POST,PATCH,DELETE,OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response["Access-Control-Max-Age"] = "86400"
    return response
