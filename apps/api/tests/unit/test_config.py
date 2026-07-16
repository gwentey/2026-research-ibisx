"""La configuration vient de l'environnement — aucun quota en dur (CDC §3.3)."""

from ibis.core.config import Settings


def test_defaults_match_cdc() -> None:
    s = Settings(_env_file=None)
    assert s.access_token_minutes == 30
    assert s.refresh_token_days == 7
    assert s.max_concurrent_trainings == 3
    assert s.max_daily_trainings == 20
    assert s.default_credits == 100
    assert s.max_chat_questions == 5
    assert s.storage_backend == "local"
    assert s.llm_model.startswith("openai/")


def test_env_overrides(monkeypatch: object) -> None:
    import os

    os.environ["MAX_CONCURRENT_TRAININGS"] = "7"
    try:
        assert Settings(_env_file=None).max_concurrent_trainings == 7
    finally:
        del os.environ["MAX_CONCURRENT_TRAININGS"]
