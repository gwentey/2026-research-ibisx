"""Chat XAI v2 — contrat de blocs : parsing, anti-hallucination, fallback riche (CDC §6)."""

import json

import pytest
from pydantic import ValidationError

from ibis.modules.llm import client as llm_client
from ibis.modules.llm import xai_text
from ibis.modules.xai import blocks
from ibis.workers.tasks.explain import _answer_chat_blocks

CONTEXT = (
    "Algorithme : random_forest | Tâche : classification | Type d'explication : global\n"
    "Métriques réelles : accuracy=0.83, f1=0.77\n"
    "Importances (top) : revenu=0.41, age=0.19"
)

VALID_DOC = {
    "schema_version": 1,
    "blocks": [
        {"type": "paragraph", "text": "La variable ==revenu== pèse **0.41** dans la décision."},
        {
            "type": "table",
            "columns": ["Variable", "Poids", "Sens"],
            "rows": [
                [{"text": "revenu"}, {"text": "0.41"}, {"text": "favorable", "tone": "positive"}],
                [{"text": "age"}, {"text": "0.19"}, {"text": "défavorable", "tone": "negative"}],
            ],
        },
        {"type": "callout", "tone": "warning", "title": "Limite", "text": "Jeu de test limité."},
    ],
}


def _result(text: str) -> llm_client.LLMResult:
    return llm_client.LLMResult(text=text, model_used="test-model", tokens_used=42)


# ---------------------------------------------------------------- parsing / validation


def test_parse_valid_object() -> None:
    doc = blocks.parse_document(json.dumps(VALID_DOC))
    assert doc.schema_version == 1
    assert len(doc.blocks) == 3


def test_parse_strips_json_fences() -> None:
    raw = "```json\n" + json.dumps(VALID_DOC) + "\n```"
    doc = blocks.parse_document(raw)
    assert len(doc.blocks) == 3


def test_parse_wraps_bare_block_list() -> None:
    doc = blocks.parse_document(json.dumps(VALID_DOC["blocks"]))
    assert len(doc.blocks) == 3


def test_parse_ignores_extra_fields() -> None:
    payload = {"blocks": [{"type": "paragraph", "text": "ok", "color": "#f00"}]}
    doc = blocks.parse_document(json.dumps(payload))
    assert isinstance(doc.blocks[0], blocks.ParagraphBlock)


def test_parse_rejects_unknown_block_type() -> None:
    with pytest.raises(ValidationError):
        blocks.parse_document(json.dumps({"blocks": [{"type": "iframe", "src": "x"}]}))


def test_parse_rejects_non_json() -> None:
    with pytest.raises(ValueError):
        blocks.parse_document("désolé, je ne peux pas répondre en JSON")


# ---------------------------------------------------------------- extraction / miroir


def test_extract_text_covers_all_text_but_not_impact_weights() -> None:
    doc = blocks.parse_document(json.dumps(VALID_DOC))
    text = blocks.extract_text(doc)
    assert "revenu" in text and "0.41" in text and "Limite" in text

    impact = blocks.BlockDocument.model_validate(
        {"blocks": [{"type": "featureImpact", "items": [{"feature": "revenu", "weight": 0.999}]}]}
    )
    extracted = blocks.extract_text(impact)
    assert "revenu" in extracted
    assert "0.999" not in extracted  # poids d'affichage → hors anti-hallucination


def test_to_plain_text_is_readable_mirror() -> None:
    doc = blocks.parse_document(json.dumps(VALID_DOC))
    mirror = blocks.to_plain_text(doc)
    assert "revenu" in mirror and "Limite" in mirror


def test_document_round_trips_through_dump() -> None:
    doc = blocks.parse_document(json.dumps(VALID_DOC))
    again = blocks.parse_document(json.dumps(doc.model_dump(mode="json")))
    assert again.model_dump() == doc.model_dump()


# ---------------------------------------------------------------- fallback déterministe


def test_fallback_document_is_valid_and_grounded() -> None:
    doc = blocks.fallback_document(
        language="fr",
        metrics={"primary_metric": "accuracy", "accuracy": 0.83},
        importance=[{"feature": "revenu", "value": 0.41}, {"feature": "age", "value": 0.19}],
        task_type="classification",
        algorithm="random_forest",
    )
    assert isinstance(doc, blocks.BlockDocument)
    types = [b.type for b in doc.blocks]
    assert "paragraph" in types and "table" in types and "callout" in types
    # Chaque nombre du fallback existe dans un contexte bâti sur les mêmes valeurs.
    context = "accuracy=0.83, revenu=0.41, age=0.19"
    assert xai_text.numbers_exist_in_context(blocks.extract_text(doc), context) is True


def test_fallback_without_importance_stays_valid() -> None:
    doc = blocks.fallback_document(
        language="en",
        metrics={},
        importance=[],
        task_type="regression",
        algorithm="linear",
    )
    assert isinstance(doc, blocks.BlockDocument)
    assert any(b.type == "callout" for b in doc.blocks)


# ---------------------------------------------------------------- worker : chemins LLM


def _kwargs(complete):  # type: ignore[no-untyped-def]
    return dict(
        question="Pourquoi revenu ?",
        context=CONTEXT,
        history=[],
        language="fr",
        metrics={"primary_metric": "accuracy", "accuracy": 0.83},
        importance=[{"feature": "revenu", "value": 0.41}],
        task_type="classification",
        algorithm="random_forest",
    )


def test_worker_returns_blocks_when_valid(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(llm_client, "complete", lambda **_: _result(json.dumps(VALID_DOC)))
    payload = _answer_chat_blocks(**_kwargs(None))
    assert payload["is_fallback"] is False
    assert payload["blocks"]["blocks"][0]["type"] == "paragraph"
    assert "revenu" in payload["content"]


def test_worker_falls_back_on_hallucinated_number(monkeypatch: pytest.MonkeyPatch) -> None:
    bad = {"blocks": [{"type": "paragraph", "text": "Le score est 0.99 exactement."}]}
    monkeypatch.setattr(llm_client, "complete", lambda **_: _result(json.dumps(bad)))
    payload = _answer_chat_blocks(**_kwargs(None))
    assert payload["is_fallback"] is True  # 0.99 absent du contexte → 2 essais → fallback
    assert payload["blocks"]["blocks"]  # fallback riche = document valide


def test_worker_falls_back_on_invalid_json(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(llm_client, "complete", lambda **_: _result("pas du json"))
    payload = _answer_chat_blocks(**_kwargs(None))
    assert payload["is_fallback"] is True


def test_worker_falls_back_when_llm_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    def _raise(**_):  # type: ignore[no-untyped-def]
        raise llm_client.LLMUnavailable("no key")

    monkeypatch.setattr(llm_client, "complete", _raise)
    payload = _answer_chat_blocks(**_kwargs(None))
    assert payload["is_fallback"] is True
    assert payload["model_used"] == "fallback"


def test_worker_retries_then_succeeds(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = {"n": 0}

    def _complete(**_):  # type: ignore[no-untyped-def]
        calls["n"] += 1
        if calls["n"] == 1:
            return _result("garbage")  # 1er essai invalide
        return _result(json.dumps(VALID_DOC))  # 2e essai valide

    monkeypatch.setattr(llm_client, "complete", _complete)
    payload = _answer_chat_blocks(**_kwargs(None))
    assert payload["is_fallback"] is False
    assert calls["n"] == 2
