from __future__ import annotations

import re
from typing import Any

from apps.rhinopeak.domain.errors import AppError
from apps.rhinopeak.domain.security import make_id
from apps.rhinopeak.services.mongo_service import (
    bootstrap_payload,
    create_audit,
    create_customer,
    create_expense,
    create_product,
    create_report,
    create_supplier,
    iso_now,
    list_records,
    today_string,
)


NEPALI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")

INTENT_ROUTES = {
    "scan_bill": "/scan-bill",
    "add_expense": "/expenses",
    "add_customer": "/customers",
    "add_supplier": "/suppliers",
    "add_product": "/inventory",
    "stock_movement": "/inventory",
    "record_sale": "/sales",
    "record_payment": "/parties",
    "create_report": "/reports",
    "open_dashboard": "/dashboard",
    "open_analytics": "/analytics",
    "business_question": "/dashboard",
    "unknown": "/dashboard",
}

SAFE_EXECUTION_INTENTS = {"add_expense", "add_customer", "add_supplier", "add_product", "create_report"}

PAYMENT_ALIASES = {
    "cash": "Cash",
    "नगद": "Cash",
    "bank": "Bank",
    "बैंक": "Bank",
    "card": "Card",
    "esewa": "eSewa",
    "e-sewa": "eSewa",
    "khalti": "Khalti",
    "fonepay": "FonePay",
    "fone pay": "FonePay",
    "credit": "Credit",
    "उधार": "Credit",
}

EXPENSE_CATEGORIES = {
    "rent": "Rent",
    "भाडा": "Rent",
    "salary": "Salary",
    "तलब": "Salary",
    "transport": "Transport",
    "ढुवानी": "Transport",
    "marketing": "Marketing",
    "advertising": "Marketing",
    "utility": "Utilities",
    "electricity": "Utilities",
    "बिजुली": "Utilities",
    "repair": "Repair",
    "मर्मत": "Repair",
}


QUESTION_WORDS = [
    "what",
    "how much",
    "how many",
    "show",
    "tell",
    "total",
    "summary",
    "status",
    "balance",
    "mero",
    "miro",
    "kati",
    "kati ho",
    "kati thiyo",
    "kothiyo",
    "katiyo",
    "bhayo",
]

BUSINESS_METRIC_WORDS = [
    "sale",
    "sales",
    "revenue",
    "income",
    "expense",
    "expenses",
    "purchase",
    "purchases",
    "cash",
    "bank",
    "wallet",
    "profit",
    "loss",
    "customer",
    "customers",
    "supplier",
    "suppliers",
    "inventory",
    "stock",
    "credit",
    "receivable",
    "payable",
    "udhar",
    "kharcha",
    "kharach",
    "bikri",
    "tirnu",
    "tirna",
    "saman",
    "grahak",
]

QUESTION_ROUTES = {
    "sales_total": "/sales",
    "expenses_total": "/expenses",
    "purchases_total": "/purchases",
    "cash_balance": "/cash-bank",
    "inventory_status": "/inventory",
    "customer_receivable": "/parties",
    "supplier_payable": "/parties",
    "profit_estimate": "/analytics",
    "customer_status": "/customers",
    "supplier_status": "/suppliers",
    "business_summary": "/dashboard",
}


