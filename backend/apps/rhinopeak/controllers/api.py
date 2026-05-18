from __future__ import annotations

import json
from typing import Any

from django.conf import settings
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.rhinopeak.domain.errors import AppError
from apps.rhinopeak.services.mongo_service import (
    authenticate_access_token,
    authenticate_platform_token,
    bootstrap_payload,
    create_customer,
    create_movement,
    create_platform_admin,
    create_platform_feature_flag,
    create_platform_organization,
    create_platform_support_ticket,
    create_product,
    create_report,
    create_role,
    create_sale,
    delete_platform_admin,
    delete_platform_feature_flag,
    delete_platform_organization,
    delete_platform_support_ticket,
    delete_role,
    delete_sale,
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
    update_customer,
    update_role,
    update_settings,
    update_user_role,
)


@csrf_exempt
def api_entry(request: HttpRequest, route: str = "") -> HttpResponse:
    if request.method == "OPTIONS":
        return with_cors(HttpResponse(status=204), request)
    try:
        payload = dispatch(request, route)
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
        return login_user(body)
    if method == "POST" and segments == ["auth", "refresh"]:
        return refresh_session(body)
    if method == "POST" and segments == ["auth", "logout"]:
        return logout(bearer_token(request, required=False), body)
    if method == "POST" and segments == ["auth", "password", "request"]:
        return request_password_reset(body)
    if method == "POST" and segments == ["auth", "password", "reset"]:
        return reset_password(body)

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
            },
        }

    if method == "POST" and segments == ["sales"]:
        return create_sale(user, body)
    if method == "PATCH" and len(segments) == 2 and segments[0] == "sales":
        return patch_sale(user, segments[1], body)
    if method == "DELETE" and len(segments) == 2 and segments[0] == "sales":
        return delete_sale(user, segments[1])

    if method == "POST" and segments == ["customers"]:
        return create_customer(user, body)
    if method == "PATCH" and len(segments) == 2 and segments[0] == "customers":
        return update_customer(user, segments[1], body)

    if method == "POST" and segments == ["inventory"]:
        return create_product(user, body)
    if method == "POST" and segments == ["inventory", "movements"]:
        return create_movement(user, body)

    if method == "POST" and segments == ["reports"]:
        return create_report(user, body)

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
    allowed_origin = origin if origin in settings.CORS_ORIGINS else "*"
    response["Access-Control-Allow-Origin"] = allowed_origin
    response["Access-Control-Allow-Methods"] = "GET,POST,PATCH,DELETE,OPTIONS"
    response["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response["Access-Control-Max-Age"] = "86400"
    return response
