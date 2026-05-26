from __future__ import annotations

import logging
import os

from django.conf import settings

logger = logging.getLogger(__name__)

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER", "")
SMS_PROVIDER = os.environ.get("RHINOPEAK_SMS_PROVIDER", "twilio").strip().lower()


def sms_configured() -> bool:
    """Return True when a production SMS provider is ready."""
    if SMS_PROVIDER != "twilio":
        return False
    return bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER)


def _send_sms_via_twilio(to_phone: str, message: str) -> bool:
    if not sms_configured():
        logger.warning(
            "SMS provider is not configured.",
            extra={"provider": SMS_PROVIDER, "production": getattr(settings, "PRODUCTION", False)},
        )
        return False

    try:
        from twilio.rest import Client

        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        client.messages.create(
            body=message,
            from_=TWILIO_FROM_NUMBER,
            to=to_phone,
        )
        logger.info("SMS sent.", extra={"provider": "twilio", "to_phone": to_phone[-4:]})
        return True
    except Exception as error:
        logger.exception(
            "SMS delivery failed.",
            extra={"provider": "twilio", "to_phone": to_phone[-4:], "error_type": type(error).__name__},
        )
        return False


def send_sms(to_phone: str, message: str) -> bool:
    """
    Dispatch SMS to the configured provider.

    The service returns False when credentials are missing so product flows can
    fall back to email or in-app notifications without crashing user actions.
    """
    clean_phone = str(to_phone or "").strip()
    clean_message = str(message or "").strip()
    if not clean_phone or not clean_message:
        logger.warning("SMS skipped because phone or message was empty.")
        return False
    if SMS_PROVIDER == "twilio":
        return _send_sms_via_twilio(clean_phone, clean_message[:1600])
    logger.error("Unsupported SMS provider configured.", extra={"provider": SMS_PROVIDER})
    return False


def send_payment_receipt_sms(to_phone: str, workspace_name: str, plan: str, amount: str) -> bool:
    msg = f"RhinoPeak: Payment of NPR {amount} received for {workspace_name} ({plan} plan). Thank you!"
    return send_sms(to_phone, msg)


def send_team_invite_sms(to_phone: str, workspace_name: str, inviter_name: str) -> bool:
    msg = f"RhinoPeak: {inviter_name} invited you to join {workspace_name}. Log in to accept: https://app.rhinopeak.com/invite"
    return send_sms(to_phone, msg)
