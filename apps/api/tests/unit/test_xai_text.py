"""Adaptation au niveau (adaptatif §5) : le repli d'explication, le chat et les suggestions
varient selon l'audience, tout en restant ancrés sur les vraies valeurs
et badgés « sans IA » (P2)."""

from ibis.modules.llm import xai_text

METRICS = {"primary_metric": "accuracy", "accuracy": 0.83}
IMPORTANCE = [{"feature": "revenu", "value": 0.41}, {"feature": "age", "value": 0.19}]


def _fallback(audience: str, language: str = "fr") -> str:
    return xai_text.fallback_text(
        audience=audience,
        language=language,
        metrics=METRICS,
        importance=IMPORTANCE,
        task_type="classification",
        algorithm="random_forest",
    )


def test_fallback_text_varies_by_audience() -> None:
    novice, intermediate, expert = (
        _fallback("novice"),
        _fallback("intermediate"),
        _fallback("expert"),
    )
    # Trois formulations distinctes (§5.3) — plus un texte unique servi à tous les niveaux.
    assert novice != intermediate and intermediate != expert and novice != expert
    # Toujours badgé « sans IA », quel que soit le niveau (P2).
    assert all("sans IA" in text for text in (novice, intermediate, expert))
    # Les vraies valeurs restent présentes (ancrage anti-hallucination) — la métrique principale.
    assert all("0.83" in text for text in (novice, intermediate, expert))


def test_fallback_text_novice_cites_fewer_variables() -> None:
    # Le novice reçoit l'essentiel : moins de variables citées que l'expert (charge cognitive,
    # Sweller 1988). L'analogie, elle, est volontaire — le novice n'est donc pas « plus court ».
    many = [{"feature": f"var{i}", "value": 0.5 - i * 0.05} for i in range(6)]

    def fb(audience: str) -> str:
        return xai_text.fallback_text(
            audience=audience,
            language="fr",
            metrics=METRICS,
            importance=many,
            task_type="classification",
            algorithm="random_forest",
        )

    novice_vars = sum(1 for i in range(6) if f"var{i}" in fb("novice"))
    expert_vars = sum(1 for i in range(6) if f"var{i}" in fb("expert"))
    assert novice_vars <= 3
    assert novice_vars < expert_vars


def test_chat_system_v2_injects_audience_directive() -> None:
    novice = xai_text.chat_system_v2("fr", "novice")
    expert = xai_text.chat_system_v2("fr", "expert")
    assert novice != expert
    # Le contrat de blocs (grammaire JSON) reste présent quel que soit le niveau.
    assert "schema_version" in novice and "schema_version" in expert
    # Novice = analogies/métaphores explicitement demandées.
    lowered = novice.lower()
    assert "analogie" in lowered or "métaphore" in lowered


def test_chat_prompt_v2_varies_by_audience() -> None:
    common = dict(question="Pourquoi revenu ?", context="ctx", history=[], language="fr")
    novice = xai_text.chat_prompt_v2(**common, audience="novice")
    expert = xai_text.chat_prompt_v2(**common, audience="expert")
    assert novice != expert


def test_suggested_questions_vary_by_audience_but_stay_four() -> None:
    default = xai_text.suggested_questions("classification", "fr")
    novice = xai_text.suggested_questions("classification", "fr", "novice")
    expert = xai_text.suggested_questions("classification", "fr", "expert")
    assert len(default) == 4 and len(novice) == 4 and len(expert) == 4
    assert novice != expert
