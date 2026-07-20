"""Guide IA v2 — document de blocs riches (même contrat que le copilote XAI)."""

from types import SimpleNamespace

from ibis.modules.llm import guides, xai_text
from ibis.modules.xai import blocks as rich


def _dataset(**overrides: object) -> SimpleNamespace:
    """Dataset factice minimal — seuls les attributs lus par `guides` sont nécessaires."""
    column = lambda name, dtype, pii=False: SimpleNamespace(  # noqa: E731
        name=name,
        dtype_interpreted=dtype,
        is_pii=pii,
        stats={"null_percentage": 0},
        example_values=["a", "b"],
    )
    base = {
        "display_name": "Abalone",
        "objective": "Estimer l'âge d'un ormeau",
        "domain": ["biology"],
        "task": ["regression"],
        "instances_number": 4177,
        "features_number": 9,
        "global_missing_percentage": 0.0,
        "files": [
            SimpleNamespace(
                columns=[
                    column("Sex", "categorical"),
                    column("Length", "numerical"),
                    column("Class_number_of_rings", "numerical"),
                    column("owner_email", "categorical", pii=True),
                ]
            )
        ],
    }
    return SimpleNamespace(**{**base, **overrides})


# ------------------------------------------------------------------ Grammaire de blocs


def test_guide_grammar_excludes_feature_impact() -> None:
    """Un dataset n'a pas de poids de variables : le bloc ne doit même pas être proposé."""
    system, _user = guides.build_prompt(_dataset(), "fr")
    assert "featureImpact" not in system
    assert '"type":"table"' in system and '"type":"keyValue"' in system
    # Les limites annoncées ne mentionnent plus les barres d'impact.
    assert "barres" not in system


def test_chat_grammar_still_exposes_feature_impact() -> None:
    """Le refactor de la grammaire ne doit rien retirer au chat/explication XAI."""
    assert "featureImpact" in xai_text.chat_system_v2("fr")
    assert "featureImpact" in xai_text.explanation_system_v2("en")


def test_guide_prompt_demands_the_four_sections() -> None:
    _system, user = guides.build_prompt(_dataset(), "fr")
    for title in guides.SECTION_TITLES["fr"]:
        assert title in user
    assert "4177" in user  # le contexte porte les vrais chiffres


# ------------------------------------------------------------------ Repli déterministe


def test_fallback_document_is_rich_and_valid() -> None:
    doc = guides.fallback_document(_dataset(), "fr")
    kinds = [block.type for block in doc.blocks]
    assert kinds.count("heading") == 4  # les 4 sections
    assert "keyValue" in kinds  # carte d'identité
    assert "table" in kinds  # colonnes cibles plausibles
    assert kinds[-1] == "callout"  # note d'honnêteté « sans IA »
    assert doc.blocks[-1].tone == "warning"


def test_fallback_document_reports_real_metadata() -> None:
    text = rich.to_plain_text(guides.fallback_document(_dataset(), "fr"))
    assert "4177" in text and "9" in text
    assert "owner_email" in text  # colonne PII réellement signalée
    assert "Estimer l'âge d'un ormeau" in text


def test_fallback_missing_values_tone_is_honest() -> None:
    """0 % de manquants = rassurant (positif) ; au-delà de 5 % = vigilance."""
    clean = guides.fallback_document(_dataset(global_missing_percentage=0.0), "fr")
    dirty = guides.fallback_document(_dataset(global_missing_percentage=12.5), "fr")
    tone_of = lambda doc: next(  # noqa: E731
        item.tone
        for block in doc.blocks
        if block.type == "keyValue"
        for item in block.items
        if "manquantes" in item.label
    )
    assert tone_of(clean) == "positive"
    assert tone_of(dirty) == "warning"


def test_fallback_without_files_does_not_crash() -> None:
    doc = guides.fallback_document(_dataset(files=[], task=[], objective=None), "fr")
    assert rich.to_plain_text(doc)


def test_fallback_english_uses_english_titles() -> None:
    text = rich.to_plain_text(guides.fallback_document(_dataset(), "en"))
    for title in guides.SECTION_TITLES["en"]:
        assert title in text


# ------------------------------------------------------------------ Garde-fou anti-hallucination


def test_thousands_separator_does_not_trigger_a_false_rejection() -> None:
    """« 4 177 lignes » ne doit PAS être lu comme les nombres 4 et 177 (repli à tort)."""
    context = "Lignes : 4177 · Colonnes : 9"
    doc = rich.BlockDocument(
        blocks=[rich.ParagraphBlock(type="paragraph", text="Le jeu compte 4 177 lignes.")]
    )
    assert guides.numbers_are_grounded(doc, context)
    # Contrôle : sans normalisation, le garde-fou brut rejette bien ce texte.
    assert not xai_text.numbers_exist_in_context("Le jeu compte 4 177 lignes.", context)


def test_invented_number_is_rejected() -> None:
    context = "Lignes : 4177 · Colonnes : 9"
    doc = rich.BlockDocument(
        blocks=[rich.ParagraphBlock(type="paragraph", text="Précision attendue de 87 %.")]
    )
    assert not guides.numbers_are_grounded(doc, context)


def test_normalize_thousands_handles_all_space_kinds() -> None:
    assert guides.normalize_thousands("4 177") == "4177"
    assert guides.normalize_thousands("4\xa0177") == "4177"
    assert guides.normalize_thousands("1 234 567") == "1234567"


# ------------------------------------------------------------------ Payload


def test_payload_carries_blocks_and_text_mirror() -> None:
    doc = guides.fallback_document(_dataset(), "fr")
    payload = guides.guide_payload(
        text=rich.to_plain_text(doc),
        blocks=doc.model_dump(mode="json"),
        model_used="fallback",
        is_fallback=True,
        language="fr",
        tokens_used=0,
    )
    assert payload["blocks"]["blocks"][0]["type"] == "heading"
    assert payload["text"]  # miroir texte conservé (copie / a11y / compat v1)
    assert payload["is_fallback"] is True
