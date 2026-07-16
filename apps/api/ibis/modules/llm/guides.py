"""Guide IA d'un dataset (CDC §5.4.4) : prompt sur données réelles + fallback déterministe."""

from typing import Any

from ibis.modules.datasets.models import Dataset

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

GUIDE_INSTRUCTIONS = {
    "fr": (
        "Rédige un guide de ce jeu de données en 4 sections avec ces titres exacts :\n"
        "## À quoi sert ce dataset\n## Colonnes cibles plausibles\n"
        "## Tâches de ML adaptées\n## Précautions\n"
        "Maximum 300 mots au total."
    ),
    "en": (
        "Write a guide for this dataset in 4 sections with these exact titles:\n"
        "## What this dataset is for\n## Plausible target columns\n"
        "## Suitable ML tasks\n## Precautions\n"
        "Maximum 300 words in total."
    ),
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
    lang = "en" if language == "en" else "fr"
    return GUIDE_SYSTEM[lang], f"{GUIDE_INSTRUCTIONS[lang]}\n\n{dataset_context(dataset)}"


def fallback_guide(dataset: Dataset, language: str) -> str:
    """Guide déterministe construit sur les vraies métadonnées — badge « sans IA » (P2)."""
    file = dataset.files[0] if dataset.files else None
    categorical = [
        c.name
        for c in (file.columns if file else [])
        if c.dtype_interpreted in ("categorical", "boolean")
    ][:5]
    numerical = [
        c.name for c in (file.columns if file else []) if c.dtype_interpreted == "numerical"
    ][:5]
    pii = [c.name for c in (file.columns if file else []) if c.is_pii]

    if language == "en":
        sections = [
            "## What this dataset is for",
            dataset.objective or "No stated objective in the metadata.",
            "## Plausible target columns",
            (
                f"Categorical candidates: {', '.join(categorical)}."
                if categorical
                else "No obvious categorical candidate."
            )
            + (f" Numerical candidates: {', '.join(numerical)}." if numerical else ""),
            "## Suitable ML tasks",
            ", ".join(dataset.task) if dataset.task else "No task declared in the metadata.",
            "## Precautions",
            (
                f"Missing values: {dataset.global_missing_percentage}% overall. "
                if dataset.global_missing_percentage
                else ""
            )
            + (
                f"Columns flagged as personal data: {', '.join(pii)}."
                if pii
                else "No column flagged as personal data."
            ),
        ]
    else:
        sections = [
            "## À quoi sert ce dataset",
            dataset.objective or "Aucun objectif déclaré dans les métadonnées.",
            "## Colonnes cibles plausibles",
            (
                f"Candidates catégorielles : {', '.join(categorical)}."
                if categorical
                else "Aucune candidate catégorielle évidente."
            )
            + (f" Candidates numériques : {', '.join(numerical)}." if numerical else ""),
            "## Tâches de ML adaptées",
            ", ".join(dataset.task)
            if dataset.task
            else "Aucune tâche déclarée dans les métadonnées.",
            "## Précautions",
            (
                f"Valeurs manquantes : {dataset.global_missing_percentage} % au global. "
                if dataset.global_missing_percentage
                else ""
            )
            + (
                f"Colonnes signalées comme données personnelles : {', '.join(pii)}."
                if pii
                else "Aucune colonne signalée comme donnée personnelle."
            ),
        ]
    return "\n\n".join(sections)


def guide_payload(
    *, text: str, model_used: str, is_fallback: bool, language: str, tokens_used: int
) -> dict[str, Any]:
    from datetime import UTC, datetime

    return {
        "text": text,
        "model_used": model_used,
        "is_fallback": is_fallback,
        "language": language,
        "tokens_used": tokens_used,
        "generated_at": datetime.now(UTC).isoformat(),
    }
