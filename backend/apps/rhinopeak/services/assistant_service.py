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
    create_movement,
    create_party,
    create_party_ledger_entry,
    create_product,
    create_purchase,
    create_report,
    create_reminder_log,
    create_sale,
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
    "record_purchase": "/purchases",
    "record_payment": "/parties",
    "send_reminder": "/reminders",
    "create_report": "/reports",
    "open_dashboard": "/dashboard",
    "open_analytics": "/analytics",
    "business_question": "/dashboard",
    "unknown": "/dashboard",
}

SAFE_EXECUTION_INTENTS = {
    "add_expense",
    "add_customer",
    "add_supplier",
    "add_product",
    "stock_movement",
    "record_sale",
    "record_purchase",
    "record_payment",
    "send_reminder",
    "create_report",
}
ROUTE_ACTION_INTENTS = {"scan_bill", "open_dashboard", "open_analytics"}

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
    "cha",
    "chha",
    "मेरो",
    "हाम्रो",
    "कति",
    "कती",
    "छ",
    "छन्",
    "भयो",
    "देखाउ",
    "देखाउनुहोस्",
    "भन",
    "भन्नुहोस्",
    "कुल",
    "जम्मा",
    "स्थिति",
    "विवरण",
    "ब्यालेन्स",
    "बाँकी",
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
    "les",
    "सेल्स",
    "बिक्री",
    "बिक्रि",
    "आम्दानी",
    "राजस्व",
    "खर्च",
    "खर्चा",
    "खरिद",
    "खरिदहरू",
    "परचेज",
    "नगद",
    "बैंक",
    "पैसा",
    "रकम",
    "नाफा",
    "नोक्सान",
    "घाटा",
    "फाइदा",
    "ग्राहक",
    "ग्राहकहरू",
    "कस्टमर",
    "कस्टमरहरू",
    "उधारो",
    "उधार",
    "असामी",
    "सप्लायर",
    "सप्लायरहरू",
    "आपूर्तिकर्ता",
    "साहु",
    "तिर्नुपर्ने",
    "स्टक",
    "सामान",
    "इन्भेन्टरी",
    "पार्टी",
    "पार्टीहरू",
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

ACTION_SLOT_ORDER = {
    "add_expense": ["amount", "category", "vendor", "paymentMethod"],
    "add_customer": ["name", "phone"],
    "add_supplier": ["name", "phone"],
    "add_product": ["name", "stock", "unit", "price"],
    "stock_movement": ["productName", "quantity", "movementType"],
    "record_sale": ["customerName", "productName", "quantity", "unitPrice", "paymentMethod"],
    "record_purchase": ["supplierName", "productName", "quantity", "unitPrice", "paymentMethod"],
    "record_payment": ["partyName", "amount", "paymentMethod"],
    "send_reminder": ["partyName", "message"],
    "create_report": ["range"],
}

OPTIONAL_ACTION_SLOTS = {
    "add_customer": {"phone"},
    "add_supplier": {"phone"},
    "add_expense": {"vendor", "paymentMethod"},
    "add_product": {"stock", "unit", "price"},
    "stock_movement": {"movementType"},
    "record_sale": {"paymentMethod"},
    "record_purchase": {"paymentMethod"},
    "record_payment": {"paymentMethod"},
    "send_reminder": set(),
    "create_report": {"range"},
}

GUIDED_INTENTS = set(ACTION_SLOT_ORDER)

SLOT_PROMPTS = {
    "en": {
        "amount": "Okay, I am preparing it. Please tell me the amount.",
        "category": "Which category should I use?",
        "vendor": "Please tell me the vendor or shop name.",
        "paymentMethod": "How was it paid: cash, bank, eSewa, Khalti, card, or credit?",
        "name": "Okay, I am creating it. Please tell me the name.",
        "phone": "Tell me the phone number, or say skip.",
        "stock": "How much opening stock should I set?",
        "unit": "Which unit should I use, like pcs, kg, liter, packet?",
        "price": "What is the selling price?",
        "productName": "Which item or product name?",
        "quantity": "How many quantity?",
        "unitPrice": "What is the rate per item?",
        "customerName": "Okay, I am making a sales bill. Please tell me the customer name.",
        "supplierName": "Okay, I am making a purchase bill. Please tell me the supplier name.",
        "partyName": "Which customer or supplier name?",
        "movementType": "Is this stock in or stock out?",
        "message": "What reminder message should I prepare?",
        "range": "Which report range should I use: today, this month, or this year?",
    },
    "ne": {
        "amount": "ठीक छ, म रेकर्ड बनाउँदैछु। रकम कति हो?",
        "category": "कुन श्रेणीमा राख्ने?",
        "vendor": "भेन्डर वा पसलको नाम भन्नुहोस्।",
        "paymentMethod": "भुक्तानी कसरी भयो: नगद, बैंक, eSewa, Khalti, कार्ड, कि उधारो?",
        "name": "ठीक छ, म नयाँ रेकर्ड बनाउँदैछु। नाम भन्नुहोस्।",
        "phone": "फोन नम्बर भन्नुहोस्, वा छोड्नुहोस् भन्नुहोस्।",
        "stock": "सुरुको स्टक कति राख्ने?",
        "unit": "युनिट कुन हो, जस्तै pcs, kg, liter, packet?",
        "price": "बेच्ने मूल्य कति हो?",
        "productName": "कुन सामान वा प्रोडक्ट हो?",
        "quantity": "परिमाण कति हो?",
        "unitPrice": "प्रति सामान दर कति हो?",
        "customerName": "ठीक छ, म बिक्री बिल बनाउँदैछु। ग्राहकको नाम भन्नुहोस्।",
        "supplierName": "ठीक छ, म खरिद बिल बनाउँदैछु। सप्लायरको नाम भन्नुहोस्।",
        "partyName": "कुन ग्राहक वा सप्लायर हो?",
        "movementType": "स्टक भित्र आएको हो कि बाहिर गएको हो?",
        "message": "रिमाइन्डरमा के मेसेज पठाउने?",
        "range": "रिपोर्ट कुन अवधिको चाहिन्छ: आज, यो महिना, कि यो वर्ष?",
    },
}

