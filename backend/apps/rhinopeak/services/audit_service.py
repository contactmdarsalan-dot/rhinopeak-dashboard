from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from django.conf import settings

from apps.rhinopeak.data.mongo import collection, strip_mongo_id

logger = logging.getLogger(__name__)


class AuditSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AuditLogger:
    """Persist structured audit events without blocking business workflows."""

    def __init__(self) -> None:
        self.enabled = bool(getattr(settings, "ENABLE_AUDIT_LOGGING", True))

    def log(
        self,
        *,
        action: str,
        actor_id: str,
        actor_email: str | None = None,
        workspace_id: str | None = None,
        module: str = "general",
        detail: str = "",
        metadata: dict[str, Any] | None = None,
        severity: AuditSeverity | str = AuditSeverity.INFO,
        success: bool = True,
        ip_address: str | None = None,
        user_agent: str | None = None,
        request_id: str | None = None,
        old_values: dict[str, Any] | None = None,
        new_values: dict[str, Any] | None = None,
        error_message: str | None = None,
    ) -> str:
        audit_id = str(uuid.uuid4())
        if not self.enabled:
            return audit_id

        timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
        severity_value = severity.value if isinstance(severity, AuditSeverity) else str(severity)
        event = {
            "id": audit_id,
            "timestamp": timestamp,
            "workspaceId": workspace_id,
            "action": str(action),
            "module": module,
            "detail": detail,
            "actor": {
                "id": actor_id,
                "email": actor_email or actor_id,
            },
            "metadata": metadata or {},
            "severity": severity_value,
            "success": success,
            "ipAddress": ip_address,
            "userAgent": user_agent,
            "requestId": request_id,
            "changes": {
                "old": old_values,
                "new": new_values,
            } if old_values is not None or new_values is not None else None,
            "errorMessage": error_message,
            "environment": getattr(settings, "ENVIRONMENT", "development"),
        }

        logger.info(
            "AUDIT %s",
            event["action"],
            extra={
                "audit_id": audit_id,
                "workspace_id": workspace_id,
                "actor_id": actor_id,
                "module": module,
                "success": success,
                "severity": severity_value,
            },
        )

        try:
            collection("audit_logs").insert_one(event)
        except Exception as exc:
            logger.warning("Failed to persist structured audit event: %s", exc)

        self._publish_recent_event(event)
        return audit_id

    def _publish_recent_event(self, event: dict[str, Any]) -> None:
        if not getattr(settings, "REDIS_ENABLED", False):
            return
        try:
            import json
            import redis

            client = redis.from_url(settings.REDIS_URL, socket_connect_timeout=1)
            key = f"audit:recent:{event.get('workspaceId') or 'platform'}"
            encoded = json.dumps(event, default=str)
            client.lpush(key, encoded)
            client.ltrim(key, 0, 499)
            client.expire(key, 86_400)
        except Exception as exc:
            logger.debug("Audit Redis publish skipped: %s", exc)

    def trail(
        self,
        *,
        workspace_id: str,
        limit: int = 100,
        module: str | None = None,
        action: str | None = None,
    ) -> list[dict[str, Any]]:
        query: dict[str, Any] = {"workspaceId": workspace_id}
        if module:
            query["module"] = module
        if action:
            query["action"] = action
        rows = collection("audit_logs").find(query).sort("timestamp", -1).limit(max(1, min(limit, 500)))
        return [strip_mongo_id(row) or {} for row in rows]


audit_logger = AuditLogger()


def create_structured_audit(
    workspace_id: str | None,
    user_name: str,
    action: str,
    module: str,
    detail: str,
    **metadata: Any,
) -> str:
    return audit_logger.log(
        action=action,
        actor_id=user_name,
        actor_email=user_name,
        workspace_id=workspace_id,
        module=module,
        detail=detail,
        metadata=metadata or None,
    )
