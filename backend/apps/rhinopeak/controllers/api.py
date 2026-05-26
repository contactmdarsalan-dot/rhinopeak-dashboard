from __future__ import annotations

import json
import os
import secrets
import time
import uuid
import logging
from collections import defaultdict
from typing import Any
from urllib.parse import quote, unquote

from django.conf import settings
from django.http import HttpRequest, HttpResponse, HttpResponseRedirect, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.rhinopeak.domain.errors import AppError
from apps.rhinopeak.domain.validation import (
    KhaltiVerifyRequest,
    LoginRequest,
    LogoutRequest,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    PaymentInitiateRequest,
    RefreshRequest,
    RegisterRequest,
    validate_request,
)

logger = logging.getLogger(__name__)

_request_counts: dict[tuple[str, str, str], int] = defaultdict(int)
_request_duration_sum: dict[tuple[str, str, str], float] = defaultdict(float)
_request_duration_count: dict[tuple[str, str, str], int] = defaultdict(int)
_metrics_started_at = time.time()

# ---------------------------------------------------------------------------
# Correlation ID for distributed tracing
# ---------------------------------------------------------------------------

def get_correlation_id(request: HttpRequest) -> str:
    """Get or generate a correlation ID for request tracing."""
    return request.headers.get("X-Correlation-ID") or request.headers.get("X-Request-ID") or str(uuid.uuid4())


def set_correlation_id(response: HttpResponse, correlation_id: str) -> HttpResponse:
    """Set correlation ID in response headers."""
    response["X-Correlation-ID"] = correlation_id
    return response


def get_trace_context(request: HttpRequest) -> dict[str, str]:
    """Create or continue a W3C trace context for log correlation."""
    traceparent = request.headers.get("traceparent", "")
    parts = traceparent.split("-")
    if (
        len(parts) == 4
        and parts[0] == "00"
        and len(parts[1]) == 32
        and len(parts[2]) == 16
        and len(parts[3]) == 2
    ):
        return {
            "trace_id": parts[1],
            "parent_span_id": parts[2],
            "span_id": secrets.token_hex(8),
            "sampled": parts[3],
        }
    return {
        "trace_id": secrets.token_hex(16),
        "parent_span_id": "",
        "span_id": secrets.token_hex(8),
        "sampled": "01",
    }


def set_trace_headers(response: HttpResponse, trace: dict[str, str]) -> HttpResponse:
    response["X-Trace-ID"] = trace["trace_id"]
    response["traceparent"] = f"00-{trace['trace_id']}-{trace['span_id']}-{trace['sampled']}"
    response["X-API-Version"] = str(getattr(settings, "API_VERSION", "v1"))
    return response


def _record_http_metric(method: str, route: str, status: int, duration_seconds: float) -> None:
    if not getattr(settings, "ENABLE_METRICS", True):
        return
    route_label = "/" + route.strip("/") if route.strip("/") else "/"
    if len(route_label) > 140:
        route_label = route_label[:137] + "..."
    key = (method.upper(), route_label, str(status))
    _request_counts[key] += 1
    _request_duration_sum[key] += duration_seconds
    _request_duration_count[key] += 1


