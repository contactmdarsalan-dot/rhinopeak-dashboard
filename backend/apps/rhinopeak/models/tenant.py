from __future__ import annotations

from django.db import models


class Workspace(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    name = models.CharField(max_length=180)
    category = models.CharField(max_length=120, blank=True, default="")
    address = models.CharField(max_length=240, blank=True, default="")
    plan = models.CharField(max_length=20, default="free")
    billing_cycle = models.CharField(max_length=20, default="monthly")
    status = models.CharField(max_length=32, default="Trial")
    trial_ends_at = models.DateField()
    created_at = models.DateTimeField()

    class Meta:
        db_table = "rp_workspaces"
        indexes = [
            models.Index(fields=["plan"]),
            models.Index(fields=["status"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self) -> str:
        return self.name


class WorkspaceRole(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="roles")
    name = models.CharField(max_length=80)
    description = models.TextField(blank=True, default="")
    system_role = models.BooleanField(default=False)
    permissions = models.JSONField(default=list)
    created_at = models.DateTimeField()

    class Meta:
        db_table = "rp_workspace_roles"
        constraints = [
            models.UniqueConstraint(fields=["workspace", "name"], name="uniq_workspace_role_name"),
        ]
        indexes = [
            models.Index(fields=["workspace", "system_role"]),
        ]

    def __str__(self) -> str:
        return f"{self.workspace_id}:{self.name}"

