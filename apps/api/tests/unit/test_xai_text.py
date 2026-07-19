"""Adaptation au niveau (adaptatif §5) : prompts d'explication/chat et suggestions varient
selon l'audience, ancrés sur les vraies valeurs. Le repli riche (badgé « sans IA », P2) est
testé dans test_xai_blocks.py (fallback_document)."""

import re

from ibis.modules.llm import xai_text

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


def test_guard_accepts_percent_and_decimal_echo() -> None:
    ctx = _titanic_context()
    assert xai_text.numbers_exist_in_context("Le sexe pèse environ 24 % ici.", ctx) is True
    # Écho décimal d'un % affiché (24 → 0,24) : toléré via la symétrie ÷100.
    assert xai_text.numbers_exist_in_context("La part du sexe vaut 0,24 environ.", ctx) is True


def test_guard_still_rejects_foreign_numbers() -> None:
    ctx = _titanic_context()
    assert xai_text.numbers_exist_in_context("Le score magique est 0.37.", ctx) is False


def test_chat_prompt_v2_asks_to_quote_numbers_as_displayed() -> None:
    chat_fr = xai_text.chat_prompt_v2(question="q", context="ctx", history=[], language="fr")
    chat_en = xai_text.chat_prompt_v2(question="q", context="ctx", history=[], language="en")
    assert "tels qu'affichés" in chat_fr
    assert "as displayed" in chat_en


# ------------------------------- Explication v2 en blocs (CDC évolutions §2) ------------------


def test_explanation_system_v2_carries_grammar_and_honesty() -> None:
    system_fr = xai_text.explanation_system_v2("fr")
    assert "schema_version" in system_fr  # contrat de blocs (même grammaire que le chat)
    assert "INTERDIT" in system_fr  # anti-hallucination conservé
    system_en = xai_text.explanation_system_v2("en")
    assert "schema_version" in system_en and "FORBIDDEN" in system_en


def test_explanation_prompt_v2_varies_by_audience_and_quotes_format() -> None:
    novice = xai_text.explanation_prompt_v2(audience="novice", language="fr", context="ctx")
    expert = xai_text.explanation_prompt_v2(audience="expert", language="fr", context="ctx")
    assert novice != expert  # spec de niveau injectée (adaptatif §5.2)
    assert "tels qu'affichés" in novice
    en = xai_text.explanation_prompt_v2(audience="novice", language="en", context="ctx")
    assert "as displayed" in en


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
