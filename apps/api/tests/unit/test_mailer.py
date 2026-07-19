"""Fallback sans SMTP : le corps de l'email ne doit jamais fuiter dans les logs en production.

Le corps de l'email de réinitialisation porte un lien valable 1 h : quiconque lit les
logs pourrait prendre le contrôle du compte. Hors production le fallback reste loggé
(pratique en dev), en production il est réduit à un avertissement sans secret.
"""

import uuid
from typing import Any

import pytest

from ibis.core import mailer
from ibis.core.config import Settings

RESET_TOKEN = "s3cr3t-reset-token"
RESET_BODY = (
    "Pour définir un nouveau mot de passe, ouvrez ce lien (valable 1 h) :\n"
    f"/reset-password?token={RESET_TOKEN}\n"
)
RECIPIENT = "alice@example.test"
USER_ID = uuid.UUID("11111111-2222-3333-4444-555555555555")


class _RecordingLogger:
    """Capture ce qui est réellement passé au logger (indépendant des processors)."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, str, dict[str, Any]]] = []

    def info(self, event: str, **kwargs: Any) -> None:
        self.calls.append(("info", event, kwargs))

    def warning(self, event: str, **kwargs: Any) -> None:
        self.calls.append(("warning", event, kwargs))


@pytest.fixture()
def recorded(monkeypatch: pytest.MonkeyPatch) -> _RecordingLogger:
    logger = _RecordingLogger()
    monkeypatch.setattr(mailer, "logger", logger)
    return logger


def _use_environment(monkeypatch: pytest.MonkeyPatch, environment: str) -> None:
    settings = Settings(_env_file=None, environment=environment, smtp_host="")
    monkeypatch.setattr(mailer, "get_settings", lambda: settings)


def _send() -> None:
    mailer.send_email(
        to=RECIPIENT,
        subject="IBIS-X — Réinitialisation de votre mot de passe",
        body=RESET_BODY,
        user_id=USER_ID,
    )


def test_production_without_smtp_never_logs_body(
    monkeypatch: pytest.MonkeyPatch, recorded: _RecordingLogger
) -> None:
    _use_environment(monkeypatch, "production")

    _send()

    assert len(recorded.calls) == 1
    level, event, kwargs = recorded.calls[0]
    assert (level, event) == ("warning", "mailer.not_configured")
    assert kwargs["user_id"] == str(USER_ID)

    logged = repr(recorded.calls)
    assert RESET_TOKEN not in logged
    assert RESET_BODY not in logged
    assert RECIPIENT not in logged


def test_dev_without_smtp_still_logs_the_link(
    monkeypatch: pytest.MonkeyPatch, recorded: _RecordingLogger
) -> None:
    _use_environment(monkeypatch, "dev")

    _send()

    assert len(recorded.calls) == 1
    level, event, kwargs = recorded.calls[0]
    assert (level, event) == ("info", "mailer.dev_output")
    assert RESET_TOKEN in kwargs["body"]
    assert kwargs["to"] == RECIPIENT