def handle_assistant_command(user: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    command = parse_assistant_command(payload, user=user)
    create_audit(
        user["workspaceId"],
        user["name"],
        "Parsed assistant command",
        "AI Assistant",
        f"{command['intent']}: {command['transcript'][:140]}",
    )

    if command["intent"] == "business_question":
        return {"assistantCommand": command}

    if bool(payload.get("confirm")):
        command = execute_assistant_command(user, command, payload.get("overrides"))
        return {"assistantCommand": command, "bootstrap": bootstrap_payload(user)}

    return {"assistantCommand": command}


def parse_assistant_command(payload: dict[str, Any], user: dict[str, Any] | None = None) -> dict[str, Any]:
    transcript = str(payload.get("transcript") or payload.get("command") or payload.get("text") or "").strip()
    if not transcript:
        raise AppError(400, "Say or type a command first.")

    detected_language = detect_language(transcript)
    language = detected_language if detected_language == "ne" else str(payload.get("language") or detected_language)
    normalized = normalize_command(transcript)
    intent = detect_intent(normalized)
    if intent == "business_question":
        return business_question_command(transcript, normalized, language, user)

    slots = extract_slots(intent, transcript, normalized)
    warnings = validation_warnings(intent, slots)
    confidence = confidence_for(intent, slots, warnings)
    can_execute = intent in SAFE_EXECUTION_INTENTS and not warnings

    return {
        "id": make_id("ASST"),
        "transcript": transcript,
        "normalizedTranscript": normalized,
        "language": language,
        "intent": intent,
        "confidence": confidence,
        "requiresConfirmation": True,
        "canExecute": can_execute,
        "route": INTENT_ROUTES.get(intent, "/dashboard"),
        "slots": slots,
        "warnings": warnings,
        "reply": assistant_reply(intent, slots, warnings, can_execute),
        "safety": {
            "autoExecute": False,
            "reason": "Voice commands must be reviewed and confirmed before writing business data.",
        },
        "executionStatus": "Draft",
        "createdAt": iso_now(),
    }


def business_question_command(
    transcript: str,
    normalized: str,
    language: str,
    user: dict[str, Any] | None,
) -> dict[str, Any]:
    question_type = classify_business_question(normalized)
    scope = question_scope(normalized)
    if user:
        answer = answer_business_question(user, question_type, scope, normalized)
        reply = answer["reply"]
        slots = answer["slots"]
        route = answer["route"]
        confidence = answer["confidence"]
    else:
        slots = {
            "questionType": question_type,
            "scope": scope,
            "answerSource": "saved_workspace_records",
        }
        reply = "I can answer this from saved workspace records after the user is logged in."
        route = QUESTION_ROUTES.get(question_type, "/dashboard")
        confidence = 0.88

    return {
        "id": make_id("ASST"),
        "transcript": transcript,
        "normalizedTranscript": normalized,
        "language": language,
        "intent": "business_question",
        "confidence": confidence,
        "requiresConfirmation": False,
        "canExecute": False,
        "route": route,
        "slots": slots,
        "warnings": [],
        "reply": reply,
        "safety": {
            "autoExecute": False,
            "reason": "Business answers are read-only and calculated from saved workspace records.",
        },
        "executionStatus": "Answered",
        "createdAt": iso_now(),
    }


def answer_business_question(
    user: dict[str, Any],
    question_type: str,
    scope: str,
    normalized: str,
) -> dict[str, Any]:
    workspace_id = user["workspaceId"]
    sales = filter_by_scope(active_sales(list_records(workspace_id, "sales")), scope)
    expenses = filter_by_scope(active_money_records(list_records(workspace_id, "expenses")), scope)
    purchases = filter_by_scope(active_money_records(list_records(workspace_id, "purchases")), scope)
    accounts = [account for account in active_money_records(list_records(workspace_id, "cash_bank_accounts")) if account.get("active", True)]
    inventory = [item for item in active_money_records(list_records(workspace_id, "inventory")) if item.get("active", True)]
    customers = active_money_records(list_records(workspace_id, "customers"))
    suppliers = active_money_records(list_records(workspace_id, "suppliers"))
    parties = active_money_records(list_records(workspace_id, "parties"))

    sales_total = sum_money(sales)
    expenses_total = sum_money(expenses)
    purchases_total = sum_money(purchases)
    cash_total = sum_money(accounts, "balance")
    cash_drawer_total = sum_money([item for item in accounts if "cash" in str(item.get("type", "")).lower()], "balance")
    bank_wallet_total = round(cash_total - cash_drawer_total, 2)
    receivable_total = receivable_balance(customers, parties)
    payable_total = payable_balance(suppliers, parties)
    product_count = len(inventory)
    stock_units = round(sum(to_float(item.get("stock")) for item in inventory), 2)
    low_stock_count = len(
        [
            item
            for item in inventory
            if to_float(item.get("stock")) <= to_float(item.get("reorderLevel")) and to_float(item.get("stock")) > 0
        ]
    )
    out_of_stock_count = len([item for item in inventory if to_float(item.get("stock")) <= 0])
    stock_value = round(
        sum(to_float(item.get("stock")) * (to_float(item.get("costPrice")) or to_float(item.get("price"))) for item in inventory),
        2,
    )
    gross_profit = round(sales_gross_profit(sales), 2)
    operating_result = round(gross_profit - expenses_total, 2)

    slots = {
        "questionType": question_type,
        "scope": scope,
        "answerSource": "saved_workspace_records",
        "salesTotal": sales_total,
        "salesCount": len(sales),
        "expensesTotal": expenses_total,
        "expenseCount": len(expenses),
        "purchasesTotal": purchases_total,
        "purchaseCount": len(purchases),
        "cashBankBalance": cash_total,
        "customerReceivable": receivable_total,
        "supplierPayable": payable_total,
        "inventoryProducts": product_count,
        "inventoryUnits": stock_units,
        "lowStockItems": low_stock_count,
        "outOfStockItems": out_of_stock_count,
        "stockValue": stock_value,
        "grossProfit": gross_profit,
        "operatingResult": operating_result,
    }

    subject = scope_subject(scope)
    subject_lower = scope_subject(scope, lower=True)
    if question_type == "sales_total":
        reply = f"{subject} sales total is {format_money(sales_total)} from {len(sales)} bill{plural(len(sales))}."
    elif question_type == "expenses_total":
        reply = f"{subject} expenses total is {format_money(expenses_total)} from {len(expenses)} record{plural(len(expenses))}."
    elif question_type == "purchases_total":
        reply = f"{subject} purchases total is {format_money(purchases_total)} from {len(purchases)} bill{plural(len(purchases))}."
    elif question_type == "cash_balance":
        reply = (
            f"Current cash and bank balance is {format_money(cash_total)}. "
            f"Cash drawer: {format_money(cash_drawer_total)}. Bank and wallet: {format_money(bank_wallet_total)}."
        )
    elif question_type == "customer_receivable":
        reply = f"Customer receivable is {format_money(receivable_total)} from saved customer and party ledger balances."
    elif question_type == "supplier_payable":
        reply = f"Supplier payable is {format_money(payable_total)} from saved supplier and party ledger balances."
    elif question_type == "inventory_status":
        reply = (
            f"Inventory has {product_count} active product{plural(product_count)} and {stock_units:g} total units. "
            f"Low stock: {low_stock_count}. Out of stock: {out_of_stock_count}. Stock value: {format_money(stock_value)}."
        )
    elif question_type == "profit_estimate":
        reply = (
            f"{subject} estimated operating result is {format_money(operating_result)}. "
            f"It uses saved sales item costs minus {subject_lower} expenses, before manual journal adjustments."
        )
    elif question_type == "customer_status":
        top_customer = top_named_record(customers, "totalSpent")
        reply = (
            f"You have {len(customers)} customer{plural(len(customers))}. "
            f"Customer receivable is {format_money(receivable_total)}."
        )
        if top_customer:
            reply += f" Top customer by LTV is {top_customer.get('name', 'Unknown')} at {format_money(to_float(top_customer.get('totalSpent')))}."
    elif question_type == "supplier_status":
        reply = f"You have {len(suppliers)} supplier{plural(len(suppliers))}. Supplier payable is {format_money(payable_total)}."
    else:
        reply = (
            f"Business snapshot: sales {format_money(sales_total)}, purchases {format_money(purchases_total)}, "
            f"expenses {format_money(expenses_total)}, cash/bank {format_money(cash_total)}, "
            f"customer receivable {format_money(receivable_total)}, supplier payable {format_money(payable_total)}."
        )

    return {
        "reply": reply,
        "slots": slots,
        "route": QUESTION_ROUTES.get(question_type, "/dashboard"),
        "confidence": 0.97 if question_type != "business_summary" or has_any(normalized, ["summary", "status"]) else 0.92,
    }


def execute_assistant_command(user: dict[str, Any], command: dict[str, Any], overrides: Any = None) -> dict[str, Any]:
    intent = str(command.get("intent", "unknown"))
    slots = {**command.get("slots", {})}
    if isinstance(overrides, dict):
        slots.update({key: value for key, value in overrides.items() if value is not None})

    warnings = validation_warnings(intent, slots)
    if intent not in SAFE_EXECUTION_INTENTS:
        raise AppError(400, "This assistant command opens a screen only. Please complete it manually.")
    if warnings:
        raise AppError(400, "Please fix the assistant draft before confirming: " + "; ".join(warnings))

    if intent == "add_expense":
        result = create_expense(
            user,
            {
                "category": slots.get("category", "General"),
                "vendor": slots.get("vendor", "Voice entry"),
                "amount": slots["amount"],
                "taxAmount": slots.get("taxAmount", 0),
                "paymentAccountId": "",
                "paymentMethod": slots.get("paymentMethod", "Cash"),
                "date": slots.get("date", today_string()),
                "recurring": False,
                "note": f"Created from assistant command: {command.get('transcript', '')}",
            },
        )
    elif intent == "add_customer":
        result = create_customer(
            user,
            {
                "name": slots["name"],
                "phone": slots.get("phone", ""),
                "email": "",
                "address": "",
                "notes": "Created from assistant command.",
                "tags": ["Voice"],
            },
        )
    elif intent == "add_supplier":
        result = create_supplier(
            user,
            {
                "name": slots["name"],
                "phone": slots.get("phone", ""),
                "email": "",
                "address": "",
                "pan": "",
                "contactPerson": "",
                "payableBalance": 0,
                "notes": "Created from assistant command.",
            },
        )
    elif intent == "add_product":
        result = create_product(
            user,
            {
                "name": slots["name"],
                "category": slots.get("category", "General"),
                "unit": slots.get("unit", "pcs"),
                "stock": slots.get("stock", 0),
                "reorderLevel": 0,
                "price": slots.get("price", 0),
                "costPrice": slots.get("costPrice", 0),
                "supplier": slots.get("supplier", ""),
            },
        )
    else:
        result = create_report(
            user,
            {
                "title": slots.get("title", "Assistant summary report"),
                "type": "Assistant",
                "template": "Executive",
                "range": slots.get("range", "This month"),
                "status": "Ready",
                "format": "HTML",
                "downloadUrl": "",
                "scheduledAt": "",
            },
        )

    command["slots"] = slots
    command["warnings"] = []
    command["canExecute"] = True
    command["executionStatus"] = "Executed"
    command["executedAt"] = iso_now()
    command["result"] = result
    command["reply"] = executed_reply(intent, slots)
    create_audit(user["workspaceId"], user["name"], "Executed assistant command", "AI Assistant", command["id"])
    return command


def normalize_command(text: str) -> str:
    text = text.translate(NEPALI_DIGITS).lower()
    text = re.sub(r"[^\w\s.\-:/\u0900-\u097f]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def detect_language(text: str) -> str:
    roman_nepali_markers = ["mero", "miro", "kati", "kothiyo", "bhayo", "cha", "chha", "udhar", "kharcha", "bikri"]
    normalized = normalize_command(text)
    return "ne" if re.search(r"[\u0900-\u097f]", text) or has_any(normalized, roman_nepali_markers) else "en"


def detect_intent(text: str) -> str:
    if (
        has_any(text, ["scan bill", "scan invoice", "read bill", "read receipt", "bill scan", "बिल स्क्यान", "रसिद स्क्यान", "बिल पढ"])
        or (has_any(text, ["scan", "read", "capture", "photo"]) and has_any(text, ["bill", "invoice", "receipt", "vat"]))
    ):
        return "scan_bill"
    if is_business_question(text):
        return "business_question"
    if has_any(text, ["add customer", "new customer", "create customer", "customer add", "ग्राहक थप", "नयाँ ग्राहक"]):
        return "add_customer"
    if has_any(text, ["add supplier", "new supplier", "create supplier", "supplier add", "सप्लायर थप", "आपूर्तिकर्ता थप"]):
        return "add_supplier"
    if has_any(text, ["add product", "new product", "create product", "product add", "item add", "सामान थप", "प्रोडक्ट थप"]):
        return "add_product"
    if has_any(text, ["add stock", "stock in", "stock update", "inventory update", "स्टक थप", "स्टक मिलाउ"]):
        return "stock_movement"
    if has_any(text, ["record sale", "add sale", "new sale", "sold", "sale entry", "बिक्री", "बेचे", "बेचियो"]):
        return "record_sale"
    if has_any(text, ["payment received", "clear credit", "credit paid", "उधार तिर", "भुक्तानी आयो"]):
        return "record_payment"
    if has_any(text, ["expense", "spent", "paid", "खर्च", "तिरे", "भुक्तानी गरे"]):
        return "add_expense"
    if has_any(text, ["report", "download report", "summary", "रिपोर्ट", "सारांश"]):
        return "create_report"
    if has_any(text, ["analytics", "profit", "revenue", "विश्लेषण", "नाफा"]):
        return "open_analytics"
    if has_any(text, ["dashboard", "home", "ड्यासबोर्ड", "घर"]):
        return "open_dashboard"
    return "unknown"


def is_business_question(text: str) -> bool:
    if not has_any(text, BUSINESS_METRIC_WORDS):
        return False
    if has_any(text, QUESTION_WORDS):
        return True
    return has_any(
        text,
        [
            "today sales",
            "total sale",
            "total sales",
            "sales total",
            "cash balance",
            "bank balance",
            "supplier payable",
            "customer receivable",
            "credit due",
            "low stock",
            "out of stock",
            "stock value",
            "inventory value",
            "total expense",
            "total expenses",
            "expense total",
            "total purchase",
            "total purchases",
            "purchase total",
            "business summary",
            "profit",
            "loss",
        ],
    )


def classify_business_question(text: str) -> str:
    if has_any(text, ["profit", "loss", "margin", "net", "earning"]):
        return "profit_estimate"
    if has_any(text, ["receivable", "customer credit", "credit due", "customer balance", "udhar", "grahak"]):
        return "customer_receivable"
    if has_any(text, ["payable", "supplier payable", "supplier balance", "tirnu", "tirna"]):
        return "supplier_payable"
    if has_any(text, ["cash", "bank", "wallet", "cash drawer", "balance"]):
        return "cash_balance"
    if has_any(text, ["stock", "inventory", "saman", "low stock", "out of stock"]):
        return "inventory_status"
    if has_any(text, ["purchase", "purchases", "supplier bill", "stock came"]):
        return "purchases_total"
    if has_any(text, ["expense", "expenses", "kharcha", "kharach", "spent"]):
        return "expenses_total"
    if has_any(text, ["sale", "sales", "revenue", "income", "bikri"]):
        return "sales_total"
    if has_any(text, ["customer", "customers"]):
        return "customer_status"
    if has_any(text, ["supplier", "suppliers"]):
        return "supplier_status"
    return "business_summary"


def question_scope(text: str) -> str:
    if has_any(text, ["today", "aaja", "daily"]):
        return "today"
    if has_any(text, ["this month", "month", "monthly", "mahina"]):
        return "this_month"
    if has_any(text, ["this year", "year", "yearly", "barsa"]):
        return "this_year"
    return "all_time"


def scope_subject(scope: str, lower: bool = False) -> str:
    labels = {
        "today": "today's",
        "this_month": "this month's",
        "this_year": "this year's",
        "all_time": "total",
    }
    label = labels.get(scope, "total")
    return label if lower else label.capitalize()


def active_sales(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    excluded = {"refunded", "cancelled", "canceled", "void", "draft", "deleted"}
    return [
        record
        for record in records
        if not record.get("deletedAt") and str(record.get("status", "Completed")).strip().lower() not in excluded
    ]


def active_money_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    excluded = {"cancelled", "canceled", "void", "deleted"}
    return [
        record
        for record in records
        if not record.get("deletedAt") and str(record.get("status", "")).strip().lower() not in excluded
    ]


def filter_by_scope(records: list[dict[str, Any]], scope: str) -> list[dict[str, Any]]:
    if scope == "all_time":
        return records
    today = today_string()
    if scope == "today":
        return [record for record in records if record_date(record) == today]
    if scope == "this_month":
        return [record for record in records if record_date(record).startswith(today[:7])]
    if scope == "this_year":
        return [record for record in records if record_date(record).startswith(today[:4])]
    return records


def record_date(record: dict[str, Any]) -> str:
    value = str(record.get("date") or record.get("createdAt") or "")
    return value[:10]


def sum_money(records: list[dict[str, Any]], field: str = "amount") -> float:
    return round(sum(to_float(record.get(field)) for record in records), 2)


def receivable_balance(customers: list[dict[str, Any]], parties: list[dict[str, Any]]) -> float:
    balances: dict[str, float] = {}
    for customer in customers:
        merge_balance(balances, customer, to_float(customer.get("balance")))
    for party in parties:
        party_type = str(party.get("type", "")).lower()
        if party_type in {"customer", "both"}:
            merge_balance(balances, party, to_float(party.get("balance")))
    return round(sum(max(0.0, value) for value in balances.values()), 2)


def payable_balance(suppliers: list[dict[str, Any]], parties: list[dict[str, Any]]) -> float:
    balances: dict[str, float] = {}
    for supplier in suppliers:
        merge_balance(balances, supplier, to_float(supplier.get("payableBalance")))
    for party in parties:
        party_type = str(party.get("type", "")).lower()
        if party_type in {"supplier", "both"}:
            merge_balance(balances, party, to_float(party.get("balance")))
    return round(sum(max(0.0, value) for value in balances.values()), 2)


def merge_balance(balances: dict[str, float], record: dict[str, Any], value: float) -> None:
    key = entity_key(record)
    balances[key] = max(balances.get(key, 0.0), value)


def entity_key(record: dict[str, Any]) -> str:
    identity = " ".join(
        [
            str(record.get("name") or record.get("partyName") or record.get("customerName") or record.get("supplierName") or ""),
            str(record.get("phone") or ""),
        ]
    )
    key = re.sub(r"[^a-z0-9]+", "", identity.lower())
    return key or str(record.get("id") or make_id("ROW"))


def sales_gross_profit(sales: list[dict[str, Any]]) -> float:
    total = 0.0
    for sale in sales:
        items = sale.get("items") if isinstance(sale.get("items"), list) else []
        if not items:
            total += to_float(sale.get("amount")) - to_float(sale.get("taxTotal") or sale.get("vatAmount"))
            continue
        for item in items:
            quantity = to_float(item.get("quantity"))
            revenue = quantity * to_float(item.get("unitPrice")) - to_float(item.get("discount"))
            cost = quantity * to_float(item.get("costPrice"))
            total += revenue - cost
    return round(total, 2)


def top_named_record(records: list[dict[str, Any]], field: str) -> dict[str, Any] | None:
    if not records:
        return None
    return max(records, key=lambda record: to_float(record.get(field)))


def to_float(value: Any) -> float:
    try:
        if value in (None, ""):
            return 0.0
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return 0.0


def format_money(amount: float) -> str:
    amount = round(float(amount), 2)
    if amount.is_integer():
        return f"NPR {amount:,.0f}"
    return f"NPR {amount:,.2f}"


def plural(count: int) -> str:
    return "" if count == 1 else "s"


def extract_slots(intent: str, transcript: str, normalized: str) -> dict[str, Any]:
    amount = extract_amount(normalized)
    phone = extract_phone(normalized)
    payment_method = extract_payment_method(normalized)

    if intent == "add_expense":
        category = first_match(normalized, EXPENSE_CATEGORIES) or "General"
        return {
            "amount": amount,
            "category": category,
            "vendor": extract_vendor(transcript, normalized),
            "paymentMethod": payment_method,
            "date": today_string(),
            "taxAmount": 0,
        }
    if intent in {"add_customer", "add_supplier"}:
        return {"name": extract_name_after_entity(transcript, normalized, intent), "phone": phone}
    if intent == "add_product":
        return {
            "name": extract_name_after_entity(transcript, normalized, intent),
            "unit": extract_unit(normalized),
            "stock": amount or 0,
            "price": 0,
            "costPrice": 0,
            "category": "General",
        }
    if intent == "record_sale":
        return {"amount": amount, "customerName": extract_named_value(transcript, normalized, ["to", "for", "customer", "ग्राहक"]), "paymentMethod": payment_method}
    if intent == "record_payment":
        return {"amount": amount, "partyName": extract_named_value(transcript, normalized, ["from", "customer", "party", "बाट"]), "paymentMethod": payment_method}
    if intent == "create_report":
        return {"title": "Assistant summary report", "range": "This month"}
    return {}


def extract_amount(text: str) -> float | None:
    preferred = re.search(r"(?:npr|rs|रु|रकम|amount)\s*([0-9][0-9,]*(?:\.[0-9]+)?)", text)
    match = preferred or re.search(r"([0-9][0-9,]*(?:\.[0-9]+)?)", text)
    if not match:
        return None
    try:
        return float(match.group(1).replace(",", ""))
    except ValueError:
        return None


def extract_phone(text: str) -> str:
    match = re.search(r"\b(?:\+?977[-\s]?)?(9[78][0-9]{8})\b", text)
    return match.group(1) if match else ""


def extract_payment_method(text: str) -> str:
    return first_match(text, PAYMENT_ALIASES) or "Cash"


def extract_unit(text: str) -> str:
    if has_any(text, ["liter", "litre", "ltr", "l ", "लिटर"]):
        return "liter"
    if has_any(text, ["kg", "kilo", "kilogram", "केजी"]):
        return "kg"
    if has_any(text, ["packet", "pack", "प्याकेट"]):
        return "packet"
    return "pcs"


def extract_vendor(transcript: str, normalized: str) -> str:
    named = extract_named_value(transcript, normalized, ["to", "for", "at", "vendor", "लाई", "मा"])
    if named:
        return named
    category = first_match(normalized, EXPENSE_CATEGORIES)
    return category or "Voice entry"


def extract_name_after_entity(transcript: str, normalized: str, intent: str) -> str:
    phrases = {
        "add_customer": ["add customer", "new customer", "create customer", "customer add", "ग्राहक थप", "नयाँ ग्राहक"],
        "add_supplier": ["add supplier", "new supplier", "create supplier", "supplier add", "सप्लायर थप", "आपूर्तिकर्ता थप"],
        "add_product": ["add product", "new product", "create product", "product add", "item add", "सामान थप", "प्रोडक्ट थप"],
    }.get(intent, [])
    text = transcript
    lowered = normalized
    for phrase in phrases:
        index = lowered.find(phrase)
        if index >= 0:
            text = transcript[index + len(phrase):]
            break
    text = re.sub(r"(?:\+?977[-\s]?)?9[78][0-9]{8}", "", text)
    text = re.sub(r"\b(?:with|phone|number|mobile|contact|फोन|नम्बर)\b", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\b[0-9][0-9,]*(?:\.[0-9]+)?\b", " ", text)
    return re.sub(r"\s+", " ", text).strip(" .,-")[:80]


def extract_named_value(transcript: str, normalized: str, markers: list[str]) -> str:
    for marker in markers:
        index = normalized.find(f" {marker} ")
        if index >= 0:
            candidate = transcript[index + len(marker) + 2:]
            candidate = re.sub(r"\b(?:npr|rs|रु|amount|रकम)\b", " ", candidate, flags=re.IGNORECASE)
            candidate = re.sub(r"[0-9][0-9,]*(?:\.[0-9]+)?", " ", candidate)
            return re.sub(r"\s+", " ", candidate).strip(" .,-")[:80]
    return ""


def validation_warnings(intent: str, slots: dict[str, Any]) -> list[str]:
    warnings: list[str] = []
    if intent == "business_question":
        return warnings
    if intent == "unknown":
        return ["I could not understand the business task."]
    if intent == "add_expense" and not slots.get("amount"):
        warnings.append("Amount is required for expense commands.")
    if intent in {"add_customer", "add_supplier", "add_product"} and not str(slots.get("name", "")).strip():
        warnings.append("Name is required before creating this record.")
    if intent == "record_sale":
        warnings.append("Sale commands need item and quantity review before saving.")
    if intent == "record_payment":
        warnings.append("Payment commands need party/customer selection before saving.")
    if intent == "stock_movement":
        warnings.append("Stock movement needs product selection before saving.")
    return warnings


def confidence_for(intent: str, slots: dict[str, Any], warnings: list[str]) -> float:
    if intent == "unknown":
        return 0.18
    if intent == "business_question":
        return 0.96
    confidence = 0.92
    if slots.get("amount"):
        confidence += 0.03
    if slots.get("name") or slots.get("customerName") or slots.get("partyName"):
        confidence += 0.03
    if intent in {"scan_bill", "open_dashboard", "open_analytics"}:
        confidence += 0.04
    if warnings:
        confidence -= 0.18
    return round(max(0.1, min(0.99, confidence)), 2)


def assistant_reply(intent: str, slots: dict[str, Any], warnings: list[str], can_execute: bool) -> str:
    if warnings:
        return "I understood the command, but I need one more detail before saving: " + "; ".join(warnings)
    if intent == "business_question":
        return "I can answer this from saved workspace records."
    if intent == "scan_bill":
        return "Opening the bill scanner. Take a clear photo, then review the extracted fields."
    if can_execute:
        return "I prepared this action. Review it once, then confirm to save it."
    return "I can open the right page for this task and keep the user in control."


def executed_reply(intent: str, slots: dict[str, Any]) -> str:
    if intent == "add_expense":
        return f"Expense saved for NPR {slots.get('amount')}."
    if intent == "add_customer":
        return f"Customer {slots.get('name')} created."
    if intent == "add_supplier":
        return f"Supplier {slots.get('name')} created."
    if intent == "add_product":
        return f"Product {slots.get('name')} created."
    return "Report created."


def has_any(text: str, needles: list[str]) -> bool:
    return any(needle in text for needle in needles)


def first_match(text: str, aliases: dict[str, str]) -> str:
    for alias, value in aliases.items():
        if alias in text:
            return value
    return ""