START_REPLIES = {
    "en": {
        "add_expense": "Okay, I am creating a new expense.",
        "add_customer": "Okay, I am adding a new customer.",
        "add_supplier": "Okay, I am adding a new supplier.",
        "add_product": "Okay, I am adding a new stock item.",
        "stock_movement": "Okay, I am recording a stock movement.",
        "record_sale": "Okay, I am creating a new sales bill.",
        "record_purchase": "Okay, I am creating a new purchase bill.",
        "record_payment": "Okay, I am recording the payment.",
        "send_reminder": "Okay, I am preparing a payment reminder.",
        "create_report": "Okay, I am preparing a report.",
    },
    "ne": {
        "add_expense": "ठीक छ, म नयाँ खर्च बनाउँदैछु।",
        "add_customer": "ठीक छ, म नयाँ ग्राहक थप्दैछु।",
        "add_supplier": "ठीक छ, म नयाँ सप्लायर थप्दैछु।",
        "add_product": "ठीक छ, म नयाँ स्टक सामान थप्दैछु।",
        "stock_movement": "ठीक छ, म स्टक रेकर्ड बनाउँदैछु।",
        "record_sale": "ठीक छ, म नयाँ बिक्री बिल बनाउँदैछु।",
        "record_purchase": "ठीक छ, म नयाँ खरिद बिल बनाउँदैछु।",
        "record_payment": "ठीक छ, म भुक्तानी रेकर्ड गर्दैछु।",
        "send_reminder": "ठीक छ, म भुक्तानी रिमाइन्डर तयार गर्दैछु।",
        "create_report": "ठीक छ, म रिपोर्ट तयार गर्दैछु।",
    },
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
    draft = payload.get("draft") or payload.get("conversation") or payload.get("activeCommand")
    if isinstance(draft, dict) and not payload.get("confirm"):
        return continue_guided_command(draft, transcript, normalized, language)

    # 1. Look in learning memory first
    if user:
        from apps.rhinopeak.services.mongo_service import get_learning_memory
        memory_result = get_learning_memory(user["workspaceId"], normalized)
        if memory_result:
            intent = memory_result.get("intent", "unknown")
            slots = memory_result.get("slots", {})
            warnings = validation_warnings(intent, slots)
            confidence = 0.95
            can_execute = intent in SAFE_EXECUTION_INTENTS and not warnings

            return {
                "id": make_id("ASST"),
                "transcript": transcript,
                "normalizedTranscript": normalized,
                "language": language,
                "intent": intent,
                "confidence": confidence,
                "requiresConfirmation": can_execute,
                "canExecute": can_execute,
                "route": INTENT_ROUTES.get(intent, "/dashboard"),
                "slots": slots,
                "warnings": warnings,
                "reply": assistant_reply(intent, slots, warnings, can_execute) + " (From Memory)",
                "safety": {
                    "autoExecute": False,
                    "reason": "Write actions must be reviewed and confirmed before saving business data.",
                },
                "executionStatus": "Draft",
                "createdAt": iso_now(),
            }

    intent = detect_intent(normalized)

    if intent == "unknown":
        gemini_result = _gemini_intent_fallback(transcript)
        if gemini_result and gemini_result.get("intent") != "unknown":
            intent = gemini_result["intent"]
            slots = gemini_result.get("slots", {})
            warnings = validation_warnings(intent, slots)
            confidence = gemini_result.get("confidence", 0.85)
            can_execute = intent in SAFE_EXECUTION_INTENTS and not warnings

            if user:
                from apps.rhinopeak.services.mongo_service import save_learning_memory
                save_learning_memory(user["workspaceId"], normalized, intent, slots, "assistant")

            return {
                "id": make_id("ASST"),
                "transcript": transcript,
                "normalizedTranscript": normalized,
                "language": language,
                "intent": intent,
                "confidence": confidence,
                "requiresConfirmation": can_execute,
                "canExecute": can_execute,
                "route": INTENT_ROUTES.get(intent, "/dashboard"),
                "slots": slots,
                "warnings": warnings,
                "reply": assistant_reply(intent, slots, warnings, can_execute) + " (Handled by Gemini AI)",
                "safety": {
                    "autoExecute": False,
                    "reason": "Write actions must be reviewed and confirmed before saving business data.",
                },
                "executionStatus": "Draft",
                "createdAt": iso_now(),
            }

    if intent == "business_question":
        return business_question_command(transcript, normalized, language, user)

    slots = extract_slots(intent, transcript, normalized)
    return build_guided_command(
        transcript=transcript,
        normalized=normalized,
        language=language,
        intent=intent,
        slots=slots,
        existing_id=None,
        started=True,
    )


def build_guided_command(
    *,
    transcript: str,
    normalized: str,
    language: str,
    intent: str,
    slots: dict[str, Any],
    existing_id: str | None,
    started: bool = False,
) -> dict[str, Any]:
    missing_slots = missing_required_slots(intent, slots)
    warnings = validation_warnings(intent, slots)
    confidence = confidence_for(intent, slots, warnings)
    can_execute = intent in SAFE_EXECUTION_INTENTS and not missing_slots and not warnings
    requires_confirmation = can_execute
    next_slot = missing_slots[0] if missing_slots else ""
    reply = guided_reply(intent, slots, warnings, can_execute, language, next_slot, started)

    return {
        "id": existing_id or make_id("ASST"),
        "transcript": transcript,
        "normalizedTranscript": normalized,
        "language": language,
        "intent": intent,
        "confidence": confidence,
        "requiresConfirmation": requires_confirmation,
        "canExecute": can_execute,
        "route": INTENT_ROUTES.get(intent, "/dashboard"),
        "slots": slots,
        "warnings": warnings,
        "missingSlots": missing_slots,
        "nextSlot": next_slot,
        "reply": reply,
        "safety": {
            "autoExecute": False,
            "reason": "Write actions must be reviewed and confirmed before saving business data.",
        },
        "executionStatus": "Collecting" if missing_slots else "Draft",
        "createdAt": iso_now(),
    }


def _gemini_intent_fallback(transcript: str) -> dict[str, Any]:
    import os
    import json
    import urllib.request

    try:
        from apps.rhinopeak.services.karobrain_engine import GEMINI_API_KEY
    except ImportError:
        GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()

    if not GEMINI_API_KEY:
        return None

    allowed_intents = list(INTENT_ROUTES.keys())

    prompt = f"""You are KaroBrain™, an intent router for a business application.
The user sent the following command: "{transcript}"
Determine the user's intent. It MUST be one of these: {allowed_intents}.
If you can, also extract any slots (amount, name, phone, paymentMethod, category).

Return the structured output as a JSON object matching this schema:
{{
  "intent": "one of the allowed intents",
  "slots": {{
    "amount": 0.0,
    "name": "extracted name if any",
    "phone": "extracted phone if any"
  }},
  "confidence": 0.90
}}
"""

    payload = {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {
            'temperature': 0.1,
            'responseMimeType': 'application/json'
        }
    }

    req = urllib.request.Request(
        f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}',
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            body = res.read().decode('utf-8')
            result = json.loads(body)
            text = result['candidates'][0]['content']['parts'][0]['text']
            parsed = json.loads(text.strip())
            return parsed
    except Exception as e:
        print(f"[Gemini Fallback] Error: {e}")
        return None


def continue_guided_command(draft: dict[str, Any], transcript: str, normalized: str, language: str) -> dict[str, Any]:
    intent = str(draft.get("intent") or "unknown")
    slots = dict(draft.get("slots") or {})
    next_slot = str(draft.get("nextSlot") or "")
    language = str(draft.get("language") or language or "en")

    if intent not in GUIDED_INTENTS:
        return parse_assistant_command({"transcript": transcript, "language": language})

    if next_slot:
        value = slot_value_from_answer(next_slot, transcript, normalized)
        if value not in (None, ""):
            slots[next_slot] = value

    parsed_slots = extract_slots(intent, transcript, normalized)
    numeric_slots = {"amount", "quantity", "unitPrice", "stock", "price"}
    if next_slot in numeric_slots:
        for key in numeric_slots - {next_slot}:
            parsed_slots.pop(key, None)
    named_answer_slots = {"customerName", "supplierName", "partyName", "productName", "name", "message"}
    if next_slot in named_answer_slots:
        for key in named_answer_slots - {next_slot}:
            parsed_slots.pop(key, None)
    merge_meaningful_slots(slots, parsed_slots)
    return build_guided_command(
        transcript=f"{draft.get('transcript', '')} | {transcript}".strip(" |"),
        normalized=f"{draft.get('normalizedTranscript', '')} | {normalized}".strip(" |"),
        language=language,
        intent=intent,
        slots=slots,
        existing_id=str(draft.get("id") or "") or None,
    )


def missing_required_slots(intent: str, slots: dict[str, Any]) -> list[str]:
    if intent not in ACTION_SLOT_ORDER:
        return []
    optional = OPTIONAL_ACTION_SLOTS.get(intent, set())
    missing: list[str] = []
    for slot in ACTION_SLOT_ORDER[intent]:
        if slot in optional:
            continue
        if slot_is_empty(slot, slots.get(slot)):
            missing.append(slot)
    return missing


def slot_is_empty(slot: str, value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, (int, float)):
        return value <= 0 if slot in {"amount", "quantity", "unitPrice"} else False
    return not str(value).strip()


def slot_value_from_answer(slot: str, transcript: str, normalized: str) -> Any:
    skip_words = {"skip", "छोड", "छोड्नुहोस्", "पर्दैन", "chaina", "chhaina", "छैन"}
    if any(word in normalized for word in skip_words):
        return "" if slot not in {"stock", "price"} else 0
    if slot in {"amount", "quantity", "unitPrice", "stock", "price"}:
        return extract_amount(normalized)
    if slot == "paymentMethod":
        return extract_payment_method(normalized)
    if slot == "unit":
        return extract_unit(normalized)
    if slot == "movementType":
        return "Out" if has_any(normalized, ["out", "remove", "sold", "बाहिर", "घट"]) else "In"
    if slot == "range":
        return report_range_from_text(normalized)
    if slot == "phone":
        return extract_phone(normalized)
    return clean_free_text_answer(transcript)


def clean_free_text_answer(value: str) -> str:
    text = re.sub(r"\b(?:my|mero|miro|name is|naam|नाम|हो|is|for|to|customer|supplier|party)\b", " ", value, flags=re.IGNORECASE)
    text = re.sub(r"\b(?:npr|rs|रु|amount|रकम)\b", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", " ", text).strip(" .,-")
    return text[:120]


def merge_meaningful_slots(slots: dict[str, Any], parsed: dict[str, Any]) -> None:
    for key, value in parsed.items():
        if value in (None, ""):
            continue
        if key in {"amount", "quantity", "unitPrice", "stock", "price"} and float(value or 0) <= 0:
            continue
        if key in {"date", "taxAmount", "category", "paymentMethod", "unit"} and slots.get(key):
            continue
        if slot_is_empty(key, slots.get(key)):
            slots[key] = value


def guided_reply(
    intent: str,
    slots: dict[str, Any],
    warnings: list[str],
    can_execute: bool,
    language: str,
    next_slot: str,
    started: bool,
) -> str:
    lang = "ne" if language == "ne" else "en"
    if next_slot:
        opener = START_REPLIES.get(lang, START_REPLIES["en"]).get(intent, "")
        prompt = SLOT_PROMPTS.get(lang, SLOT_PROMPTS["en"]).get(next_slot, "Please tell me the next detail.")
        if started and (prompt.lower().startswith("okay") or prompt.startswith("ठीक")):
            return prompt
        return f"{opener} {prompt}".strip() if started else prompt
    if warnings:
        return assistant_reply(intent, slots, warnings, can_execute)
    if can_execute:
        if lang == "ne":
            return "सबै जानकारी तयार भयो। एक पटक जाँच गरेर Confirm and save थिच्नुहोस्।"
        return "All details are ready. Review once, then tap Confirm and save."
    return assistant_reply(intent, slots, warnings, can_execute)


def business_question_command(
    transcript: str,
    normalized: str,
    language: str,
    user: dict[str, Any] | None,
) -> dict[str, Any]:
    question_type = classify_business_question(normalized)
    scope = question_scope(normalized)
    if user:
        answer = answer_business_question(user, question_type, scope, normalized, language)
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
    language: str = "en",
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
        "customerCount": len(customers),
        "supplierCount": len(suppliers),
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

    if language == "ne":
        reply = nepali_business_reply(question_type, scope, slots)

    return {
        "reply": reply,
        "slots": slots,
        "route": QUESTION_ROUTES.get(question_type, "/dashboard"),
        "confidence": 0.97 if question_type != "business_summary" or has_any(normalized, ["summary", "status"]) else 0.92,
    }


def find_record_by_name(user: dict[str, Any], kind: str, name: Any, fields: tuple[str, ...] = ("name",)) -> dict[str, Any] | None:
    needle = re.sub(r"\s+", " ", str(name or "")).strip().lower()
    if not needle:
        return None
    for record in list_records(user["workspaceId"], kind):
        if record.get("deletedAt"):
            continue
        for field in fields:
            value = re.sub(r"\s+", " ", str(record.get(field, ""))).strip().lower()
            if value and (value == needle or needle in value or value in needle):
                return record
    return None


def product_for_assistant(
    user: dict[str, Any],
    name: str,
    unit_price: float,
    supplier: str = "",
    create_if_missing: bool = False,
) -> dict[str, Any] | None:
    product = find_record_by_name(user, "inventory", name, ("name", "sku", "barcode"))
    if product:
        return product
    if not create_if_missing or not str(name).strip():
        return None
    created = create_product(
        user,
        {
            "name": name,
            "unit": "pcs",
            "stock": 0,
            "reorderLevel": 0,
            "price": unit_price,
            "costPrice": unit_price,
            "supplier": supplier,
            "category": "Assistant",
        },
    )
    return created.get("product")


def customer_id_for_assistant_sale(user: dict[str, Any], customer_name: str) -> str:
    customer = find_record_by_name(user, "customers", customer_name, ("name", "company", "phone"))
    return str((customer or {}).get("id") or make_id("CUST"))


def supplier_for_assistant_purchase(user: dict[str, Any], supplier_name: str) -> dict[str, Any]:
    supplier = find_record_by_name(user, "suppliers", supplier_name, ("name", "contactPerson", "phone"))
    if supplier:
        return supplier
    created = create_supplier(
        user,
        {
            "name": supplier_name,
            "phone": "",
            "email": "",
            "address": "",
            "pan": "",
            "contactPerson": "",
            "payableBalance": 0,
            "notes": "Created from assistant guided flow.",
        },
    )
    return created["supplier"]


def party_for_assistant_payment(user: dict[str, Any], party_name: str, party_type: str) -> dict[str, Any]:
    party = find_record_by_name(user, "parties", party_name, ("name", "phone", "email"))
    if party:
        return party
    created = create_party(
        user,
        {
            "name": party_name,
            "type": party_type if party_type in {"Customer", "Supplier", "Both"} else "Customer",
            "phone": "",
            "email": "",
            "address": "",
            "pan": "",
            "openingBalance": 0,
            "creditLimit": 0,
            "dueDays": 7,
            "notes": "Created from assistant guided flow.",
        },
    )
    return created["party"]


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
    elif intent == "record_sale":
        quantity = to_float(slots.get("quantity"))
        unit_price = to_float(slots.get("unitPrice"))
        customer_name = str(slots.get("customerName", "Walk-in customer")).strip() or "Walk-in customer"
        product_name = str(slots.get("productName", "Item")).strip() or "Item"
        product = product_for_assistant(user, product_name, unit_price)
        result = create_sale(
            user,
            {
                "customerId": customer_id_for_assistant_sale(user, customer_name),
                "customer": customer_name,
                "items": [
                    {
                        "productId": str((product or {}).get("id", "")),
                        "productName": str((product or {}).get("name", product_name)),
                        "quantity": quantity,
                        "unit": str((product or {}).get("unit", "pcs")),
                        "unitPrice": unit_price,
                        "costPrice": to_float((product or {}).get("costPrice")),
                        "discount": 0,
                        "tax": 0,
                    }
                ],
                "payment": slots.get("paymentMethod", "Cash"),
                "status": "Completed",
                "date": slots.get("date", today_string()),
                "notes": "Created from assistant guided flow.",
            },
        )
    elif intent == "record_purchase":
        quantity = to_float(slots.get("quantity"))
        unit_price = to_float(slots.get("unitPrice"))
        supplier_name = str(slots.get("supplierName", "Supplier")).strip() or "Supplier"
        product_name = str(slots.get("productName", "Item")).strip() or "Item"
        supplier = supplier_for_assistant_purchase(user, supplier_name)
        product = product_for_assistant(user, product_name, unit_price, supplier_name, create_if_missing=True)
        amount = round(quantity * unit_price, 2)
        result = create_purchase(
            user,
            {
                "supplierId": supplier.get("id", ""),
                "supplierName": supplier.get("name", supplier_name),
                "billNo": make_id("PBILL"),
                "date": slots.get("date", today_string()),
                "payment": slots.get("paymentMethod", "Cash"),
                "status": "Received",
                "items": [
                    {
                        "productId": str((product or {}).get("id", "")),
                        "productName": str((product or {}).get("name", product_name)),
                        "quantity": quantity,
                        "unit": str((product or {}).get("unit", "pcs")),
                        "unitPrice": unit_price,
                        "tax": 0,
                        "discount": 0,
                    }
                ],
                "amount": amount,
                "taxTotal": 0,
                "notes": "Created from assistant guided flow.",
            },
        )
    elif intent == "stock_movement":
        product_name = str(slots.get("productName", "")).strip()
        product = find_record_by_name(user, "inventory", product_name, ("name", "sku", "barcode"))
        if not product:
            raise AppError(400, f"Product '{product_name}' was not found. Add the product first, then record stock movement.")
        quantity = to_float(slots.get("quantity"))
        movement_type = str(slots.get("movementType", "In"))
        delta = -quantity if movement_type.lower() == "out" else quantity
        result = create_movement(
            user,
            {
                "productId": product.get("id", ""),
                "productName": product.get("name", product_name),
                "delta": delta,
                "reason": "Assistant",
                "note": "Created from assistant guided flow.",
            },
        )
    elif intent == "record_payment":
        party_type = str(slots.get("partyType") or "Customer").title()
        party_name = str(slots.get("partyName", "")).strip()
        party = party_for_assistant_payment(user, party_name, party_type)
        is_supplier = str(party.get("type", party_type)).lower() == "supplier"
        result = create_party_ledger_entry(
            user,
            {
                "partyId": party.get("id", ""),
                "partyName": party.get("name", party_name),
                "direction": "Payable" if is_supplier else "Receivable",
                "type": "Payment Paid" if is_supplier else "Payment Received",
                "amount": to_float(slots.get("amount")),
                "date": slots.get("date", today_string()),
                "note": f"Via {slots.get('paymentMethod', 'Cash')} - assistant guided flow.",
            },
        )
    elif intent == "send_reminder":
        result = create_reminder_log(
            user,
            {
                "partyName": slots.get("partyName", ""),
                "channel": "WhatsApp/SMS",
                "message": slots.get("message", ""),
                "status": "Draft",
                "sentAt": "",
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
                "format": "PDF",
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
    text = normalize_command(text)

    if is_business_question(text) and not is_write_action_request(text):
        return "business_question"

    # helper to check write verbs/actions
    has_write_verb = has_any(text, ["थप", "नयाँ", "बन", "एड", "गर", "gara", "banau", "banaun", "रेकर्ड", "बिल", "तिरे", "आयो", "बेचे", "बेचियो", "थप्नुहोस्", "बनाउनुहोस्", "गर्नुहोस्"])

    if text in {"सेल्स", "सेल", "बिक्री", "बिक्रि"}:
        return "record_sale"

    if text in {"खर्च", "खर्चा", "एक्स्पेन्स"}:
        return "add_expense"

    if (
        has_any(text, ["purchase bill", "add purchase", "new purchase", "supplier bill", "stock came in", "stock received"])
        or (has_any(text, ["खरिद", "सामान आयो", "स्टक आयो", "परचेज"]) and has_write_verb)
    ):
        return "record_purchase"

    if (
        has_any(text, ["record sale", "add sale", "new sale", "sold", "sale entry", "sales bill", "sale bill", "create sale", "customer took", "bikri bill", "naya bikri", "bikri add"])
        or (
            has_any(text, ["बिक्री", "बिक्रि", "बेचे", "बेचियो", "सेल्स", "सेल"])
            and (has_write_verb or has_any(text, ["कस्टमर", "ग्राहक", "customer"]))
        )
    ):
        return "record_sale"

    if (
        has_any(text, ["payment received", "payment paid", "paid supplier", "pay supplier", "supplier payment", "clear credit", "clear payable", "credit paid", "payment"])
        or (has_any(text, ["उधार", "उधारो", "भुक्तानी", "पेमेन्ट", "पैसा", "रकम"]) and has_any(text, ["तिरे", "आयो", "गरे", "बुझाए", "थप", "एड", "रेकर्ड"]))
    ):
        return "record_payment"

    if (
        has_any(text, ["scan bill", "scan invoice", "read bill", "read receipt", "bill scan", "बिल स्क्यान", "रसिद स्क्यान", "बिल पढ", "स्क्यान bill", "फोटो स्क्यान", "स्क्यान"])
        or (has_any(text, ["scan", "read", "capture", "photo"]) and has_any(text, ["bill", "invoice", "receipt", "vat"]))
    ):
        return "scan_bill"

    if has_any(text, ["reminder", "remind", "payment reminder", "send sms", "send whatsapp", "रिमाइन्डर", "सम्झाउ", "मेसेज पठ", "रिमाइन्डर पठाउ", "रिमाइन्डर थप"]):
        return "send_reminder"

    if (
        has_any(text, ["add customer", "new customer", "create customer", "customer add"])
        or (has_any(text, ["ग्राहक", "कस्टमर"]) and has_any(text, ["थप", "नयाँ", "बन", "एड", "थप्नुहोस्", "बनाउनुहोस्"]))
    ):
        return "add_customer"

    if (
        has_any(text, ["add supplier", "new supplier", "create supplier", "supplier add"])
        or (has_any(text, ["सप्लायर", "साहु", "आपूर्तिकर्ता"]) and has_any(text, ["थप", "नयाँ", "बन", "एड", "थप्नुहोस्", "बनाउनुहोस्"]))
    ):
        return "add_supplier"

    if (
        has_any(text, ["add product", "new product", "create product", "product add", "item add"])
        or (has_any(text, ["सामान", "प्रोडक्ट", "आइटम"]) and has_any(text, ["थप", "नयाँ", "बन", "एड", "थप्नुहोस्", "बनाउनुहोस्"]))
    ):
        return "add_product"

    if (
        has_any(text, ["add stock", "stock in", "stock update", "inventory update"])
        or (has_any(text, ["स्टक", "इन्भेन्टरी"]) and has_any(text, ["थप", "मिलाउ", "अपडेट", "इन", "आउट"]))
    ):
        return "stock_movement"

    if (
        has_any(text, ["expense", "spent", "paid"])
        or has_any(text, ["खर्च", "खर्चा", "एक्स्पेन्स"])
    ):
        return "add_expense"

    if is_business_question(text):
        return "business_question"

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
            # Nepali phrase fallbacks
            "आजको बिक्री",
            "आजको सेल्स",
            "जम्मा बिक्री",
            "कुल बिक्री",
            "जम्मा सेल्स",
            "कुल सेल्स",
            "नगद ब्यालेन्स",
            "बैंक ब्यालेन्स",
            "जम्मा खर्च",
            "कुल खर्च",
            "खर्च कुल",
            "जम्मा खरिद",
            "कुल खरिद",
            "साहुको उधारो",
            "साहुलाई तिर्नुपर्ने",
            "साहुको बाँकी",
            "ग्राहकको उधारो",
            "ग्राहकबाट उठ्नुपर्ने",
            "ग्राहकको बाँकी",
            "स्टकको मूल्य",
            "सामानको मूल्य",
            "जम्मा स्टक",
            "नाफा नोक्सान",
            "घाटा नाफा",
            "व्यापार सारांश",
            "कारोबार विवरण",
        ],
    )


def is_write_action_request(text: str) -> bool:
    return has_any(
        text,
        [
            "add",
            "create",
            "new",
            "record",
            "bill",
            "entry",
            "save",
            "paid",
            "spent",
            "received",
            "sold",
            "stock in",
            "stock out",
            "naya",
            "banau",
            "banaun",
            "gar",
            "gara",
            "थप",
            "नयाँ",
            "बन",
            "गर",
            "एड",
            "रेकर्ड",
            "बिल",
            "तिरे",
            "आयो",
            "बेचे",
            "बेचियो",
            "थप्नुहोस्",
            "बनाउनुहोस्",
            "गर्नुहोस्",
        ],
    )


def classify_business_question(text: str) -> str:
    if has_any(text, ["profit", "loss", "margin", "net", "earning", "नाफा", "नोक्सान", "घाटा", "फाइदा"]):
        return "profit_estimate"
    if has_any(text, ["receivable", "customer credit", "credit due", "customer balance", "udhar", "grahak", "ग्राहकको उधारो", "उठ्नुपर्ने", "उठ्न बाँकी", "उठाउन बाँकी", "उधारो", "ग्राहक उधार"]):
        return "customer_receivable"
    if has_any(text, ["payable", "supplier payable", "supplier balance", "tirnu", "tirna", "तिर्नुपर्ने", "तिर्न बाँकी", "तिर्नु बाँकी", "साहु", "सप्लायर उधार", "तिर्नु", "तिर्न"]):
        return "supplier_payable"
    if has_any(text, ["cash", "bank", "wallet", "cash drawer", "balance", "नगद", "बैंक", "ब्यालेन्स", "पैसा", "रकम"]):
        return "cash_balance"
    if has_any(text, ["stock", "inventory", "saman", "low stock", "out of stock", "स्टक", "सामान", "इन्भेन्टरी"]):
        return "inventory_status"
    if has_any(text, ["purchase", "purchases", "supplier bill", "stock came", "खरिद", "परचेज"]):
        return "purchases_total"
    if has_any(text, ["expense", "expenses", "kharcha", "kharach", "spent", "खर्च", "खर्चा"]):
        return "expenses_total"
    if has_any(text, ["sale", "sales", "revenue", "income", "bikri", "बिक्री", "बिक्रि", "सेल्स", "आम्दानी"]):
        return "sales_total"
    if has_any(text, ["customer", "customers", "grahak", "ग्राहक"]):
        return "customer_status"
    if has_any(text, ["supplier", "suppliers", "सप्लायर", "आपूर्तिकर्ता"]):
        return "supplier_status"
    return "business_summary"


def question_scope(text: str) -> str:
    if has_any(text, ["today", "aaja", "daily", "आज", "आजको", "दैनिक"]):
        return "today"
    if has_any(text, ["this month", "month", "monthly", "mahina", "महिना", "यो महिना", "मासिक"]):
        return "this_month"
    if has_any(text, ["this year", "year", "yearly", "barsa", "वर्ष", "यो वर्ष", "वार्षिक"]):
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
        category = first_match(normalized, EXPENSE_CATEGORIES)
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
            "price": amount or 0,
            "costPrice": 0,
            "category": "General",
        }
    if intent == "stock_movement":
        return {
            "productName": extract_product_name(transcript, normalized),
            "quantity": amount,
            "movementType": "Out" if has_any(normalized, ["out", "remove", "sold", "बाहिर", "घट"]) else "In",
        }
    if intent == "record_sale":
        return {
            "customerName": extract_named_value(transcript, normalized, ["to", "for", "customer", "ग्राहक"]) or extract_customer_phrase(transcript, normalized),
            "productName": extract_product_name(transcript, normalized),
            "quantity": extract_quantity(normalized) or (1 if amount else None),
            "unitPrice": amount,
            "paymentMethod": payment_method,
        }
    if intent == "record_purchase":
        return {
            "supplierName": extract_named_value(transcript, normalized, ["from", "supplier", "vendor", "सप्लायर", "बाट"]) or extract_supplier_phrase(transcript, normalized),
            "productName": extract_product_name(transcript, normalized),
            "quantity": extract_quantity(normalized) or (1 if amount else None),
            "unitPrice": amount,
            "paymentMethod": payment_method,
        }
    if intent == "record_payment":
        return {
            "amount": amount,
            "partyName": extract_named_value(transcript, normalized, ["from", "to", "customer", "supplier", "party", "बाट", "लाई"]),
            "paymentMethod": payment_method,
            "partyType": "Supplier" if has_any(normalized, ["supplier", "vendor", "सप्लायर", "साहु"]) else "Customer",
        }
    if intent == "send_reminder":
        party_name = extract_named_value(transcript, normalized, ["to", "for", "customer", "supplier", "party", "लाई"])
        return {
            "partyName": party_name,
            "message": extract_reminder_message(transcript, party_name),
        }
    if intent == "create_report":
        return {"title": "Assistant summary report", "range": report_range_from_text(normalized)}
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


def extract_quantity(text: str) -> float | None:
    preferred = re.search(r"(?:qty|quantity|परिमाण|मात्रा)\s*([0-9][0-9,]*(?:\.[0-9]+)?)", text)
    match = preferred or re.search(
        r"([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:pcs|piece|pieces|kg|kilo|kilogram|liter|litre|ltr|packet|pack|bag|वटा|केजी|लिटर|प्याकेट|बोरा)",
        text,
    )
    if not match:
        return None
    try:
        return float(match.group(1).replace(",", ""))
    except ValueError:
        return None


def extract_product_name(transcript: str, normalized: str) -> str:
    named = extract_named_value(transcript, normalized, ["item", "product", "saman", "सामान", "प्रोडक्ट", "वस्तु", "आइटम"])
    if named:
        return named
    if has_any(normalized, [" to ", " for ", " customer ", " from ", " supplier ", " vendor ", "ग्राहक", "सप्लायर", "बाट", "लाई", " कस्टमर ", " साहु "]):
        return ""
    text = re.sub(
        r"\b(?:record|add|new|create|sale|sales|bill|purchase|supplier|stock|came|in|out|sold|cash|bank|credit|npr|rs|mero|miro|naya|bikri|kharid|banau|banaun|gar|gara|garnu|entry|customer|supplier)\b",
        " ",
        transcript,
        flags=re.IGNORECASE,
    )
    text = re.sub(r"(?:\+?977[-\s]?)?9[78][0-9]{8}", " ", text)
    text = re.sub(r"[0-9][0-9,]*(?:\.[0-9]+)?", " ", text)
    text = re.sub(r"\s+", " ", text).strip(" .,-")
    if text.lower() in {"banau", "banaun", "gar", "gara", "garnu", "entry"}:
        return ""
    return text[:80]


def extract_customer_phrase(transcript: str, normalized: str) -> str:
    return extract_named_value(transcript, normalized, ["to", "for", "customer", "ग्राहक", "लाई", "कस्टमर"])


def extract_supplier_phrase(transcript: str, normalized: str) -> str:
    return extract_named_value(transcript, normalized, ["from", "supplier", "vendor", "सप्लायर", "बाट", "साहु"])


def extract_reminder_message(transcript: str, party_name: str) -> str:
    text = transcript
    if party_name:
        text = re.sub(re.escape(party_name), " ", text, flags=re.IGNORECASE)
    text = re.sub(
        r"\b(?:send|payment|reminder|remind|sms|whatsapp|message|to|for|customer|supplier|party|please)\b",
        " ",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(r"\s+", " ", text).strip(" .,-")
    return text[:180]


def report_range_from_text(text: str) -> str:
    if has_any(text, ["today", "aaja", "आज"]):
        return "Today"
    if has_any(text, ["year", "yearly", "barsa", "वर्ष"]):
        return "This year"
    return "This month"


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
        "add_customer": [
            "add customer", "new customer", "create customer", "customer add",
            "ग्राहक थप", "नयाँ ग्राहक", "कस्टमर थप", "नयाँ कस्टमर", "कस्टमर एड", "ग्राहक एड", "कस्टमर बन", "ग्राहक बन"
        ],
        "add_supplier": [
            "add supplier", "new supplier", "create supplier", "supplier add",
            "सप्लायर थप", "आपूर्तिकर्ता थप", "नयाँ सप्लायर", "सप्लायर एड", "सप्लायर बन",
            "साहु थप", "साहु एड", "नयाँ साहु", "साहु बन"
        ],
        "add_product": [
            "add product", "new product", "create product", "product add", "item add",
            "सामान थप", "प्रोडक्ट थप", "नयाँ सामान", "नयाँ प्रोडक्ट", "प्रोडक्ट एड",
            "नयाँ आइटम", "आइटम थप", "आइटम एड", "सामान एड"
        ],
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

    # Strip common command verbs and pronouns that appear in Devanagari at the end or around names
    name = re.sub(r"\s+", " ", text).strip(" .,-")
    clean_patterns = r"\b(?:my|mero|miro|name|is|naam|नाम|हो|is|for|to|customer|supplier|party|add|new|create|ग्राहक|सप्लायर|साहु|कस्टमर|थप|एड|गर|बनाउ|बनाउन|नयाँ|थप्नुहोस्|बनाउनुहोस्|गर्नुहोस्)\b"
    name = re.sub(clean_patterns, " ", name, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", name).strip(" .,-")[:80]


def extract_named_value(transcript: str, normalized: str, markers: list[str]) -> str:
    for marker in markers:
        index = normalized.find(f" {marker} ")
        if index >= 0:
            candidate = transcript[index + len(marker) + 2:]
            candidate = re.sub(r"\b(?:npr|rs|रु|amount|रकम)\b", " ", candidate, flags=re.IGNORECASE)
            candidate = re.sub(r"[0-9][0-9,]*(?:\.[0-9]+)?", " ", candidate)
            candidate = re.sub(
                r"\b(?:cash|bank|card|credit|esewa|e-sewa|khalti|fonepay|fone pay|नगद|बैंक|उधार)\b",
                " ",
                candidate,
                flags=re.IGNORECASE,
            )
            return re.sub(r"\s+", " ", candidate).strip(" .,-")[:80]
    return ""


def slot_label(slot: str) -> str:
    return {
        "amount": "Amount",
        "category": "Category",
        "vendor": "Vendor",
        "paymentMethod": "Payment method",
        "name": "Name",
        "stock": "Opening stock",
        "unit": "Unit",
        "price": "Price",
        "productName": "Product name",
        "quantity": "Quantity",
        "unitPrice": "Rate",
        "customerName": "Customer name",
        "supplierName": "Supplier name",
        "partyName": "Party name",
        "movementType": "Stock movement type",
        "message": "Reminder message",
        "range": "Report range",
    }.get(slot, slot.replace("_", " ").title())


def validation_warnings(intent: str, slots: dict[str, Any]) -> list[str]:
    warnings: list[str] = []
    if intent == "business_question":
        return warnings
    if intent == "unknown":
        return ["I could not understand the business task."]
    for slot in missing_required_slots(intent, slots):
        warnings.append(f"{slot_label(slot)} is required.")
    return warnings


def confidence_for(intent: str, slots: dict[str, Any], warnings: list[str]) -> float:
    if intent == "unknown":
        return 0.18
    if intent == "business_question":
        return 0.96
    confidence = 0.92
    if slots.get("amount"):
        confidence += 0.03
    if slots.get("name") or slots.get("customerName") or slots.get("supplierName") or slots.get("partyName") or slots.get("productName"):
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
    if intent in ROUTE_ACTION_INTENTS:
        return "Opening the right page now."
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
    if intent == "record_sale":
        return f"Sales bill saved for {slots.get('customerName')}."
    if intent == "record_purchase":
        return f"Purchase bill saved for {slots.get('supplierName')}."
    if intent == "stock_movement":
        return f"Stock movement saved for {slots.get('productName')}."
    if intent == "record_payment":
        return f"Payment saved for {slots.get('partyName')}."
    if intent == "send_reminder":
        return f"Reminder draft saved for {slots.get('partyName')}."
    return "Report created."


def nepali_business_reply(question_type: str, scope: str, slots: dict[str, Any]) -> str:
    subject = nepali_scope_subject(scope)
    if question_type == "sales_total":
        return f"{subject} बिक्री जम्मा {format_money(slots['salesTotal'])} हो। {slots['salesCount']} बिलबाट।"
    if question_type == "expenses_total":
        return f"{subject} खर्च जम्मा {format_money(slots['expensesTotal'])} हो। {slots['expenseCount']} रेकर्डबाट।"
    if question_type == "purchases_total":
        return f"{subject} खरिद जम्मा {format_money(slots['purchasesTotal'])} हो। {slots['purchaseCount']} बिलबाट।"
    if question_type == "cash_balance":
        return f"हाल नगद र बैंक ब्यालेन्स {format_money(slots['cashBankBalance'])} छ।"
    if question_type == "customer_receivable":
        return f"ग्राहकबाट उठ्न बाँकी रकम {format_money(slots['customerReceivable'])} छ।"
    if question_type == "supplier_payable":
        return f"सप्लायरलाई तिर्न बाँकी रकम {format_money(slots['supplierPayable'])} छ।"
    if question_type == "inventory_status":
        return (
            f"स्टकमा {slots['inventoryProducts']} सामान छन्। "
            f"कम स्टक {slots['lowStockItems']} र स्टक सकिएका {slots['outOfStockItems']} छन्। "
            f"स्टक मूल्य {format_money(slots['stockValue'])}।"
        )
    if question_type == "profit_estimate":
        return f"{subject} अनुमानित सञ्चालन नतिजा {format_money(slots['operatingResult'])} हो।"
    if question_type == "customer_status":
        return f"कुल ग्राहक {slots['customerCount']} छन्। ग्राहक उधारो {format_money(slots['customerReceivable'])} छ।"
    if question_type == "supplier_status":
        return f"कुल सप्लायर {slots['supplierCount']} छन्। सप्लायरलाई तिर्न बाँकी {format_money(slots['supplierPayable'])} छ।"
    return (
        f"व्यवसाय सारांश: बिक्री {format_money(slots['salesTotal'])}, "
        f"खरिद {format_money(slots['purchasesTotal'])}, खर्च {format_money(slots['expensesTotal'])}, "
        f"नगद/बैंक {format_money(slots['cashBankBalance'])}।"
    )


def nepali_scope_subject(scope: str) -> str:
    return {
        "today": "आजको",
        "this_month": "यो महिनाको",
        "this_year": "यो वर्षको",
        "all_time": "कुल",
    }.get(scope, "कुल")


def has_any(text: str, needles: list[str]) -> bool:
    return any(needle in text for needle in needles)


def first_match(text: str, aliases: dict[str, str]) -> str:
    for alias, value in aliases.items():
        if alias in text:
            return value
    return ""
