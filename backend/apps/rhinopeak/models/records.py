from __future__ import annotations

from django.db import models

from .tenant import Workspace


class Business(models.Model):
    id = models.CharField(primary_key=True, max_length=64)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="businesses")
    name = models.CharField(max_length=180)
    category = models.CharField(max_length=120, blank=True, default="")
    address = models.CharField(max_length=240, blank=True, default="")
    created_at = models.DateTimeField()

    class Meta:
        db_table = "rp_businesses"
        indexes = [
            models.Index(fields=["workspace", "created_at"]),
        ]

    def __str__(self) -> str:
        return self.name


class WorkspaceSettings(models.Model):
    workspace = models.OneToOneField(Workspace, primary_key=True, on_delete=models.CASCADE, related_name="settings")
    business_name = models.CharField(max_length=180, blank=True, default="")
    currency = models.CharField(max_length=8, default="NPR")
    fiscal_year_start = models.CharField(max_length=20, default="July")
    compact_tables = models.BooleanField(default=False)
    low_stock_alerts = models.BooleanField(default=True)
    daily_sales_summary = models.BooleanField(default=False)
    new_customer_signup = models.BooleanField(default=False)
    two_factor_enabled = models.BooleanField(default=False)
    scheduled_reports = models.BooleanField(default=False)

    class Meta:
        db_table = "rp_workspace_settings"


from django_mongodb_backend.fields import ObjectIdAutoField

class WorkspaceRecord(models.Model):
    row_id = ObjectIdAutoField(primary_key=True)
    id = models.CharField(max_length=64)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="records")
    kind = models.CharField(max_length=40)
    payload = models.JSONField(default=dict)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    deleted_at = models.CharField(max_length=80, blank=True, null=True)

    class Meta:
        db_table = "rp_workspace_records"
        constraints = [
            models.UniqueConstraint(fields=["workspace", "kind", "id"], name="uniq_workspace_record_kind_id"),
        ]
        indexes = [
            models.Index(fields=["workspace", "kind"]),
            models.Index(fields=["workspace", "kind", "updated_at"]),
            models.Index(fields=["deleted_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.workspace_id}:{self.kind}:{self.id}"
