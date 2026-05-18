from __future__ import annotations

from django.db import models

from .tenant import Workspace, WorkspaceRole


class UserAccount(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="users")
    role_record = models.ForeignKey(WorkspaceRole, null=True, blank=True, on_delete=models.SET_NULL, related_name="users")
    name = models.CharField(max_length=160)
    email = models.EmailField(unique=True)
    email_normalized = models.EmailField(unique=True)
    role = models.CharField(max_length=80)
    status = models.CharField(max_length=24, default="Active")
    last_active = models.CharField(max_length=80)
    password_salt = models.CharField(max_length=128)
    password_hash = models.CharField(max_length=256)
    created_at = models.DateTimeField()

    class Meta:
        db_table = "rp_users"
        indexes = [
            models.Index(fields=["workspace", "role"]),
            models.Index(fields=["email_normalized"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return self.email


class SessionToken(models.Model):
    access_token_hash = models.CharField(primary_key=True, max_length=128)
    refresh_token_hash = models.CharField(unique=True, max_length=128)
    user = models.ForeignKey(UserAccount, on_delete=models.CASCADE, related_name="sessions")
    expires_at = models.DateTimeField()
    refresh_expires_at = models.DateTimeField()
    created_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "rp_sessions"
        indexes = [
            models.Index(fields=["expires_at"]),
            models.Index(fields=["revoked_at"]),
        ]


class PasswordResetToken(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    user = models.ForeignKey(UserAccount, on_delete=models.CASCADE, related_name="password_resets")
    token_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField()

    class Meta:
        db_table = "rp_password_reset_tokens"
        indexes = [
            models.Index(fields=["user", "token_hash", "used_at"]),
            models.Index(fields=["expires_at"]),
        ]

