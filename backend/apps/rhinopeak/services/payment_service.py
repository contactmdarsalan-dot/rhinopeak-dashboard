from __future__ import annotations
import os
import json
import hashlib
import hmac
import base64
from typing import Any
from hmac import compare_digest
from urllib.parse import urlencode

# eSewa config — sandbox/test mode
# Register at https://developer.esewa.com.np/ for live credentials.
# EPAYTEST / 8gBm/:&EnhH.1/q are eSewa's official sandbox merchant+key.
ESEWA_MERCHANT_CODE = os.environ.get("ESEWA_MERCHANT_CODE", "EPAYTEST")
ESEWA_SECRET_KEY    = os.environ.get("ESEWA_SECRET_KEY", "")          # eSewa sandbox shared secret
ESEWA_BASE_URL      = os.environ.get("ESEWA_BASE_URL", "https://rc-epay.esewa.com.np")  # sandbox
ESEWA_VERIFY_URL    = os.environ.get("ESEWA_VERIFY_URL", f"{ESEWA_BASE_URL}/api/epay/main/v2/form")

# Khalti config — sandbox/test mode
# Get test keys from https://dashboard.khalti.com/merchant/
# test_public_key / test_secret_key are Khalti's official sandbox keys.
KHALTI_PUBLIC_KEY = os.environ.get("KHALTI_PUBLIC_KEY", "")
KHALTI_SECRET_KEY = os.environ.get("KHALTI_SECRET_KEY", "")
KHALTI_BASE_URL   = os.environ.get("KHALTI_BASE_URL", "https://a.khalti.com")  # sandbox

FRONTEND_URL = os.environ.get("RHINOPEAK_FRONTEND_URL", "http://localhost:3000")
BACKEND_URL  = os.environ.get("RHINOPEAK_BACKEND_URL",  "http://localhost:8000")


# ─────────────────────────────────────────────────────────────────────────
# eSewa
# ─────────────────────────────────────────────────────────────────────────

def generate_esewa_signature(message: str, secret: str) -> str:
    """HMAC-SHA256 signature for eSewa v2 form submission."""
    key = secret.encode("utf-8")
    msg = message.encode("utf-8")
    return base64.b64encode(hmac.new(key, msg, hashlib.sha256).digest()).decode("utf-8")


def initiate_esewa_payment(transaction_uuid: str, amount: float, plan: str) -> dict[str, Any]:
    """
    Build eSewa v2 payment form payload for frontend auto-submit.

    The frontend posts this to eSewa's form URL and eSewa redirects the
    browser to success_url / failure_url after the user completes payment.
    """
    if not ESEWA_SECRET_KEY:
        return {
            "gateway":    "esewa",
            "mode":       "demo",
            "payment_url": f"{FRONTEND_URL}/billing?payment=esewa_demo&transaction={transaction_uuid}",
            "note":       "No ESEWA_SECRET_KEY set - demo mode. Set it before enabling live payments.",
        }

    total_amount = str(int(round(amount)))
    product_code = ESEWA_MERCHANT_CODE

    # eSewa v2: sign "total_amount,transaction_uuid,product_code"
    signed_message = f"total_amount={total_amount},transaction_uuid={transaction_uuid},product_code={product_code}"
    signature = generate_esewa_signature(signed_message, ESEWA_SECRET_KEY)

    return {
        "gateway":     "esewa",
        "mode":       "live",
        "form_url":   f"{ESEWA_BASE_URL}/api/epay/main/v2/form",
        "fields": {
            "amount":              total_amount,
            "tax_amount":          "0",
            "total_amount":        total_amount,
            "transaction_uuid":    transaction_uuid,
            "product_code":        product_code,
            "product_service_charge":  "0",
            "product_delivery_charge": "0",
            "success_url":  f"{BACKEND_URL}/api/payments/esewa/callback?plan={plan}",
            "failure_url":  f"{FRONTEND_URL}/billing?error=payment_failed",
            "signed_field_names": "total_amount,transaction_uuid,product_code",
            "signature":         signature,
        },
    }


