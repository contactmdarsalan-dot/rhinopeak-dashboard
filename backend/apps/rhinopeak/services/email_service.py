import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from html import escape
import logging
import os

BREVO_SMTP_HOST = os.environ.get('BREVO_SMTP_HOST', 'smtp-relay.brevo.com')
BREVO_SMTP_PORT = int(os.environ.get('BREVO_SMTP_PORT', '587'))
BREVO_SMTP_USER = os.environ.get('BREVO_SMTP_USER', '')
BREVO_SMTP_PASS = os.environ.get('BREVO_SMTP_PASS', '')
FROM_EMAIL = os.environ.get('RHINOPEAK_FROM_EMAIL', 'noreply@rhinopeak.com')
FROM_NAME = os.environ.get('RHINOPEAK_FROM_NAME', 'RhinoPeak Business')
FRONTEND_URL = os.environ.get('RHINOPEAK_FRONTEND_URL', 'http://localhost:3000')
logger = logging.getLogger(__name__)


def _send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send email via Brevo SMTP. Returns True on success, False on failure."""
    if not BREVO_SMTP_USER or not BREVO_SMTP_PASS:
        logger.warning("SMTP not configured; skipped email.", extra={"to_email": to_email, "subject": subject})
        return False
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f'{FROM_NAME} <{FROM_EMAIL}>'
        msg['To'] = to_email
        msg.attach(MIMEText(html_body, 'html'))
        with smtplib.SMTP(BREVO_SMTP_HOST, BREVO_SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(BREVO_SMTP_USER, BREVO_SMTP_PASS)
            server.sendmail(FROM_EMAIL, to_email, msg.as_string())
        logger.info("Email sent.", extra={"to_email": to_email, "subject": subject})
        return True
    except Exception as e:
        logger.warning("Email send failed.", extra={"to_email": to_email, "subject": subject, "error": str(e)})
        return False


def send_password_reset(email: str, reset_token: str, user_name: str = '') -> bool:
    subject = 'Reset your RhinoPeak password'
    reset_url = f'{FRONTEND_URL}/login?reset_token={reset_token}'
    safe_user = escape(user_name or email)
    safe_token = escape(reset_token)
    safe_url = escape(reset_url, quote=True)
    html = f'''
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:40px auto;padding:32px;background:#f9fafb;border-radius:16px;border:1px solid #e5e7eb">
      <h1 style="font-size:24px;font-weight:700;color:#111827;margin-bottom:8px">Password Reset</h1>
      <p style="color:#6b7280;font-size:14px;margin-bottom:24px">Hi {safe_user}, use the code below to reset your password. It expires in 15 minutes.</p>
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
        <p style="font-size:13px;color:#6b7280;margin-bottom:8px">Your reset code</p>
        <p style="font-size:32px;font-weight:800;color:#1B4FD8;letter-spacing:4px">{safe_token}</p>
      </div>
      <a href="{safe_url}" style="display:inline-block;background:#1B4FD8;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none">Reset Password</a>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">If you did not request this, ignore this email.</p>
    </div>
    '''
    return _send_email(email, subject, html)


def send_team_invite(email: str, workspace_name: str, inviter_name: str, role: str, invite_token: str) -> bool:
    subject = f'You are invited to join {workspace_name} on RhinoPeak'
    accept_url = f'{FRONTEND_URL}/invite/{invite_token}'
    safe_workspace = escape(workspace_name)
    safe_inviter = escape(inviter_name)
    safe_role = escape(role)
    safe_url = escape(accept_url, quote=True)
    html = f'''
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:40px auto;padding:32px;background:#f9fafb;border-radius:16px;border:1px solid #e5e7eb">
      <h1 style="font-size:24px;font-weight:700;color:#111827;margin-bottom:8px">Team Invitation</h1>
      <p style="color:#6b7280;font-size:14px;margin-bottom:24px">{safe_inviter} has invited you to join <strong>{safe_workspace}</strong> as <strong>{safe_role}</strong>.</p>
      <a href="{safe_url}" style="display:inline-block;background:#1B4FD8;color:#fff;font-weight:700;font-size:14px;padding:14px 28px;border-radius:10px;text-decoration:none">Accept Invitation</a>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">This invitation expires in 48 hours.</p>
    </div>
    '''
    return _send_email(email, subject, html)


def send_billing_notice(email: str, workspace_name: str, plan: str, expiry_date: str) -> bool:
    subject = f'Your RhinoPeak {plan} plan expires soon'
    safe_workspace = escape(workspace_name)
    safe_plan = escape(plan)
    safe_expiry = escape(expiry_date)
    safe_billing_url = escape(f'{FRONTEND_URL}/billing', quote=True)
    html = f'''
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:40px auto;padding:32px;background:#f9fafb;border-radius:16px;border:1px solid #e5e7eb">
      <h1 style="font-size:24px;font-weight:700;color:#111827;margin-bottom:8px">Billing Notice</h1>
      <p style="color:#6b7280;font-size:14px;margin-bottom:24px">Your <strong>{safe_plan}</strong> plan for <strong>{safe_workspace}</strong> expires on <strong>{safe_expiry}</strong>.</p>
      <a href="{safe_billing_url}" style="display:inline-block;background:#1B4FD8;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none">Manage Billing</a>
    </div>
    '''
    return _send_email(email, subject, html)
