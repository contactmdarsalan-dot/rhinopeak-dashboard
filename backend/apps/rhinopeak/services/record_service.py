from __future__ import annotations

from typing import Any

from django.db import transaction

from apps.rhinopeak.data.repositories import (
    bootstrap_payload,
    create_audit,
    get_record,
    list_records,
    patch_record,
    put_record,
    today_string,
)
from apps.rhinopeak.domain.errors import AppError
from apps.rhinopeak.domain.security import make_id
from apps.rhinopeak.models import UserAccount
from apps.rhinopeak.services.common import customer_segment, require_permission, sale_total, stock_status


def apply_inventory_delta(user: UserAccount, product_id: str, delta: float) -> dict[str, Any] | None:
    product = get_record(user.workspace, "inventory", product_id)
    if not product:
        return None
    stock = max(0.0, float(product.get("stock", 0)) + float(delta))
    product["stock"] = stock
    product["status"] = stock_status(stock, float(product.get("reorderLevel", 0)))
    return put_record(user.workspace, "inventory", product)


def recalculate_customers(user: UserAccount) -> list[dict[str, Any]]:
    customers = list_records(user.workspace, "customers")
    sales = [
        sale for sale in list_records(user.workspace, "sales")
        if not sale.get("deletedAt") and sale.get("status") == "Completed"
    ]
    for customer in customers:
        customer_sales = [sale for sale in sales if sale.get("customerId") == customer.get("id")]
        if not customer_sales:
            continue
        total_spent = sum(float(sale.get("amount", 0)) for sale in customer_sales)
        orders = len(customer_sales)
        last_order = sorted(str(sale.get("date", "")) for sale in customer_sales)[-1]
        customer.update(
            totalSpent=round(total_spent, 2),
            orders=orders,
            lastOrder=last_order,
            segment=customer_segment(total_spent, orders, last_order),
        )
        put_record(user.workspace, "customers", customer)
    return list_records(user.workspace, "customers")


def ensure_customer_for_sale(user: UserAccount, sale: dict[str, Any]) -> None:
    customer_id = str(sale.get("customerId", "")).strip()
    if not customer_id or get_record(user.workspace, "customers", customer_id):
        return
    put_record(
        user.workspace,
        "customers",
        {
            "id": customer_id,
            "name": sale.get("customer", "Customer"),
            "email": "",
            "phone": "",
            "address": "",
            "notes": "",
            "tags": [],
            "totalSpent": 0,
            "orders": 0,
            "lastOrder": sale.get("date", ""),
            "segment": "Occasional",
            "birthday": "",
        },
    )


def create_customer(user: UserAccount, payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "customers.manage")
    customer = put_record(user.workspace, "customers", payload)
    create_audit(user.workspace, user.name, "Created customer", "Customers", customer.get("name", customer["id"]))
    return {"customer": customer}


def update_customer(user: UserAccount, customer_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "customers.manage")
    customer = patch_record(user.workspace, "customers", customer_id, patch)
    if customer is None:
        raise AppError(404, "Customer not found.")
    create_audit(user.workspace, user.name, "Updated customer", "Customers", customer.get("name", customer_id))
    return {"customer": customer}


def create_product(user: UserAccount, payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "inventory.manage")
    product = dict(payload)
    product["unit"] = str(product.get("unit", "pcs")).strip() or "pcs"
    product["stock"] = float(product.get("stock", 0))
    product["reorderLevel"] = float(product.get("reorderLevel", 0))
    product["status"] = stock_status(product["stock"], product["reorderLevel"])
    product = put_record(user.workspace, "inventory", product)
    create_audit(user.workspace, user.name, "Created product", "Inventory", product.get("name", product["id"]))
    return {"product": product}


