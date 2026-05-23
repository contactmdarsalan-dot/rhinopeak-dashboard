from __future__ import annotations
import os
import hashlib
import hmac
import base64
import json
from typing import Any
from hmac import compare_digest

# eSewa config
ESEWA_MERCHANT_CODE = os.environ.get('ESEWA_MERCHANT_CODE', 'EPAYTEST')  # EPAYTEST for sandbox
ESEWA_SECRET_KEY = os.environ.get('ESEWA_SECRET_KEY', '')
ESEWA_BASE_URL = os.environ.get('ESEWA_BASE_URL', 'https://rc-epay.esewa.com.np')  # rc = sandbox

# Khalti config
KHALTI_PUBLIC_KEY = os.environ.get('KHALTI_PUBLIC_KEY', '')
KHALTI_SECRET_KEY = os.environ.get('KHALTI_SECRET_KEY', '')
KHALTI_BASE_URL = os.environ.get('KHALTI_BASE_URL', 'https://a.khalti.com')  # sandbox

FRONTEND_URL = os.environ.get('RHINOPEAK_FRONTEND_URL', 'http://localhost:3000')
BACKEND_URL = os.environ.get('RHINOPEAK_BACKEND_URL', 'http://localhost:8000')


def generate_esewa_signature(message: str, secret: str) -> str:
    """Generate HMAC-SHA256 signature for eSewa v2."""
    key = secret.encode('utf-8')
    msg = message.encode('utf-8')
    signature = hmac.new(key, msg, hashlib.sha256).digest()
    return base64.b64encode(signature).decode('utf-8')


def initiate_esewa_payment(transaction_uuid: str, amount: float, plan: str) -> dict[str, Any]:
    """Create eSewa payment form data for frontend redirect."""
    if not ESEWA_SECRET_KEY:
        return {
            'gateway': 'esewa',
            'payment_url': f'{FRONTEND_URL}/billing?payment=esewa_demo&transaction={transaction_uuid}',
            'note': 'eSewa sandbox - configure ESEWA_SECRET_KEY to use real checkout'
        }

    total_amount = str(int(round(amount)))
    product_code = ESEWA_MERCHANT_CODE

    # eSewa v2 signature message format
    signed_message = f'total_amount={total_amount},transaction_uuid={transaction_uuid},product_code={product_code}'
    signature = generate_esewa_signature(signed_message, ESEWA_SECRET_KEY)

    return {
        'gateway': 'esewa',
        'form_url': f'{ESEWA_BASE_URL}/api/epay/main/v2/form',
        'fields': {
            'amount': total_amount,
            'tax_amount': '0',
            'total_amount': total_amount,
            'transaction_uuid': transaction_uuid,
            'product_code': product_code,
            'product_service_charge': '0',
            'product_delivery_charge': '0',
            'success_url': f'{BACKEND_URL}/api/payments/esewa/callback?plan={plan}',
            'failure_url': f'{FRONTEND_URL}/billing?error=payment_failed',
            'signed_field_names': 'total_amount,transaction_uuid,product_code',
            'signature': signature,
        }
    }


def verify_esewa_callback(data: str) -> dict[str, Any]:
    """Verify eSewa payment callback response."""
    try:
        decoded = json.loads(base64.b64decode(data).decode('utf-8'))
        transaction_uuid = decoded.get('transaction_uuid', '')
        total_amount = decoded.get('total_amount', '')
        product_code = decoded.get('product_code', ESEWA_MERCHANT_CODE)
        signature = decoded.get('signature', '')
        status = decoded.get('status', '')

        # Verify signature
        signed_message = f'total_amount={total_amount},transaction_uuid={transaction_uuid},product_code={product_code}'
        expected_sig = generate_esewa_signature(signed_message, ESEWA_SECRET_KEY)

        if not compare_digest(signature, expected_sig):
            return {'success': False, 'error': 'Invalid signature'}

        if status != 'COMPLETE':
            return {'success': False, 'error': f'Payment not complete: {status}'}

        return {
            'success': True,
            'transaction_uuid': transaction_uuid,
            'amount': total_amount,
            'transaction_code': decoded.get('transaction_code', ''),
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}


def initiate_khalti_payment(
    transaction_uuid: str,
    amount: float,
    plan: str,
    customer_name: str = '',
    customer_email: str = '',
) -> dict[str, Any]:
    """Initiate Khalti payment session."""
    import urllib.request
    import urllib.error

    if not KHALTI_SECRET_KEY:
        # Return mock for testing without credentials
        return {
            'gateway': 'khalti',
            'payment_url': f'https://test-pay.khalti.com/?pidx=demo_{transaction_uuid}',
            'pidx': f'demo_{transaction_uuid}',
            'note': 'Khalti sandbox - configure KHALTI_SECRET_KEY to use real API'
        }

    payload = json.dumps({
        'return_url': f'{FRONTEND_URL}/billing?payment=khalti_success',
        'website_url': FRONTEND_URL,
        'amount': int(amount * 100),  # in paisa
        'purchase_order_id': transaction_uuid,
        'purchase_order_name': f'RhinoPeak {plan.title()} Plan',
        'customer_info': {
            'name': customer_name or 'RhinoPeak User',
            'email': customer_email or 'user@rhinopeak.com',
        }
    }).encode('utf-8')

    req = urllib.request.Request(
        f'{KHALTI_BASE_URL}/api/v2/epayment/initiate/',
        data=payload,
        headers={
            'Authorization': f'Key {KHALTI_SECRET_KEY}',
            'Content-Type': 'application/json',
        },
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            result = json.loads(response.read().decode())
            return {
                'gateway': 'khalti',
                'payment_url': result.get('payment_url', ''),
                'pidx': result.get('pidx', ''),
            }
    except Exception as e:
        return {'gateway': 'khalti', 'error': str(e), 'payment_url': ''}


def verify_khalti_payment(pidx: str) -> dict[str, Any]:
    """Verify Khalti payment by pidx."""
    import urllib.request

    if not KHALTI_SECRET_KEY or pidx.startswith('demo_'):
        return {'success': True, 'note': 'Demo mode - no real verification'}

    payload = json.dumps({'pidx': pidx}).encode('utf-8')
    req = urllib.request.Request(
        f'{KHALTI_BASE_URL}/api/v2/epayment/lookup/',
        data=payload,
        headers={
            'Authorization': f'Key {KHALTI_SECRET_KEY}',
            'Content-Type': 'application/json',
        },
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            result = json.loads(response.read().decode())
            status = result.get('status', '')
            return {
                'success': status == 'Completed',
                'status': status,
                'transaction_id': result.get('transaction_id', ''),
                'amount': result.get('total_amount', 0),
            }
    except Exception as e:
        return {'success': False, 'error': str(e)}
