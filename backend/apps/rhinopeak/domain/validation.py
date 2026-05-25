"""
Request validation schemas using Pydantic.

This module provides runtime validation for API request payloads,
preventing malformed data from reaching the application logic.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Authentication Schemas ───────────────────────────────────────────────────

class LoginRequest(BaseModel):
    """Schema for user login request."""
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class RegisterRequest(BaseModel):
    """Schema for user registration request."""
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    businessName: str = Field(..., min_length=1, max_length=200)

    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        """Validate password meets minimum security requirements."""
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v


class RefreshRequest(BaseModel):
    """Schema for session refresh request."""
    refreshToken: str = Field(..., min_length=1)


class PasswordResetRequest(BaseModel):
    """Schema for password reset request."""
    email: EmailStr


class PasswordResetConfirmRequest(BaseModel):
    """Schema for password reset confirmation."""
    email: EmailStr
    token: str = Field(..., min_length=1)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        """Validate password meets minimum security requirements."""
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v


class LogoutRequest(BaseModel):
    """Schema for logout request."""
    refreshToken: str | None = None


# ── Sale Schemas ────────────────────────────────────────────────────────────

class SaleRequest(BaseModel):
    """Schema for creating/updating a sale."""
    id: str | None = None
    partyId: str | None = None
    date: str
    items: list[dict[str, Any]] = Field(..., min_length=1)
    total: float = Field(..., ge=0)
    tax: float | None = Field(default=0, ge=0)
    discount: float | None = Field(default=0, ge=0)
    paymentMethod: str | None = None
    notes: str | None = None


class SalePatchRequest(BaseModel):
    """Schema for patching a sale."""
    partyId: str | None = None
    date: str | None = None
    items: list[dict[str, Any]] | None = None
    total: float | None = Field(default=None, ge=0)
    tax: float | None = Field(default=None, ge=0)
    discount: float | None = Field(default=None, ge=0)
    paymentMethod: str | None = None
    notes: str | None = None
    deletedAt: str | None = None


# ── Party Schemas ───────────────────────────────────────────────────────────

class PartyRequest(BaseModel):
    """Schema for creating/updating a party (customer/supplier)."""
    id: str | None = None
    name: str = Field(..., min_length=1, max_length=200)
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    type: str = Field(...)  # 'Customer' or 'Supplier'
    balance: float | None = Field(default=0)
    creditLimit: float | None = Field(default=None, ge=0)
    notes: str | None = None


class PartyPatchRequest(BaseModel):
    """Schema for patching a party."""
    name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    balance: float | None = Field(default=None, ge=0)
    creditLimit: float | None = Field(default=None, ge=0)
    notes: str | None = None


# ── Purchase Schemas ────────────────────────────────────────────────────────

class PurchaseRequest(BaseModel):
    """Schema for creating/updating a purchase."""
    id: str | None = None
    partyId: str | None = None
    date: str
    items: list[dict[str, Any]] = Field(..., min_length=1)
    total: float = Field(..., ge=0)
    tax: float | None = Field(default=0, ge=0)
    discount: float | None = Field(default=0, ge=0)
    paymentMethod: str | None = None
    notes: str | None = None


class PurchasePatchRequest(BaseModel):
    """Schema for patching a purchase."""
    partyId: str | None = None
    date: str | None = None
    items: list[dict[str, Any]] | None = None
    total: float | None = Field(default=None, ge=0)
    tax: float | None = Field(default=None, ge=0)
    discount: float | None = Field(default=None, ge=0)
    paymentMethod: str | None = None
    notes: str | None = None
    deletedAt: str | None = None


# ── Expense Schemas ─────────────────────────────────────────────────────────

class ExpenseRequest(BaseModel):
    """Schema for creating/updating an expense."""
    id: str | None = None
    date: str
    category: str = Field(..., min_length=1)
    amount: float = Field(..., ge=0)
    description: str | None = None
    paymentMethod: str | None = None
    receipt: str | None = None
    notes: str | None = None


class ExpensePatchRequest(BaseModel):
    """Schema for patching an expense."""
    date: str | None = None
    category: str | None = Field(default=None, min_length=1)
    amount: float | None = Field(default=None, ge=0)
    description: str | None = None
    paymentMethod: str | None = None
    receipt: str | None = None
    notes: str | None = None
    deletedAt: str | None = None


# ── Inventory Schemas ───────────────────────────────────────────────────────

class InventoryProductRequest(BaseModel):
    """Schema for creating/updating an inventory product."""
    id: str | None = None
    name: str = Field(..., min_length=1, max_length=200)
    sku: str | None = None
    category: str | None = None
    unit: str = Field(default="piece")
    purchasePrice: float | None = Field(default=None, ge=0)
    salePrice: float = Field(..., ge=0)
    currentStock: float = Field(default=0, ge=0)
    lowStockThreshold: float | None = Field(default=None, ge=0)
    description: str | None = None


class InventoryPatchRequest(BaseModel):
    """Schema for patching an inventory product."""
    name: str | None = Field(default=None, min_length=1, max_length=200)
    sku: str | None = None
    category: str | None = None
    unit: str | None = None
    purchasePrice: float | None = Field(default=None, ge=0)
    salePrice: float | None = Field(default=None, ge=0)
    currentStock: float | None = Field(default=None, ge=0)
    lowStockThreshold: float | None = Field(default=None, ge=0)
    description: str | None = None
    deletedAt: str | None = None


# ── Payment Schemas ────────────────────────────────────────────────────────

class PaymentInitiateRequest(BaseModel):
    """Schema for initiating a payment."""
    gateway: str = Field(..., pattern="^(esewa|khalti)$")
    amount: float = Field(..., gt=0)
    plan: str = Field(default="pro")
    billingCycle: str = Field(default="monthly", pattern="^(monthly|annual)$")


class KhaltiVerifyRequest(BaseModel):
    """Schema for Khalti payment verification."""
    pidx: str = Field(..., min_length=1)
    amount: int | None = Field(default=None, gt=0)
    transactionUuid: str | None = None


# ── Pagination Schemas ──────────────────────────────────────────────────────

class PaginationParams(BaseModel):
    """Schema for pagination parameters."""
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=50, ge=1, le=200)
    sort_by: str | None = Field(default="created_at")
    sort_order: str = Field(default="desc", pattern="^(asc|desc)$")


class PaginatedResponse(BaseModel):
    """Schema for paginated API responses."""
    data: list[Any]
    pagination: dict[str, Any]


# ── Validation Helper ────────────────────────────────────────────────────────

def validate_request(schema_class: type[BaseModel], data: dict[str, Any]) -> BaseModel:
    """Validate request data against a Pydantic schema.

    Raises AppError with status 400 if validation fails.
    """
    from apps.rhinopeak.domain.errors import AppError

    try:
        return schema_class(**data)
    except Exception as e:
        errors = e.errors() if hasattr(e, 'errors') else [{"msg": str(e)}]
        error_messages = [err.get('msg', str(err)) for err in errors]
        raise AppError(400, f"Validation error: {'; '.join(error_messages)}")
