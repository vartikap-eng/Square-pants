"""
Gmail SMTP email sending + IMAP reply polling.
"""

import smtplib
import imaplib
import email as email_lib
import uuid
import logging
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.header import decode_header
from typing import Optional

from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _is_configured() -> bool:
    return bool(settings.smtp_user and settings.smtp_password)


def build_message_id(prospect_id: int, activity_id: int) -> str:
    """Generate a unique Message-ID we can track later."""
    token = uuid.uuid4().hex[:8]
    domain = settings.smtp_user.split("@")[-1] if "@" in settings.smtp_user else "mail.local"
    return f"<lead.{prospect_id}.{activity_id}.{token}@{domain}>"


def send_email(
    to_address: str,
    subject: str,
    body: str,
    prospect_id: int,
    activity_id: int,
    from_name: str = "Sales Team",
) -> tuple[bool, str, str]:
    """
    Send an email via Gmail SMTP.
    Returns (success, message_id, error_message).
    """
    if not _is_configured():
        return False, "", "SMTP not configured — add SMTP_USER and SMTP_PASSWORD to .env"

    from_display = settings.smtp_from or f"{from_name} <{settings.smtp_user}>"
    message_id = build_message_id(prospect_id, activity_id)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_display
    msg["To"] = to_address
    msg["Message-ID"] = message_id
    msg["X-Mailer"] = "ConferenceLeadPlatform/1.0"

    # Plain text part
    msg.attach(MIMEText(body, "plain", "utf-8"))

    # HTML part (convert newlines to <br>)
    html_body = "<br>".join(body.replace("\n\n", "<p>").split("\n"))
    msg.attach(MIMEText(f"<html><body><p>{html_body}</p></body></html>", "html", "utf-8"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_user, [to_address], msg.as_string())
        logger.info(f"Email sent to {to_address} with Message-ID {message_id}")
        return True, message_id, ""
    except smtplib.SMTPAuthenticationError:
        err = "Gmail authentication failed. Check SMTP_USER and SMTP_PASSWORD (use App Password, not login password)."
        logger.error(err)
        return False, "", err
    except smtplib.SMTPException as e:
        err = f"SMTP error: {str(e)}"
        logger.error(err)
        return False, "", err
    except Exception as e:
        err = f"Unexpected error sending email: {str(e)}"
        logger.error(err)
        return False, "", err


def check_replies(message_ids: list[str]) -> list[tuple[str, datetime]]:
    """
    Poll Gmail IMAP inbox for replies to any of the given Message-IDs.
    Returns list of (message_id, replied_at) for each reply found.
    Uses the same credentials as SMTP.

    Gmail stores sent emails in [Gmail]/Sent; replies arrive in INBOX.
    We match by In-Reply-To or References header.
    """
    imap_user = settings.imap_user or settings.smtp_user
    imap_pass = settings.imap_password or settings.smtp_password

    if not imap_user or not imap_pass:
        return []

    if not message_ids:
        return []

    replied: list[tuple[str, datetime]] = []

    try:
        mail = imaplib.IMAP4_SSL(settings.imap_host)
        mail.login(imap_user, imap_pass)
        mail.select("INBOX")

        # Search all messages (could optimise with UNSEEN or date range)
        _, data = mail.search(None, "ALL")
        if not data or not data[0]:
            mail.logout()
            return []

        uid_list = data[0].split()
        # Only check the last 200 emails to keep it fast
        uid_list = uid_list[-200:]

        # Build a set for O(1) lookup
        tracked = set(message_ids)

        for uid in uid_list:
            try:
                _, msg_data = mail.fetch(uid, "(BODY.PEEK[HEADER.FIELDS (IN-REPLY-TO REFERENCES DATE)])")
                if not msg_data or not msg_data[0]:
                    continue

                raw_header = msg_data[0][1]
                if isinstance(raw_header, bytes):
                    raw_header = raw_header.decode("utf-8", errors="replace")

                # Parse headers
                parsed = email_lib.message_from_string(raw_header)
                in_reply_to = parsed.get("In-Reply-To", "")
                references = parsed.get("References", "")
                date_str = parsed.get("Date", "")

                # Check if this email is a reply to any of our tracked messages
                combined = f"{in_reply_to} {references}"
                matched_id = next((mid for mid in tracked if mid in combined), None)

                if matched_id:
                    # Parse the reply date
                    try:
                        from email.utils import parsedate_to_datetime
                        replied_at = parsedate_to_datetime(date_str)
                    except Exception:
                        replied_at = datetime.utcnow()

                    replied.append((matched_id, replied_at))

            except Exception:
                continue

        mail.logout()

    except imaplib.IMAP4.error as e:
        logger.error(f"IMAP error: {e}")
    except Exception as e:
        logger.error(f"Reply check error: {e}")

    return replied
