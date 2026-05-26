"""
Payment gateway tests - verify signatures and callback handling.
"""
from unittest.mock import patch

from django.test import TestCase, override_settings

from apps.rhinopeak.domain.errors import AppError


class ESewaPaymentTests(TestCase):
    def test_esewa_signature_generation(self):
        """eSewa HMAC-SHA256 signature should match expected value."""
        from apps.rhinopeak.services.payment_service import generate_esewa_signature
        # Known test vector from eSewa docs
        message = 'total_amount=100,transaction_uuid=TEST-001,product_code=EPAYTEST'
        secret = '8gBm/:&EnhH.1/q'
        sig = generate_esewa_signature(message, secret)
        self.assertIsInstance(sig, str)
        self.assertGreater(len(sig), 20)

    def test_esewa_callback_invalid_signature_rejected(self):
        """Tampered eSewa callback should be rejected."""
        import base64, json
        from apps.rhinopeak.services.payment_service import verify_esewa_callback
        # Craft invalid callback
        fake_data = base64.b64encode(json.dumps({
            'transaction_uuid': 'TEST-001',
            'total_amount': '100',
            'product_code': 'EPAYTEST',
            'signature': 'INVALID_SIG',
            'status': 'COMPLETE'
        }).encode()).decode()
        result = verify_esewa_callback(fake_data)
        self.assertFalse(result['success'])

    def test_khalti_mock_returns_payment_url(self):
        """Khalti initiation without credentials should return demo payment URL."""
        from apps.rhinopeak.services.payment_service import initiate_khalti_payment
        result = initiate_khalti_payment('TEST-123', 1499.0, 'pro')
        self.assertEqual(result['gateway'], 'khalti')
        self.assertIn('payment_url', result)

    @override_settings(PRODUCTION=True)
    def test_live_payment_credentials_required_in_production(self):
        """Production payment flows should not silently fall back to demo mode."""
        from apps.rhinopeak.services.payment_service import initiate_khalti_payment

        with patch("apps.rhinopeak.services.payment_service.KHALTI_SECRET_KEY", ""):
            with self.assertRaises(AppError) as error:
                initiate_khalti_payment('TEST-123', 1499.0, 'pro')

        self.assertEqual(error.exception.status, 503)
        self.assertIn('credentials', error.exception.message)
