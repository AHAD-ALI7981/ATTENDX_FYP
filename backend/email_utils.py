import os
import smtplib
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

def send_reset_email(to_email: str, reset_link: str):
    """
    Sends a password reset email. If SMTP credentials are not set,
    it gracefully falls back to logging the reset link to the console
    for secure development testing.
    """
    subject = "Password Reset Request - AI Attendance System"
    body = f"""Hello,

We received a request to reset your password for the AI Attendance System.

Please click the link below to securely reset your password. This link will expire in 15 minutes:
{reset_link}

If you did not request this, you can safely ignore this email.

Regards,
Admin Team
"""
    if SMTP_HOST and SMTP_USER and SMTP_PASSWORD:
        try:
            msg = EmailMessage()
            msg.set_content(body)
            msg["Subject"] = subject
            msg["From"] = SMTP_USER
            msg["To"] = to_email

            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(msg)
            print(f"Password reset email successfully sent to {to_email}")
        except Exception as e:
            print(f"Failed to send email via SMTP: {e}")
            # Fallback
            _log_reset_link(to_email, reset_link)
    else:
        # Fallback for development
        _log_reset_link(to_email, reset_link)

def _log_reset_link(to_email: str, reset_link: str):
    print("\n" + "="*50)
    print(f"DEVELOPMENT MODE: No SMTP credentials found.")
    print(f"Email intended for: {to_email}")
    print(f"Subject: Password Reset Request")
    print(f"Link: {reset_link}")
    print("="*50 + "\n")
