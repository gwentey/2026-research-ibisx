"""Adaptation au niveau (adaptatif §5) : le repli d'explication, le chat et les suggestions
varient selon l'audience, tout en restant ancrés sur les vraies valeurs
et badgés « sans IA » (P2)."""

import re

from ibis.modules.llm import xai_text

METRICS = {"primary_metric": "accuracy", "accuracy": 0.83}
IMPORTANCE = [{"feature": "revenu", "value": 0.41}, {"feature": "age", "value": 0.19}]


# ------------------------------- Nombres lisibles (CDC évolutions §1) -------------------------


def test_humanize_feature_onehot() -> None:
    assert xai_text.humanize_feature("cat__Sex_female") == "Sex = female"
    assert xai_text.humanize_feature("cat__Embarked_S") == "Embarked = S"
    # Colonne snake_case : coupure au DERNIER « _ » (design D1).
    assert xai_text.humanize_feature("cat__niveau_etude_Bac") == "niveau etude = Bac"


def test_humanize_feature_numeric_ordinal_and_plain() -> None:
    assert xai_text.humanize_feature("num_median_0__Pclass") == "Pclass"
    assert xai_text.humanize_feature("num_mean_2__fare_amount") == "fare amount"
    assert xai_text.humanize_feature("cat__Sex") == "Sex"  # ordinal, pas de catégorie
    assert xai_text.humanize_feature("age") == "age"  # déjà lisible


def test_format_share_rounds_half_up_and_floors_dust() -> None:
    assert xai_text.format_share(0.242421, 1.0) == "24 %"
    assert xai_text.format_share(0.125, 1.0) == "13 %"  # demi-part vers le haut (12.5)
    assert xai_text.format_share(0.003, 1.0) == "<1 %"
    assert xai_text.format_share(-0.24, 1.0) == "24 %"  # magnitude
    assert xai_text.format_share(0.5, 0.0) == "0 %"  # total nul, jamais d'exception


TITANIC_IMPORTANCE = [
    {"feature": "cat__Sex_female", "value": 0.242421},
    {"feature": "num_median_0__Pclass", "value": 0.5},
    {"feature": "num_median_0__Fare", "value": 0.257579},
]


def _titanic_context() -> str:
    return xai_text.build_context(
        metrics={"primary_metric": "accuracy", "accuracy": 0.8324451, "f1": 0.77},
        importance=TITANIC_IMPORTANCE,
        task_type="classification",
        algorithm="random_forest",
        explanation_type="global",
        local_values=None,
    )


def test_build_context_shows_percents_not_raw_floats() -> None:
    ctx = _titanic_context()
    assert "0.242421" not in ctx  # plus jamais de float brut
    assert "cat__" not in ctx and "num_median_0__" not in ctx
    assert "Sex = female : 24 %" in ctx
    assert "accuracy=0.832" in ctx  # métrique arrondie 3 déc.


def test_build_context_percents_sum_to_about_100() -> None:
    line = next(
        ligne for ligne in _titanic_context().splitlines() if ligne.startswith("Importances")
    )
    percents = [int(m) for m in re.findall(r"(\d+) %", line)]
    assert len(percents) == 3
    assert 97 <= sum(percents) <= 103


def test_build_context_local_contributions_keep_direction() -> None:
    ctx = xai_text.build_context(
        metrics={"accuracy": 0.83},
        importance=[
            {"feature": "cat__Sex_female", "contribution": 0.3},
            {"feature": "num_median_0__Age", "contribution": -0.1},
        ],
        task_type="classification",
        algorithm="random_forest",
        explanation_type="local",
        local_values={
            "prediction": 0.8712345,
            "base_value": 0.62111,
            "predicted_label": "survived",
        },
    )
    assert "Sex = female : 75 % ↗" in ctx
    assert "Age : 25 % ↘" in ctx
    assert "0.871" in ctx and "0.621" in ctx  # valeurs locales arrondies 3 déc.


def test_fallback_text_humanizes_feature_names() -> None:
    text = xai_text.fallback_text(
        audience="novice",
        language="fr",
        metrics=METRICS,
        importance=TITANIC_IMPORTANCE,
        task_type="classification",
        algorithm="random_forest",
    )
    assert "cat__" not in text and "num_median_0__" not in text
    assert "Sex = female" in text


def test_guard_accepts_percent_and_decimal_echo() -> None:
    ctx = _titanic_context()
    assert xai_text.numbers_exist_in_context("Le sexe pèse environ 24 % ici.", ctx) is True
    # Écho décimal d'un % affiché (24 → 0,24) : toléré via la symétrie ÷100.
    assert xai_text.numbers_exist_in_context("La part du sexe vaut 0,24 environ.", ctx) is True


def test_guard_still_rejects_foreign_numbers() -> None:
    ctx = _titanic_context()
    assert xai_text.numbers_exist_in_context("Le score magique est 0.37.", ctx) is False


def test_prompts_ask_to_quote_numbers_as_displayed() -> None:
    _, user_fr = xai_text.build_prompt(audience="novice", language="fr", context="ctx")
    _, user_en = xai_text.build_prompt(audience="novice", language="en", context="ctx")
    assert "tels qu'affichés" in user_fr
    assert "as displayed" in user_en
    chat_fr = xai_text.chat_prompt_v2(question="q", context="ctx", history=[], language="fr")
    chat_en = xai_text.chat_prompt_v2(question="q", context="ctx", history=[], language="en")
    assert "tels qu'affichés" in chat_fr
    assert "as displayed" in chat_en


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


def test_suggested_questions_cite_top_feature_and_metric() -> None:
    questions = xai_text.suggested_questions(
        "classification",
        "fr",
        None,
        top_feature="Sex",
        metric_name="f1",
        metric_value=0.7324,
    )
    assert len(questions) == 4
    assert any("« Sex »" in q for q in questions)  # la vraie variable dominante
    assert any("f1" in q and "0.732" in q for q in questions)  # la vraie métrique, arrondie


def test_suggested_questions_novice_cite_context_in_plain_words() -> None:
    fr = xai_text.suggested_questions(
        "classification",
        "fr",
        "novice",
        top_feature="Sex",
        metric_name="accuracy",
        metric_value=0.83,
    )
    assert len(fr) == 4
    assert any("Sex" in q for q in fr)
    assert any("0.83" in q for q in fr)
    en = xai_text.suggested_questions(
        "classification",
        "en",
        "novice",
        top_feature="Sex",
        metric_name="accuracy",
        metric_value=0.83,
    )
    assert len(en) == 4
    assert any("Sex" in q for q in en)


def test_suggested_questions_stay_generic_without_context() -> None:
    # Sans explication terminée (pas de top feature/métrique) : questions génériques valides.
    questions = xai_text.suggested_questions("regression", "fr")
    assert len(questions) == 4
    assert all("None" not in q for q in questions)
