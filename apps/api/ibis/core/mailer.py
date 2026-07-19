"""Envoi d'emails (SMTP configurable).

Sans SMTP configuré, le comportement dépend de l'environnement :
- hors production, le contenu est loggé pour rester utilisable en dev (CDC §4.1) ;
- en production, seul un avertissement est loggé — jamais le corps, qui peut
  contenir un lien de réinitialisation exploitable (ARCH §13, aucune PII ni
  secret dans les logs).
"""

import smtplib
import uuid
from email.message import EmailMessage

from ibis.core.config import get_settings
from ibis.core.logging import get_logger

logger = get_logger(__name__)


def send_email(*, to: str, subject: str, body: str, user_id: uuid.UUID | None = None) -> None:
    settings = get_settings()
    if not settings.smtp_host:
        if settings.is_production:
            # Le corps porte des secrets (lien de reset valable 1 h) : on n'en logge rien.
            logger.warning(
                "mailer.not_configured",
                reason="e-mail non envoyé : SMTP non configuré",
                user_id=str(user_id) if user_id is not None else None,
            )
            return
        # Hors production uniquement : lisible via `docker compose logs api`.
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
