import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os

BREVO_SMTP_HOST = os.environ.get('BREVO_SMTP_HOST', 'smtp-relay.brevo.com')
BREVO_SMTP_PORT = int(os.environ.get('BREVO_SMTP_PORT', '587'))
BREVO_SMTP_USER = os.environ.get('BREVO_SMTP_USER', '')
BREVO_SMTP_PASS = os.environ.get('BREVO_SMTP_PASS', '')
FROM_EMAIL = os.environ.get('RHINOPEAK_FROM_EMAIL', 'noreply@rhinopeak.com')
FROM_NAME = os.environ.get('RHINOPEAK_FROM_NAME', 'RhinoPeak Business')
FRONTEND_URL = os.environ.get('RHINOPEAK_FRONTEND_URL', 'http://localhost:3000')


def _send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send email via Brevo SMTP. Returns True on success, False on failure."""
    if not BREVO_SMTP_USER or not BREVO_SMTP_PASS:
        # Log but don't crash - email is optional in dev
        print(f'[Email] SMTP not configured. Would send to {to_email}: {subject}')
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
        print(f'[Email] Sent to {to_email}: {subject}')
        return True
    except Exception as e:
        print(f'[Email] Failed to send to {to_email}: {e}')
        return False


def send_password_reset(email: str, reset_token: str, user_name: str = '') -> bool:
    subject = 'Reset your RhinoPeak password'
    reset_url = f'{FRONTEND_URL}/login?reset_token={reset_token}'
    html = f'''
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:40px auto;padding:32px;background:#f9fafb;border-radius:16px;border:1px solid #e5e7eb">
      <h1 style="font-size:24px;font-weight:700;color:#111827;margin-bottom:8px">Password Reset</h1>
      <p style="color:#6b7280;font-size:14px;margin-bottom:24px">Hi {user_name or email}, use the code below to reset your password. It expires in 15 minutes.</p>
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
        <p style="font-size:13px;color:#6b7280;margin-bottom:8px">Your reset code</p>
        <p style="font-size:32px;font-weight:800;color:#1B4FD8;letter-spacing:4px">{reset_token}</p>
      </div>
      <a href="{reset_url}" style="display:inline-block;background:#1B4FD8;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none">Reset Password</a>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">If you did not request this, ignore this email.</p>
    </div>
    '''
    return _send_email(email, subject, html)


def send_team_invite(email: str, workspace_name: str, inviter_name: str, role: str, invite_token: str) -> bool:
    subject = f'You are invited to join {workspace_name} on RhinoPeak'
    accept_url = f'{FRONTEND_URL}/invite/{invite_token}'
    html = f'''
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:40px auto;padding:32px;background:#f9fafb;border-radius:16px;border:1px solid #e5e7eb">
      <h1 style="font-size:24px;font-weight:700;color:#111827;margin-bottom:8px">Team Invitation</h1>
      <p style="color:#6b7280;font-size:14px;margin-bottom:24px">{inviter_name} has invited you to join <strong>{workspace_name}</strong> as <strong>{role}</strong>.</p>
      <a href="{accept_url}" style="display:inline-block;background:#1B4FD8;color:#fff;font-weight:700;font-size:14px;padding:14px 28px;border-radius:10px;text-decoration:none">Accept Invitation</a>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">This invitation expires in 48 hours.</p>
    </div>
    '''
    return _send_email(email, subject, html)


def send_billing_notice(email: str, workspace_name: str, plan: str, expiry_date: str) -> bool:
    subject = f'Your RhinoPeak {plan} plan expires soon'
    html = f'''
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:40px auto;padding:32px;background:#f9fafb;border-radius:16px;border:1px solid #e5e7eb">
      <h1 style="font-size:24px;font-weight:700;color:#111827;margin-bottom:8px">Billing Notice</h1>
      <p style="color:#6b7280;font-size:14px;margin-bottom:24px">Your <strong>{plan}</strong> plan for <strong>{workspace_name}</strong> expires on <strong>{expiry_date}</strong>.</p>
      <a href="http://localhost:3000/billing" style="display:inline-block;background:#1B4FD8;color:#fff;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;text-decoration:none">Manage Billing</a>
    </div>
    '''
    return _send_email(email, subject, html)
