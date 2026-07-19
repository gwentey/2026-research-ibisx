"""Guide IA d'un dataset (CDC §5.4.4) : prompt sur données réelles + repli déterministe.

v2 — le guide n'est plus un bloc de markdown mais un DOCUMENT DE BLOCS riches, exactement le
même contrat que le copilote XAI (`ibis.modules.xai.blocks`) : tableaux, tuiles clé/valeur,
callouts et tonalités sémantiques rendus par le kit côté web. Le champ `text` est conservé
(miroir lisible) pour la compatibilité des guides déjà en base et pour la copie / l'a11y.
"""

import re
from typing import Any

from ibis.modules.datasets.models import Dataset
from ibis.modules.llm import xai_text
from ibis.modules.xai import blocks as rich

# `featureImpact` est exclu de la grammaire : un dataset n'a pas de poids de variables
# calculés — le modèle en inventerait, et la validation anti-hallucination ignore les poids.
_EXCLUDED_BLOCKS = ("featureImpact",)

GUIDE_SYSTEM = {
    "fr": (
        "Tu es l'assistant pédagogique d'IBIS-X, une plateforme de Machine Learning pour "
        "non-experts. Tu rédiges des guides clairs, structurés en sections courtes, sans "
        "inventer AUCUNE information : appuie-toi exclusivement sur les métadonnées fournies. "
        "Si une information manque, dis-le explicitement."
    ),
    "en": (
        "You are the teaching assistant of IBIS-X, a Machine Learning platform for "
        "non-experts. You write clear guides in short sections, without inventing ANY "
        "information: rely exclusively on the provided metadata. If something is missing, "
        "say so explicitly."
    ),
}

# Plan de blocs imposé : les 4 sections historiques, mais chacune rendue avec le bloc qui la
# sert le mieux (tuiles pour la carte d'identité, tableau tonal pour les cibles, callout pour
# les précautions). C'est ce plan qui produit la richesse visuelle attendue.
GUIDE_INSTRUCTIONS = {
    "fr": (
        "Rédige le guide de ce jeu de données en 4 sections, chacune introduite par un bloc "
        '"heading" portant EXACTEMENT ce titre, dans cet ordre :\n'
        "① « À quoi sert ce dataset » — un paragraphe, puis un bloc keyValue « carte "
        "d'identité » (lignes, colonnes, valeurs manquantes, domaine). Tonalité des valeurs : "
        '"positive" si rassurant (aucune valeur manquante), "warning" si c\'est un point de '
        'vigilance, "accent" pour le chiffre clé.\n'
        "② « Colonnes cibles plausibles » — un tableau (colonnes : Colonne, Type, Pourquoi "
        'cette cible). Mets en tonalité "accent" la cible la plus plausible. Si aucune '
        "colonne cible ne se dégage, dis-le dans un paragraphe.\n"
        "③ « Tâches de ML adaptées » — un tableau (Tâche, Cible visée, Remarque) ou une "
        "liste si une seule tâche est déclarée.\n"
        "④ « Précautions » — une liste des points d'attention, puis un bloc callout de "
        'tonalité "warning" pour la limite la plus importante à retenir.\n'
        "12 blocs maximum, 320 mots au total. Recopie les nombres EXACTEMENT comme dans le "
        "contexte, sans séparateur de milliers et sans en dériver de nouveaux."
    ),
    "en": (
        "Write the guide for this dataset in 4 sections, each introduced by a \"heading\" "
        "block carrying EXACTLY this title, in this order:\n"
        "① “What this dataset is for” — one paragraph, then a keyValue “ID card” block "
        "(rows, columns, missing values, domain). Value tones: \"positive\" when reassuring "
        "(no missing values), \"warning\" for a point of caution, \"accent\" for the key "
        "figure.\n"
        "② “Plausible target columns” — a table (columns: Column, Type, Why this target). "
        'Use the "accent" tone for the most plausible target. If no target column stands '
        "out, say so in a paragraph.\n"
        "③ “Suitable ML tasks” — a table (Task, Target, Note) or a list if a single task is "
        "declared.\n"
        "④ “Precautions” — a list of watch-outs, then a \"warning\" callout block for the "
        "single most important limitation.\n"
        "12 blocks maximum, 320 words in total. Copy numbers EXACTLY as they appear in the "
        "context, without thousands separators, and never derive new ones."
    ),
}