def _metric_label(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


# ---------------------------------------------------------------------------
# Redis-backed rate limiter with in-memory fallback
# ---------------------------------------------------------------------------
_rate_limit_store: dict[str, list[float]] = defaultdict(list)
_redis_client = None
_CACHE_PREFIX = "rhinopeak:cache"


def _get_redis_client():
    """Lazily connect to Redis; falls back to in-memory store on failure."""
    global _redis_client
    if _redis_client is None:
        import os
        try:
            import redis
            if getattr(settings, 'REDIS_ENABLED', True):
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
        results = pipe.execute()
        current_count = int(results[1] or 0)
        if current_count >= max_attempts:
            logger.warning(f"Rate limit exceeded for key: {key}", extra={"key": key, "max_attempts": max_attempts})
            raise AppError(429, "Too many attempts. Please try again later.")
        return

    # In-memory fallback for local dev without Redis
    window_start = now - window_seconds
    _rate_limit_store[key] = [t for t in _rate_limit_store[key] if t > window_start]
    if len(_rate_limit_store[key]) >= max_attempts:
        logger.warning(f"Rate limit exceeded (in-memory) for key: {key}", extra={"key": key, "max_attempts": max_attempts})
        raise AppError(429, "Too many attempts. Please try again later.")
    _rate_limit_store[key].append(now)


def _cache_key(workspace_id: str, name: str, *parts: str) -> str:
    safe_parts = [str(part).replace(":", "_") for part in (workspace_id, name, *parts)]
    return f"{_CACHE_PREFIX}:" + ":".join(safe_parts)


def _cached_json(key: str, loader, ttl_seconds: int | None = None) -> Any:
    redis = _get_redis_client()
    if not redis:
        return loader()
    try:
        cached = redis.get(key)
        if cached:
            if isinstance(cached, bytes):
                cached = cached.decode("utf-8")
            return json.loads(cached)
    except Exception as error:
        logger.debug("Redis cache read skipped.", extra={"cache_key": key, "error_type": type(error).__name__})

    value = loader()
    try:
        ttl = ttl_seconds or getattr(settings, "REDIS_CACHE_TTL_SECONDS", 300)
        redis.setex(key, ttl, json.dumps(value, default=str))
    except Exception as error:
        logger.debug("Redis cache write skipped.", extra={"cache_key": key, "error_type": type(error).__name__})
    return value


def _invalidate_workspace_cache(workspace_id: str) -> None:
    redis = _get_redis_client()
    if not redis or not workspace_id:
        return
    pattern = _cache_key(workspace_id, "*")
    try:
        keys = list(redis.scan_iter(match=pattern, count=100))
        if keys:
            redis.delete(*keys)
    except Exception as error:
        logger.debug("Redis cache invalidation skipped.", extra={"workspace_id": workspace_id, "error_type": type(error).__name__})


def _invalidate_cache_after_mutation(request: HttpRequest, route: str) -> None:
    if request.method.upper() not in {"POST", "PATCH", "DELETE"}:
        return
    if route.startswith(("auth/", "platform/", "payments/esewa/callback")):
        return
    try:
        user = authenticate_access_token(bearer_token(request, required=False))
    except Exception:
        return
    _invalidate_workspace_cache(str(user.get("workspaceId", "")))
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
    register_device_token,
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
    list_entity_records,
    list_records_since,
    workspace_for,
)


@csrf_exempt
def api_entry(request: HttpRequest, route: str = "") -> HttpResponse:
    """Main API entry point with correlation ID tracking and security hardening."""
    # Get or generate correlation ID
    correlation_id = get_correlation_id(request)
    trace = get_trace_context(request)
    started_at = time.perf_counter()

    if request.method == "OPTIONS":
        response = HttpResponse(status=204)
        response = with_cors(set_trace_headers(set_correlation_id(response, correlation_id), trace), request)
        _record_http_metric(request.method, route, response.status_code, time.perf_counter() - started_at)
        return response

    try:
        # Log request with correlation ID
        logger.info(
            f"API Request: {request.method} /{route}",
            extra={
                "correlation_id": correlation_id,
                "trace_id": trace["trace_id"],
                "span_id": trace["span_id"],
                "method": request.method,
                "path": f"/{route}",
                "client_ip": request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR")),
            }
        )

        payload = dispatch(request, route)
        if isinstance(payload, HttpResponse):
            response = with_cors(payload, request)
            response = set_correlation_id(response, correlation_id)
            response = set_trace_headers(response, trace)
            _record_http_metric(request.method, route, response.status_code, time.perf_counter() - started_at)
            return response

        _invalidate_cache_after_mutation(request, route)
        response = with_cors(JsonResponse(payload, safe=isinstance(payload, dict)), request)
        response = set_correlation_id(response, correlation_id)
        response = set_trace_headers(response, trace)
        _record_http_metric(request.method, route, response.status_code, time.perf_counter() - started_at)
        return response

    except AppError as error:
        logger.warning(
            f"AppError in API: {error.message}",
            extra={"correlation_id": correlation_id, "trace_id": trace["trace_id"], "status": error.status}
        )
        response = with_cors(
            set_trace_headers(
                set_correlation_id(JsonResponse({"error": error.message}, status=error.status), correlation_id),
                trace,
            ),
            request,
        )
        _record_http_metric(request.method, route, response.status_code, time.perf_counter() - started_at)
        return response
    except json.JSONDecodeError:
        response = with_cors(
            set_trace_headers(
                set_correlation_id(JsonResponse({"error": "Invalid JSON body."}, status=400), correlation_id),
                trace,
            ),
            request,
        )
        _record_http_metric(request.method, route, response.status_code, time.perf_counter() - started_at)
        return response
    except Exception as error:
        # SECURITY FIX: Don't expose internal error messages to clients
        logger.exception(
            f"Unhandled error in API request",
            extra={"correlation_id": correlation_id, "trace_id": trace["trace_id"], "error_type": type(error).__name__}
        )
        response = with_cors(
            set_trace_headers(
                set_correlation_id(JsonResponse({"error": "An unexpected error occurred."}, status=500), correlation_id),
                trace,
            ),
            request,
        )
        _record_http_metric(request.method, route, response.status_code, time.perf_counter() - started_at)
        return response


