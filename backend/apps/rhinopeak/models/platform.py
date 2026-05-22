from __future__ import annotations

from django.db import models


class PlatformAdmin(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    name = models.CharField(max_length=160)
    email = models.EmailField(unique=True)
    email_normalized = models.EmailField(unique=True)
    role = models.CharField(max_length=40, default="Super Admin")
    status = models.CharField(max_length=24, default="Active")
    last_active = models.CharField(max_length=80)
    password_salt = models.CharField(max_length=128)
    password_hash = models.CharField(max_length=256)
    created_by = models.EmailField(blank=True, default="")
    created_at = models.DateTimeField()

    class Meta:
        db_table = "rp_platform_admins"
        indexes = [
            models.Index(fields=["role"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return self.email


class PlatformSession(models.Model):
    access_token_hash = models.CharField(primary_key=True, max_length=128)
    admin = models.ForeignKey(PlatformAdmin, on_delete=models.CASCADE, related_name="sessions")
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "rp_platform_sessions"
        indexes = [
            models.Index(fields=["expires_at"]),
            models.Index(fields=["revoked_at"]),
        ]