@transaction.atomic
def create_sale(user: UserAccount, payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "sales.create")
    sale = dict(payload)
    sale["amount"] = sale_total(sale.get("items", []), sale.get("status", "Completed"))
    ensure_customer_for_sale(user, sale)
    put_record(user.workspace, "sales", sale)
    if sale.get("status") != "Refunded":
        for item in sale.get("items", []):
            quantity = float(item.get("quantity", 0))
            apply_inventory_delta(user, item.get("productId", ""), -quantity)
            put_record(
                user.workspace,
                "inventory_movements",
                {
                    "id": make_id("MOV"),
                    "productId": item.get("productId", ""),
                    "productName": item.get("productName", ""),
                    "delta": -quantity,
                    "reason": "Sale",
                    "note": sale.get("id", ""),
                    "user": user.name,
                    "createdAt": today_string(),
                },
            )
    recalculate_customers(user)
    create_audit(user.workspace, user.name, "Created sale", "Sales", f"{sale.get('id')} recorded.")
    return {"sale": sale, "bootstrap": bootstrap_payload(user)}


@transaction.atomic
def patch_sale(user: UserAccount, sale_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "sales.update")
    old_sale = get_record(user.workspace, "sales", sale_id)
    if not old_sale:
        raise AppError(404, "Sale not found.")
    new_sale = {**old_sale, **patch, "id": sale_id}
    old_applied = old_sale.get("status") != "Refunded" and not old_sale.get("deletedAt")
    new_applied = new_sale.get("status") != "Refunded" and not new_sale.get("deletedAt")
    if old_applied != new_applied:
        direction = 1 if old_applied and not new_applied else -1
        reason = "Return" if direction > 0 else "Sale"
        for item in old_sale.get("items", []):
            delta = direction * float(item.get("quantity", 0))
            apply_inventory_delta(user, item.get("productId", ""), delta)
            put_record(
                user.workspace,
                "inventory_movements",
                {
                    "id": make_id("MOV"),
                    "productId": item.get("productId", ""),
                    "productName": item.get("productName", ""),
                    "delta": delta,
                    "reason": reason,
                    "note": f"{sale_id} status change",
                    "user": user.name,
                    "createdAt": today_string(),
                },
            )
    new_sale["amount"] = sale_total(new_sale.get("items", []), new_sale.get("status", "Completed"))
    sale = put_record(user.workspace, "sales", new_sale)
    recalculate_customers(user)
    create_audit(user.workspace, user.name, "Updated sale", "Sales", sale_id)
    return {"sale": sale}


@transaction.atomic
def delete_sale(user: UserAccount, sale_id: str) -> dict[str, bool]:
    require_permission(user, "sales.delete")
    sale = get_record(user.workspace, "sales", sale_id)
    if not sale:
        raise AppError(404, "Sale not found.")
    if not sale.get("deletedAt") and sale.get("status") != "Refunded":
        for item in sale.get("items", []):
            apply_inventory_delta(user, item.get("productId", ""), float(item.get("quantity", 0)))
    sale["deletedAt"] = today_string()
    sale["auditTrail"] = [f"Soft-deleted by {user.name}", *sale.get("auditTrail", [])]
    put_record(user.workspace, "sales", sale)
    recalculate_customers(user)
    create_audit(user.workspace, user.name, "Soft-deleted sale", "Sales", sale_id)
    return {"ok": True}


@transaction.atomic
def create_movement(user: UserAccount, payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "inventory.manage")
    movement = put_record(user.workspace, "inventory_movements", payload)
    apply_inventory_delta(user, movement.get("productId", ""), float(movement.get("delta", 0)))
    create_audit(user.workspace, user.name, "Recorded stock movement", "Inventory", movement.get("productName", movement["id"]))
    return {"movement": movement, "bootstrap": bootstrap_payload(user)}


def create_report(user: UserAccount, payload: dict[str, Any]) -> dict[str, Any]:
    require_permission(user, "reports.generate")
    report = put_record(user.workspace, "reports", payload)
    create_audit(user.workspace, user.name, "Generated report", "Reports", report.get("title", report["id"]))
    return {"report": report}