def dispatch(request: HttpRequest, route: str) -> dict[str, Any]:
    method = request.method.upper()
    segments = [segment for segment in route.strip("/").split("/") if segment]
    configured_version = str(getattr(settings, "API_VERSION", "v1")).strip("/")
    if segments and configured_version and segments[0] == configured_version:
        segments = segments[1:]
    body = read_json(request) if method in {"POST", "PATCH", "DELETE"} else {}

    # ── Health Check Endpoints ────────────────────────────────────────────────
    # Basic liveness check - is the server alive?
    if method == "GET" and segments == ["health"]:
        return health_payload()

    # Kubernetes-style liveness probe - is the server ready to serve traffic?
    if method == "GET" and segments == ["health", "live"]:
        return {"status": "alive", "timestamp": __import__('datetime').datetime.now().isoformat()}

    # Readiness probe - is the server ready to accept traffic?
    if method == "GET" and segments == ["health", "ready"]:
        return _health_check_readiness()

    # Detailed health check for monitoring
    if method == "GET" and segments == ["health", "details"]:
        return _health_check_detailed()

    if method == "GET" and segments == ["metrics"]:
        return _metrics_response()

    # ── API Version Endpoint ──────────────────────────────────────────────────
    if method == "GET" and segments == ["version"]:
        return _api_version_info()
    if method == "GET" and segments == ["schema", "audit"]:
        return schema_audit()
    if method == "POST" and segments == ["auth", "register"]:
        return register_user(_validated_payload(RegisterRequest, body))
    if method == "POST" and segments == ["auth", "login"]:
        client_ip = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "unknown"))
        _check_rate_limit(
            f"login:{client_ip}",
            max_attempts=settings.RATE_LIMIT_AUTH_MAX_ATTEMPTS,
            window_seconds=settings.RATE_LIMIT_AUTH_WINDOW_SECONDS,
        )
        return login_user(_validated_payload(LoginRequest, body))
    if method == "POST" and segments == ["auth", "refresh"]:
        return refresh_session(_validated_payload(RefreshRequest, body))
    if method == "POST" and segments == ["auth", "logout"]:
        return logout(bearer_token(request, required=False), _validated_payload(LogoutRequest, body))
    if method == "POST" and segments == ["auth", "password", "request"]:
        client_ip = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "unknown"))
        _check_rate_limit(
            f"pwreset:{client_ip}",
            max_attempts=settings.RATE_LIMIT_PASSWORD_RESET_MAX,
            window_seconds=settings.RATE_LIMIT_PASSWORD_RESET_WINDOW,
        )
        return request_password_reset(_validated_payload(PasswordResetRequest, body))
    if method == "POST" and segments == ["auth", "password", "reset"]:
        return reset_password(_validated_payload(PasswordResetConfirmRequest, body))

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
        key = _cache_key(user["workspaceId"], "bootstrap", user["id"])
        return {"bootstrap": _cached_json(key, lambda: bootstrap_payload(user))}
    if method == "GET" and segments == ["mobile", "bootstrap"]:
        key = _cache_key(user["workspaceId"], "bootstrap", user["id"])
        return {
            "bootstrap": _cached_json(key, lambda: bootstrap_payload(user)),
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
    if method == "POST" and segments == ["mobile", "push-token"]:
        return register_device_token(user, body)
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
        key = _cache_key(user["workspaceId"], "dashboard-kpis")
        return {"kpis": _cached_json(key, lambda: get_dashboard_kpis(user["workspaceId"]), ttl_seconds=60)}

    if segments[:1] == ["mobile"]:
        segments = segments[1:]

    if method == "GET" and len(segments) == 2 and segments[0] == "records":
        page_size = _query_int(request, "page_size", 50, minimum=1, maximum=200)
        page_size = _query_int(request, "pageSize", page_size, minimum=1, maximum=200)
        return list_entity_records(
            user,
            segments[1],
            page=_query_int(request, "page", 1, minimum=1),
            page_size=page_size,
            sort_by=str(request.GET.get("sortBy", "createdAt")),
            sort_order=str(request.GET.get("sortOrder", "desc")),
            include_deleted=request.GET.get("includeDeleted") in {"1", "true", "True"},
        )

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

        body = _validated_payload(PaymentInitiateRequest, body)
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

        body = _validated_payload(KhaltiVerifyRequest, body)
        pidx           = str(body.get("pidx", ""))
        expected_amount = body.get("amount")  # in paisa, optional
        result = verify_khalti_payment(pidx, expected_amount=int(expected_amount) if expected_amount else None)
        if result.get("success"):
            transaction_uuid = str(body.get("transactionUuid") or pidx.removeprefix("demo_"))
            complete_payment_session(transaction_uuid, "Khalti", str(result.get("transaction_id", "")))
        return result

    raise AppError(404, "Route not found.")


def _validated_payload(schema_class: Any, body: dict[str, Any]) -> dict[str, Any]:
    return validate_request(schema_class, body).model_dump(exclude_none=True)


def _query_int(request: HttpRequest, name: str, default: int, minimum: int | None = None, maximum: int | None = None) -> int:
    raw = request.GET.get(name)
    if raw in {None, ""}:
        return default
    try:
        value = int(str(raw))
    except (TypeError, ValueError):
        raise AppError(400, f"{name} must be an integer.")
    if minimum is not None and value < minimum:
        raise AppError(400, f"{name} must be at least {minimum}.")
    if maximum is not None and value > maximum:
        raise AppError(400, f"{name} must be at most {maximum}.")
    return value


def _health_check_readiness() -> dict[str, Any]:
    from apps.rhinopeak.data.mongo import ping_mongo

    checks: dict[str, Any] = {
        "database": "unknown",
        "redis": "disabled",
    }
    try:
        ping_mongo()
        checks["database"] = "ok"
    except Exception as exc:
        checks["database"] = "error"
        checks["databaseError"] = type(exc).__name__

    if getattr(settings, "REDIS_ENABLED", False):
        try:
            redis = _get_redis_client()
            if redis:
                redis.ping()
                checks["redis"] = "ok"
            else:
                checks["redis"] = "unavailable"
        except Exception as exc:
            checks["redis"] = "error"
            checks["redisError"] = type(exc).__name__

    ready = checks["database"] == "ok"
    if not ready:
        raise AppError(503, "Service is not ready.")
    return {"status": "ready", "checks": checks, "timestamp": iso_now()}


def _health_check_detailed() -> dict[str, Any]:
    from apps.rhinopeak.data.mongo import mongo_counts

    details = health_payload()
    try:
        details["counts"] = mongo_counts()
    except Exception as exc:
        details["countsError"] = type(exc).__name__
    details["environment"] = getattr(settings, "ENVIRONMENT", "development")
    details["metricsEnabled"] = getattr(settings, "ENABLE_METRICS", True)
    return details


def _api_version_info() -> dict[str, Any]:
    return {
        "apiVersion": getattr(settings, "API_VERSION", "v1"),
        "versionHeader": getattr(settings, "API_VERSION_HEADER", "X-API-Version"),
        "environment": getattr(settings, "ENVIRONMENT", "development"),
    }


def _metrics_response() -> HttpResponse:
    if not getattr(settings, "ENABLE_METRICS", True):
        raise AppError(404, "Metrics are disabled.")

    lines = [
        "# HELP rhinopeak_http_requests_total Total API requests.",
        "# TYPE rhinopeak_http_requests_total counter",
    ]
    for (method, route, status), value in sorted(_request_counts.items()):
        lines.append(
            'rhinopeak_http_requests_total{method="%s",route="%s",status="%s"} %d'
            % (_metric_label(method), _metric_label(route), _metric_label(status), value)
        )

    lines.extend([
        "# HELP rhinopeak_http_request_duration_seconds_sum Total API request duration.",
        "# TYPE rhinopeak_http_request_duration_seconds_sum counter",
    ])
    for (method, route, status), value in sorted(_request_duration_sum.items()):
        lines.append(
            'rhinopeak_http_request_duration_seconds_sum{method="%s",route="%s",status="%s"} %.6f'
            % (_metric_label(method), _metric_label(route), _metric_label(status), value)
        )

    lines.extend([
        "# HELP rhinopeak_http_request_duration_seconds_count Count of timed API requests.",
        "# TYPE rhinopeak_http_request_duration_seconds_count counter",
    ])
    for (method, route, status), value in sorted(_request_duration_count.items()):
        lines.append(
            'rhinopeak_http_request_duration_seconds_count{method="%s",route="%s",status="%s"} %d'
            % (_metric_label(method), _metric_label(route), _metric_label(status), value)
        )

    uptime = max(0, time.time() - _metrics_started_at)
    lines.extend([
        "# HELP rhinopeak_process_uptime_seconds API process uptime in seconds.",
        "# TYPE rhinopeak_process_uptime_seconds gauge",
        f"rhinopeak_process_uptime_seconds {uptime:.0f}",
        "# HELP rhinopeak_build_info Static application metadata.",
        "# TYPE rhinopeak_build_info gauge",
        'rhinopeak_build_info{api_version="%s",environment="%s"} 1'
        % (
            _metric_label(str(getattr(settings, "API_VERSION", "v1"))),
            _metric_label(str(getattr(settings, "ENVIRONMENT", "development"))),
        ),
    ])
    return HttpResponse("\n".join(lines) + "\n", content_type="text/plain; version=0.0.4; charset=utf-8")


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
    """Add CORS headers with security hardening.

    SECURITY FIX: Removed wildcard CORS in debug mode.
    Debug mode no longer allows "*" - must use explicit allowed origins.
    """
    origin = request.headers.get("Origin")
    if origin in settings.CORS_ORIGINS:
        response["Access-Control-Allow-Origin"] = origin
        response["Vary"] = "Origin"
        response["Access-Control-Allow-Credentials"] = "true"
    # SECURITY FIX: No wildcard CORS even in DEBUG mode unless PRODUCTION is explicitly False
    elif settings.DEBUG and not settings.PRODUCTION:
        # Only allow for localhost development
        if origin and ("localhost" in origin or "127.0.0.1" in origin):
            response["Access-Control-Allow-Origin"] = origin
            response["Vary"] = "Origin"
    response["Access-Control-Allow-Methods"] = "GET,POST,PATCH,DELETE,OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type,Authorization,X-Request-ID,X-Correlation-ID"
    response["Access-Control-Expose-Headers"] = "X-Request-ID,X-Correlation-ID,X-Trace-ID,traceparent,X-API-Version"
    response["Access-Control-Max-Age"] = "86400"
    return response