# Titres de section (repli déterministe + assertions de test).
SECTION_TITLES = {
    "fr": [
        "À quoi sert ce dataset",
        "Colonnes cibles plausibles",
        "Tâches de ML adaptées",
        "Précautions",
    ],
    "en": [
        "What this dataset is for",
        "Plausible target columns",
        "Suitable ML tasks",
        "Precautions",
    ],
}


def dataset_context(dataset: Dataset) -> str:
    """Contexte factuel du prompt — uniquement des métadonnées réelles (P1)."""
    lines = [
        f"Nom : {dataset.display_name}",
        f"Objectif déclaré : {dataset.objective or 'non renseigné'}",
        f"Domaines : {', '.join(dataset.domain) or 'non renseignés'}",
        f"Tâches déclarées : {', '.join(dataset.task) or 'non renseignées'}",
        f"Lignes : {dataset.instances_number} · Colonnes : {dataset.features_number}",
        f"Valeurs manquantes : {dataset.global_missing_percentage}%",
    ]
    for file in dataset.files[:1]:
        lines.append("Colonnes :")
        for column in file.columns[:40]:
            pii = " [PII]" if column.is_pii else ""
            lines.append(
                f"- {column.name} ({column.dtype_interpreted}{pii}, "
                f"{column.stats.get('null_percentage', 0)}% nuls, "
                f"exemples : {', '.join(column.example_values[:3])})"
            )
    return "\n".join(lines)


def build_prompt(dataset: Dataset, language: str) -> tuple[str, str]:
    """System + user du guide v2 (contrat de blocs inclus dans le system)."""
    lang = "en" if language == "en" else "fr"
    system = GUIDE_SYSTEM[lang] + "\n\n" + xai_text.blocks_grammar(lang, exclude=_EXCLUDED_BLOCKS)
    return system, f"{GUIDE_INSTRUCTIONS[lang]}\n\nCONTEXTE :\n{dataset_context(dataset)}"


# ------------------------------------------------------------------ Garde-fou anti-hallucination

# Un séparateur de milliers (espace fine, insécable ou normale) coupe « 4 177 » en « 4 » + « 177 »
# pour NUMBER_RE : « 177 » serait alors jugé absent du contexte et un guide correct partirait en
# repli. On recolle les groupes de 3 chiffres avant la vérification.
_THOUSANDS_RE = re.compile(r"(\d)[\xa0\u202f ](\d{3})(?!\d)")


def normalize_thousands(text: str) -> str:
    """Recolle les séparateurs de milliers (« 4 177 » → « 4177 »), y compris en cascade."""
    previous = None
    while previous != text:
        previous = text
        text = _THOUSANDS_RE.sub(r"\1\2", text)
    return text


def numbers_are_grounded(doc: rich.BlockDocument, context: str) -> bool:
    """Tout nombre cité par le guide doit exister dans les métadonnées (P1)."""
    return xai_text.numbers_exist_in_context(
        normalize_thousands(rich.extract_text(doc)), normalize_thousands(context)
    )


# ------------------------------------------------------------------ Repli déterministe (P2)


def _columns_of(dataset: Dataset) -> list[Any]:
    return list(dataset.files[0].columns) if dataset.files else []


def _missing_tone(percentage: float | None) -> rich.Tone:
    """Tonalité honnête du taux de valeurs manquantes : rien à signaler → positif."""
    if not percentage:
        return "positive"
    return "warning" if percentage >= 5 else "neutral"


