"""Le client LLM adapte son payload aux modèles à raisonnement (gpt-5*) — ADR-006."""

import pytest

from ibis.core.config import Settings
from ibis.modules.llm import client


class _Resp:
    status_code = 200
    text = ""

    @staticmethod
    def json() -> dict:
        return {
            "choices": [{"message": {"content": "ok"}}],
            "model": "openai/gpt-5-mini",
            "usage": {"total_tokens": 5},
        }


def _capture(monkeypatch: pytest.MonkeyPatch, **settings_kwargs: object) -> dict:
    """Intercepte le payload envoyé à OpenRouter, avec une config injectée."""
    captured: dict = {}

    def fake_post(url, json, headers, timeout):  # type: ignore[no-untyped-def]
        captured.update(json)
        return _Resp()

    monkeypatch.setattr(
        client,
        "get_settings",
        lambda: Settings(_env_file=None, openrouter_api_key="k", **settings_kwargs),
    )
    monkeypatch.setattr(client.httpx, "post", fake_post)
    return captured


def test_classic_model_keeps_temperature_no_reasoning(monkeypatch: pytest.MonkeyPatch) -> None:
    # llm_reasoning_effort par défaut = "" → comportement historique inchangé.
    captured = _capture(monkeypatch)
    client.complete(system="s", user="u", max_tokens=700, json_mode=True)
    assert captured["temperature"] == 0.0
    assert captured["max_tokens"] == 700
    assert "reasoning" not in captured
    assert captured["response_format"] == {"type": "json_object"}


def test_reasoning_model_drops_temperature_and_floors_budget(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured = _capture(monkeypatch, llm_reasoning_effort="low", llm_max_tokens=3000)
    client.complete(system="s", user="u", max_tokens=700, json_mode=True)
    assert captured["reasoning"] == {"effort": "low"}
    assert "temperature" not in captured  # sinon 400 sur gpt-5*
    assert captured["max_tokens"] == 3000  # 700 relevé au plancher llm_max_tokens
