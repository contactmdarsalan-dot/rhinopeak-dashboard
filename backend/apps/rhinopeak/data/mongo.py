from __future__ import annotations

from functools import lru_cache
from typing import Any

from django.conf import settings
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.errors import OperationFailure


@lru_cache(maxsize=1)
def mongo_client() -> MongoClient:
    return MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=settings.MONGO_SERVER_SELECTION_TIMEOUT_MS)


def mongo_db() -> Database:
    return mongo_client()[settings.MONGO_DB_NAME]


def collection(name: str) -> Collection:
    return mongo_db()[name]


def ping_mongo() -> dict[str, Any]:
    return mongo_client().admin.command("ping")


def strip_mongo_id(document: dict[str, Any] | None) -> dict[str, Any] | None:
    if document is None:
        return None
    cleaned = dict(document)
    cleaned.pop("_id", None)
    return cleaned


def _create_index(collection_obj: Collection, keys: list[tuple[str, int]], **options: Any) -> None:
    try:
        collection_obj.create_index(keys, **options)
    except OperationFailure as exc:
        if exc.code == 85:
            return
        raise


def ensure_indexes() -> None:
    ping_mongo()
    db = mongo_db()
    db.workspaces.create_index([("id", ASCENDING)], unique=True)
    db.workspaces.create_index([("plan", ASCENDING)])
    db.workspaces.create_index([("status", ASCENDING)])
    db.workspaces.create_index([("subscriptionStatus", ASCENDING)])
    db.workspaces.create_index([("country", ASCENDING), ("timezone", ASCENDING)])
    db.workspaces.create_index([("createdAt", DESCENDING)])

    db.businesses.create_index([("id", ASCENDING)], unique=True)
    db.businesses.create_index([("workspaceId", ASCENDING), ("createdAt", ASCENDING)])

    db.roles.create_index([("id", ASCENDING)], unique=True)
    db.roles.create_index([("workspaceId", ASCENDING), ("name", ASCENDING)], unique=True)
    db.roles.create_index([("workspaceId", ASCENDING), ("systemRole", DESCENDING)])

    db.users.create_index([("id", ASCENDING)], unique=True)
    db.users.create_index([("emailNormalized", ASCENDING)], unique=True)
    db.users.create_index([("workspaceId", ASCENDING), ("role", ASCENDING)])
    db.users.create_index([("status", ASCENDING)])
    db.users.create_index([("lastLoginAt", DESCENDING)])

    db.sessions.create_index([("accessTokenHash", ASCENDING)], unique=True)
    db.sessions.create_index([("refreshTokenHash", ASCENDING)], unique=True)
    db.sessions.create_index([("userId", ASCENDING)])
    db.sessions.create_index([("expiresAt", ASCENDING)])
    db.sessions.create_index([("revokedAt", ASCENDING)])

    db.password_reset_tokens.create_index([("id", ASCENDING)], unique=True)
    db.password_reset_tokens.create_index([("userId", ASCENDING), ("tokenHash", ASCENDING), ("usedAt", ASCENDING)])
    db.password_reset_tokens.create_index([("expiresAt", ASCENDING)])

    db.payment_sessions.create_index([("transactionUuid", ASCENDING)], unique=True)
    db.payment_sessions.create_index([("workspaceId", ASCENDING), ("createdAt", DESCENDING)])
    db.payment_sessions.create_index([("status", ASCENDING)])
    _create_index(
        db.payment_sessions,
        [("workspaceId", ASCENDING), ("status", ASCENDING), ("createdAt", DESCENDING)],
        name="idx_payment_workspace_status_created",
    )

    _create_index(db.device_tokens, [("workspaceId", ASCENDING), ("userId", ASCENDING), ("tokenHash", ASCENDING)], unique=True, name="idx_device_token_unique")
    _create_index(db.device_tokens, [("workspaceId", ASCENDING), ("userId", ASCENDING), ("updatedAt", DESCENDING)], name="idx_device_token_user_updated")
    db.device_tokens.create_index([("tokenHash", ASCENDING)])
    db.device_tokens.create_index([("enabled", ASCENDING), ("updatedAt", DESCENDING)])

    db.settings.create_index([("workspaceId", ASCENDING)], unique=True)

    db.records.create_index([("workspaceId", ASCENDING), ("kind", ASCENDING), ("id", ASCENDING)], unique=True)
    db.records.create_index([("workspaceId", ASCENDING), ("kind", ASCENDING), ("updatedAt", DESCENDING)])
    db.records.create_index([("workspaceId", ASCENDING), ("kind", ASCENDING), ("payload.date", DESCENDING)])
    db.records.create_index([("workspaceId", ASCENDING), ("kind", ASCENDING), ("payload.customerId", ASCENDING)])
    _create_index(
        db.records,
        [("workspaceId", ASCENDING), ("kind", ASCENDING), ("payload.supplierId", ASCENDING)],
        name="idx_workspace_kind_supplier",
    )
    db.records.create_index([("workspaceId", ASCENDING), ("kind", ASCENDING), ("payload.sku", ASCENDING)])
    _create_index(
        db.records,
        [("workspaceId", ASCENDING), ("kind", ASCENDING), ("payload.status", ASCENDING)],
        name="idx_workspace_kind_status",
    )
    _create_index(
        db.records,
        [("workspaceId", ASCENDING), ("kind", ASCENDING), ("payload.operationKey", ASCENDING)],
        unique=True,
        name="idx_sync_operation_key",
        partialFilterExpression={"kind": "sync_operations", "payload.operationKey": {"$exists": True}},
    )
    db.records.create_index([("kind", ASCENDING), ("id", ASCENDING)])
    db.records.create_index([("kind", ASCENDING), ("payload.status", ASCENDING)])
    db.records.create_index([("kind", ASCENDING), ("payload.priority", ASCENDING)])
    db.records.create_index([("deletedAt", ASCENDING)])

    db.platform_admins.create_index([("id", ASCENDING)], unique=True)
    db.platform_admins.create_index([("emailNormalized", ASCENDING)], unique=True)
    db.platform_admins.create_index([("role", ASCENDING)])
    db.platform_admins.create_index([("status", ASCENDING)])

    db.platform_feature_flags.create_index([("id", ASCENDING)], unique=True)
    db.platform_feature_flags.create_index([("area", ASCENDING), ("enabled", ASCENDING)])
    db.platform_feature_flags.create_index([("updatedAt", DESCENDING)])

    db.platform_sessions.create_index([("accessTokenHash", ASCENDING)], unique=True)
    db.platform_sessions.create_index([("adminId", ASCENDING)])
    db.platform_sessions.create_index([("expiresAt", ASCENDING)])
    db.platform_sessions.create_index([("revokedAt", ASCENDING)])

    _create_index(db.audit_logs, [("workspaceId", ASCENDING), ("timestamp", DESCENDING)], name="idx_audit_workspace_timestamp")
    _create_index(db.audit_logs, [("actor.id", ASCENDING), ("timestamp", DESCENDING)], name="idx_audit_actor_timestamp")
    _create_index(db.audit_logs, [("action", ASCENDING), ("timestamp", DESCENDING)], name="idx_audit_action_timestamp")
    db.audit_logs.create_index([("module", ASCENDING), ("timestamp", DESCENDING)])
    db.audit_logs.create_index([("success", ASCENDING), ("timestamp", DESCENDING)])


def mongo_counts() -> dict[str, int]:
    db = mongo_db()
    return {
        "workspaces": db.workspaces.count_documents({}),
        "users": db.users.count_documents({}),
        "roles": db.roles.count_documents({}),
        "businesses": db.businesses.count_documents({}),
        "records": db.records.count_documents({}),
        "sessions": db.sessions.count_documents({}),
        "password_reset_tokens": db.password_reset_tokens.count_documents({}),
        "device_tokens": db.device_tokens.count_documents({}),
        "settings": db.settings.count_documents({}),
        "platform_admins": db.platform_admins.count_documents({}),
        "platform_feature_flags": db.platform_feature_flags.count_documents({}),
        "platform_sessions": db.platform_sessions.count_documents({}),
    }