def fallback_document(dataset: Dataset, language: str) -> rich.BlockDocument:
    """Guide déterministe en blocs, construit sur les VRAIES métadonnées — badgé « sans IA ».

    Aucun appel LLM : mêmes sections et même richesse visuelle, uniquement des faits lus en base.
    """
    fr = language != "en"
    lang = "fr" if fr else "en"
    titles = SECTION_TITLES[lang]
    columns = _columns_of(dataset)
    categorical = [c.name for c in columns if c.dtype_interpreted in ("categorical", "boolean")]
    numerical = [c.name for c in columns if c.dtype_interpreted == "numerical"]
    pii = [c.name for c in columns if c.is_pii]
    missing = dataset.global_missing_percentage

    blocks: list[Any] = [
        rich.HeadingBlock(type="heading", text=titles[0]),
        rich.ParagraphBlock(
            type="paragraph",
            text=dataset.objective
            or ("Aucun objectif déclaré dans les métadonnées." if fr else "No stated objective."),
        ),
    ]

    # ① Carte d'identité — tuiles clé/valeur sur les seuls chiffres réellement stockés.
    id_card = [
        rich.KeyValueItem(
            label="Lignes" if fr else "Rows",
            value=str(dataset.instances_number),
            tone="accent",
        ),
        rich.KeyValueItem(
            label="Colonnes" if fr else "Columns", value=str(dataset.features_number)
        ),
        rich.KeyValueItem(
            label="Valeurs manquantes" if fr else "Missing values",
            value=f"{missing or 0}%",
            tone=_missing_tone(missing),
        ),
    ]
    if dataset.domain:
        id_card.append(
            rich.KeyValueItem(label="Domaine" if fr else "Domain", value=", ".join(dataset.domain))
        )
    blocks.append(rich.KeyValueBlock(type="keyValue", items=id_card))

    # ② Cibles plausibles — tableau ; la première candidate porte la tonalité « accent ».
    blocks.append(rich.HeadingBlock(type="heading", text=titles[1]))
    candidates = [(name, "categorical") for name in categorical[:3]]
    candidates += [(name, "numerical") for name in numerical[:3]]
    if candidates:
        kind_label = {
            "categorical": "Catégorielle" if fr else "Categorical",
            "numerical": "Numérique" if fr else "Numerical",
        }
        hint = {
            "categorical": "Classification",
            "numerical": "Régression" if fr else "Regression",
        }
        blocks.append(
            rich.TableBlock(
                type="table",
                columns=(
                    ["Colonne", "Type", "Piste"] if fr else ["Column", "Type", "Direction"]
                ),
                rows=[
                    [
                        rich.Cell(text=name, tone="accent" if index == 0 else "neutral"),
                        rich.Cell(text=kind_label[kind]),
                        rich.Cell(text=hint[kind]),
                    ]
                    for index, (name, kind) in enumerate(candidates[:6])
                ],
            )
        )
    else:
        blocks.append(
            rich.ParagraphBlock(
                type="paragraph",
                text=(
                    "Aucune colonne cible ne se dégage des métadonnées."
                    if fr
                    else "No target column stands out from the metadata."
                ),
            )
        )

    # ③ Tâches déclarées.
    blocks.append(rich.HeadingBlock(type="heading", text=titles[2]))
    if dataset.task:
        blocks.append(rich.ListBlock(type="list", items=list(dataset.task)[:12]))
    else:
        blocks.append(
            rich.ParagraphBlock(
                type="paragraph",
                text=(
                    "Aucune tâche déclarée dans les métadonnées."
                    if fr
                    else "No task declared in the metadata."
                ),
            )
        )

    # ④ Précautions — les points d'attention réels, puis la note d'honnêteté « sans IA ».
    blocks.append(rich.HeadingBlock(type="heading", text=titles[3]))
    watch: list[str] = []
    if missing:
        watch.append(
            f"Valeurs manquantes : {missing} % au global."
            if fr
            else f"Missing values: {missing}% overall."
        )
    if pii:
        watch.append(
            f"Colonnes signalées comme données personnelles : {', '.join(pii)}."
            if fr
            else f"Columns flagged as personal data: {', '.join(pii)}."
        )
    else:
        watch.append(
            "Aucune colonne signalée comme donnée personnelle."
            if fr
            else "No column flagged as personal data."
        )
    blocks.append(rich.ListBlock(type="list", items=watch[:12]))
    blocks.append(
        rich.CalloutBlock(
            type="callout",
            tone="warning",
            title="Guide généré sans IA" if fr else "Guide generated without AI",
            text=(
                "L'assistant est momentanément indisponible : ce guide liste uniquement les "
                "métadonnées enregistrées, sans interprétation par l'IA."
                if fr
                else "The assistant is momentarily unavailable: this guide only lists the "
                "recorded metadata, with no AI interpretation."
            ),
        )
    )
    return rich.BlockDocument(blocks=blocks)


def fallback_guide(dataset: Dataset, language: str) -> str:
    """Miroir texte du repli (champ `text` : copie, a11y, recherche, compat v1)."""
    return rich.to_plain_text(fallback_document(dataset, language))


def guide_payload(
    *,
    text: str,
    model_used: str,
    is_fallback: bool,
    language: str,
    tokens_used: int,
    blocks: dict[str, Any] | None = None,
) -> dict[str, Any]:
    from datetime import UTC, datetime

    return {
        "text": text,
        "blocks": blocks,
        "model_used": model_used,
        "is_fallback": is_fallback,
        "language": language,
        "tokens_used": tokens_used,
        "generated_at": datetime.now(UTC).isoformat(),
    }
