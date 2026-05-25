# SMS Delivery Service — placeholder stubs for Nepal carriers
# TODO: implement real SMS sending for production use.
#
# Recommended providers for Nepal:
#   • Twilio (international, supports Nepal numbers)
#     Docs: https://www.twilio.com/docs/sms
#     Env:  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
#   • NTC Nepal Telecom SMS Gateway
#     Contact Nepal Telecom for API access credentials
#   • Sparrow SMS
#     Docs: https://sparrowsms.com/developers

import os
from typing import Optional

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER", "")


def _send_sms_via_twilio(to_phone: str, message: str) -> bool:
    """Send SMS via Twilio. Returns True on success, False on failure."""
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN or not TWILIO_FROM_NUMBER:
        print(f"[SMS] Twilio not configured. Would send to {to_phone}: {message[:80]}")
        return False

    try:
        from twilio.rest import Client

        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        client.messages.create(
            body=message,
            from_=TWILIO_FROM_NUMBER,
            to=to_phone,
        )
        print(f"[SMS] Sent to {to_phone}: {message[:80]}")
        return True
    except Exception as e:
        print(f"[SMS] Failed to send to {to_phone}: {e}")
        return False


def send_sms(to_phone: str, message: str) -> bool:
    """
    Dispatch SMS to the configured provider.
    Currently supports Twilio only; add more providers as needed.

    Args:
        to_phone: E.164 format (e.g., +97798xxxxxxxx)
        message: SMS body text (max 160 chars for single SMS)

    Returns:
        True if sent successfully, False otherwise.
    """
    return _send_sms_via_twilio(to_phone, message)


def send_payment_receipt_sms(to_phone: str, workspace_name: str, plan: str, amount: str) -> bool:
    """Send payment confirmation SMS after successful plan upgrade."""
    msg = f"RhinoPeak: Payment of NPR {amount} received for {workspace_name} ({plan} plan). Thank you!"
    return send_sms(to_phone, msg)


def send_team_invite_sms(to_phone: str, workspace_name: str, inviter_name: str) -> bool:
    """Send team invite via SMS as alternative to email."""
    msg = f"RhinoPeak: {inviter_name} invited you to join {workspace_name}. Log in to accept: https://app.rhinopeak.com/invite"
    return send_sms(to_phone, msg)