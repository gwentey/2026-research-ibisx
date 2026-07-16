"""Envoi d'emails (SMTP configurable) — en dev sans SMTP, le contenu est loggé (CDC §4.1)."""

import smtplib
from email.message import EmailMessage

from ibis.core.config import get_settings
from ibis.core.logging import get_logger

logger = get_logger(__name__)


def send_email(*, to: str, subject: str, body: str) -> None:
    settings = get_settings()
    if not settings.smtp_host:
        # Pas de SMTP : on logge (lisible en dev via `docker compose logs api`)
        logger.info("mailer.dev_output", to=to, subject=subject, body=body)
        return

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
        smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)
    logger.info("mailer.sent", to=to, subject=subject)