def verify_esewa_payment(oid: str, amt: str, refId: str) -> dict[str, Any]:
    """
    Verify a completed eSewa payment via server-to-server API call.

    eSewa redirects the browser to success_url?oid=...&amt=...&refId=...
    We then call eSewa's verification endpoint to confirm the transaction
    is genuinely completed on their end before activating the plan.

    Args:
        oid:    Original transaction UUID (our payment session ID)
        amt:    Amount string as received in callback
        refId:  eSewa's transaction reference code

    Returns:
        {"success": True/False, "transaction_uuid": ..., "transaction_code": ..., "amount": ...}
    """
    if not ESEWA_SECRET_KEY or ESEWA_SECRET_KEY == "":
        # Demo mode — trust the callback params
        return {
            "success":          True,
            "mode":             "demo",
            "transaction_uuid": oid,
            "amount":           amt,
            "transaction_code": refId,
            "note":             "Demo mode — ESEWA_SECRET_KEY not set.",
        }

    # Build verification request per eSewa v2 API
    # The backend receives ?oid=...&amt=...&refId=... on success
    # We need to POST to eSewa's verify endpoint with: q=su, oid, amt, refId
    import urllib.request
    import urllib.error

    params = {
        "q":     "su",
        "oid":   oid,
        "amt":   amt,
        "refId": refId,
    }
    query = urlencode(params)
    verify_url = f"{ESEWA_BASE_URL}/api/epay/main/v2/form?{query}"

    try:
        req = urllib.request.Request(
            verify_url,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            result_text = resp.read().decode("utf-8")

        # eSewa returns XML: <response><response_code>Success</response_code>...</response>
        if "Success" in result_text:
            return {
                "success":          True,
                "transaction_uuid": oid,
                "amount":           amt,
                "transaction_code": refId,
            }
        else:
            return {
                "success": False,
                "error":   f"eSewa verify rejected: {result_text.strip()[:200]}",
            }
    except urllib.error.HTTPError as e:
        return {
            "success": False,
            "error":   f"HTTP {e.code}: {e.reason}",
        }
    except Exception as e:
        return {
            "success": False,
            "error":   str(e),
        }


def verify_esewa_callback(encoded_data: str) -> dict[str, Any]:
    """Verify the base64 JSON callback payload used by eSewa v2 redirects.

    Kept for compatibility with older call sites and tests while the newer
    server-to-server verification flow uses verify_esewa_payment().
    """
    if not ESEWA_SECRET_KEY:
        return {
            "success": False,
            "mode": "demo",
            "error": "ESEWA_SECRET_KEY is not configured.",
        }

    try:
        payload = json.loads(base64.b64decode(encoded_data).decode("utf-8"))
    except Exception:
        return {"success": False, "error": "Invalid eSewa callback payload."}

    signature = str(payload.get("signature", ""))
    signed_field_names = str(
        payload.get("signed_field_names", "total_amount,transaction_uuid,product_code")
    )
    signed_fields = [field.strip() for field in signed_field_names.split(",") if field.strip()]
    signed_message = ",".join(f"{field}={payload.get(field, '')}" for field in signed_fields)
    expected_signature = generate_esewa_signature(signed_message, ESEWA_SECRET_KEY)

    if not signature or not compare_digest(signature, expected_signature):
        return {"success": False, "error": "Invalid eSewa callback signature."}

    status = str(payload.get("status", "")).upper()
    if status and status not in {"COMPLETE", "COMPLETED", "SUCCESS"}:
        return {"success": False, "error": f"Unexpected eSewa status: {status}"}

    return {
        "success": True,
        "transaction_uuid": payload.get("transaction_uuid", ""),
        "amount": payload.get("total_amount", ""),
        "transaction_code": payload.get("transaction_code", payload.get("ref_id", "")),
        "payload": payload,
    }


# ─────────────────────────────────────────────────────────────────────────
# Khalti
# ─────────────────────────────────────────────────────────────────────────

def initiate_khalti_payment(
    transaction_uuid: str,
    amount: float,
    plan: str,
    customer_name: str = "",
    customer_email: str = "",
) -> dict[str, Any]:
    """
    Initiate Khalti payment session via their API.

    Returns {"payment_url": ..., "pidx": ...} on success.
    The frontend should redirect the user to payment_url.
    """
    if not KHALTI_SECRET_KEY:
        return {
            "gateway":    "khalti",
            "mode":       "demo",
            "payment_url": f"https://test-pay.khalti.com/?pidx=demo_{transaction_uuid}",
            "pidx":        f"demo_{transaction_uuid}",
            "note":        "No KHALTI_SECRET_KEY set — demo mode.",
        }

    import urllib.request
    import urllib.error

    payload = json.dumps({
        "return_url":        f"{FRONTEND_URL}/billing?payment=khalti_success",
        "website_url":       FRONTEND_URL,
        "amount":            int(amount * 100),   # Khalti: in paisa (1 NPR = 100 paisa)
        "purchase_order_id": transaction_uuid,
        "purchase_order_name": f"RhinoPeak {plan.title()} Plan",
        "customer_info": {
            "name":  customer_name or "RhinoPeak User",
            "email": customer_email or "user@rhinopeak.com",
        },
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{KHALTI_BASE_URL}/api/v2/epayment/initiate/",
        data=payload,
        headers={
            "Authorization": f"Key {KHALTI_SECRET_KEY}",
            "Content-Type":  "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode())
        return {
            "gateway":    "khalti",
            "mode":       "live",
            "payment_url": result.get("payment_url", ""),
            "pidx":        result.get("pidx", ""),
        }
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:300]
        return {"gateway": "khalti", "mode": "error", "error": f"HTTP {e.code}: {body}"}
    except Exception as e:
        return {"gateway": "khalti", "mode": "error", "error": str(e), "payment_url": ""}


def verify_khalti_payment(pidx: str, expected_amount: int | None = None) -> dict[str, Any]:
    """
    Verify a Khalti payment by pidx.

    Args:
        pidx:            Khalti's payment idx returned after user completes payment
        expected_amount: Optional paisa amount to cross-check (prevents verification
                         of tampered amounts if passed from the callback)

    Returns:
        {"success": True/False, "status": ..., "transaction_id": ..., "amount": ...}
    """
    if not KHALTI_SECRET_KEY or pidx.startswith("demo_"):
        return {
            "success":          True,
            "mode":             "demo",
            "transaction_uuid": pidx.removeprefix("demo_"),
            "note":             "Demo mode — KHALTI_SECRET_KEY not set.",
        }

    import urllib.request
    import urllib.error

    payload = json.dumps({"pidx": pidx}).encode("utf-8")
    req = urllib.request.Request(
        f"{KHALTI_BASE_URL}/api/v2/epayment/lookup/",
        data=payload,
        headers={
            "Authorization": f"Key {KHALTI_SECRET_KEY}",
            "Content-Type":  "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode())

        status = result.get("status", "")
        tx_amount = result.get("total_amount", 0)

        # Cross-check amount if provided
        if expected_amount is not None and int(tx_amount) != expected_amount:
            return {
                "success":  False,
                "error":    f"Amount mismatch: expected {expected_amount}, got {tx_amount}",
                "status":   status,
                "amount":   tx_amount,
            }

        return {
            "success":        status == "Completed",
            "status":         status,
            "transaction_id": result.get("transaction_id", ""),
            "amount":         tx_amount,
            "ref_id":         result.get("ref_id", ""),
            "mobile":        result.get("mobile", ""),
            "txn_uuid":       result.get("txn_uuid", ""),
        }
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:300]
        return {"success": False, "error": f"HTTP {e.code}: {body}"}
    except Exception as e:
        return {"success": False, "error": str(e)}
