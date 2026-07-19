"""Enrichissement d'un dataset importé depuis Kaggle.

Deux couches, volontairement séparées :

1. **Socle déterministe** (`build_base_metadata`) — métadonnées Kaggle + profilage réel des
   colonnes. Tient sans clé LLM : un import reste exploitable en dev ou en panne d'IA.
2. **Couche IA** (`suggest_ethics`, `suggest_objective`) — confort, jamais nécessaire.

**Invariant** : l'IA ne renseigne JAMAIS les 10 critères éthiques du dataset. Ses propositions
partent dans `ethics_suggestions`, à part, et ne pèsent pas dans `ethical_score` tant qu'un
humain ne les a pas confirmées. Le score éthique est la valeur du produit : une supposition
affichée comme un fait le viderait de son sens.
"""

import json
from dataclasses import dataclass

from ibis.core.logging import get_logger
from ibis.modules.datasets.ethics import ETHICAL_CRITERIA
from ibis.modules.datasets.kaggle_client import KaggleDatasetMeta, KaggleRef
from ibis.modules.datasets.profiling import FileProfile, suggest_domains, suggest_tasks
from ibis.modules.datasets.schemas import DatasetMetadataInput
from ibis.modules.llm import client as llm_client

logger = get_logger(__name__)

MAX_DOMAINS = 3

#: Tags Kaggle -> vocabulaire de domaines du projet (`profiling.DOMAIN_KEYWORDS`).
#: Volontairement partiel : un tag non listé n'invente pas de domaine.
KAGGLE_TAG_TO_DOMAIN: dict[str, str] = {
    "health": "healthcare",
    "healthcare": "healthcare",
    "medicine": "healthcare",
    "medical": "healthcare",
    "diabetes": "healthcare",
    "cancer": "healthcare",
    "heart conditions": "healthcare",
    "mental health": "healthcare",
    "education": "education",
    "students": "education",
    "schools": "education",
    "universities and colleges": "education",
    "finance": "finance",
    "banking": "finance",
    "economics": "finance",
    "investing": "finance",
    "credit": "finance",
    "insurance": "finance",
    "social science": "social",
    "social networks": "social",
    "society": "social",
    "demographics": "social",
    "politics": "social",
    "crime": "social",
    "biology": "biology",
    "genetics": "biology",
    "animals": "biology",
    "plants": "biology",
    "environment": "environment",
    "climate": "environment",
    "weather and climate": "environment",
    "earth and nature": "environment",
    "energy": "environment",
    "atmospheric science": "environment",
    "business": "business",
    "retail and shopping": "business",
    "marketing": "business",
    "e-commerce": "business",
    "sales": "business",
    "real estate": "business",
    "computer science": "technology",
    "internet": "technology",
    "software": "technology",
    "programming": "technology",
    "devices and sensors": "technology",
    "computer networks": "technology",
}


@dataclass
class EnrichmentResult:
    metadata: DatasetMetadataInput
    ethics_suggestions: dict[str, object] | None
    #: Vrai quand la licence a dégradé une demande « public » en « privé » — l'UI doit le dire.
    license_forced_private: bool


def domains_from_tags(tags: list[str]) -> list[str]:
    """Traduit les tags Kaggle dans le vocabulaire du projet, sans rien inventer."""
    seen: list[str] = []
    for tag in tags:
        domain = KAGGLE_TAG_TO_DOMAIN.get(tag.strip().lower())
        if domain and domain not in seen:
            seen.append(domain)
    return seen[:MAX_DOMAINS]


def _objective_fallback(meta: KaggleDatasetMeta) -> str:
    """Repli sans IA : le texte de Kaggle, jamais une invention."""
    if meta.subtitle.strip():
        return meta.subtitle.strip()
    if meta.description.strip():
        first = meta.description.strip().split("\n")[0]
        return first[:500]
    return f"Jeu de données « {meta.title} » importé depuis Kaggle."


def build_base_metadata(
    ref: KaggleRef,
    meta: KaggleDatasetMeta,
    profile: FileProfile,
    *,
    access_requested: str,
    objective: str | None = None,
) -> DatasetMetadataInput:
    """Socle déterministe — aucun appel réseau, aucun critère éthique renseigné."""
    domains = domains_from_tags(meta.tags)
    if not domains:
        # Les tags Kaggle sont souvent décoratifs (« beginner », « eda ») : on retombe alors
        # sur le profilage réel des noms de colonnes.
        domains = suggest_domains([column.name for column in profile.columns])

    # Une licence qui n'autorise pas la redistribution force le privé, même si l'utilisateur
    # a demandé public : le catalogue public REDISTRIBUE les fichiers.
    access = "private" if access_requested == "private" or not meta.redistributable else "public"

    missing = profile.missing_percentage
    missing_description = (
        f"{missing:.1f} % de valeurs manquantes mesurées à l'import."
        if missing > 0
        else "Aucune valeur manquante mesurée à l'import."
    )

    return DatasetMetadataInput(
        display_name=meta.title,
        objective=objective or _objective_fallback(meta),
        sources=f"Kaggle — {ref.ref}",
        storage_uri=ref.url,
        documentation_link=ref.url,
        access=access,
        availability="online",
        external_documentation_available=bool(meta.description.strip()),
        domain=domains,
        task=suggest_tasks(profile),
        features_description=(
            f"{max(0, profile.column_count - 1)} variable(s) explicative(s) "
            f"sur {profile.column_count} colonne(s), {profile.row_count} ligne(s)."
        ),
        missing_values_description=missing_description,
        # Les 10 critères éthiques restent volontairement absents (None) : voir le module docstring.
    )


def _ethics_prompt(meta: KaggleDatasetMeta, profile: FileProfile) -> tuple[str, str]:
    system = (
        "Tu es un assistant d'analyse éthique de jeux de données. Tu proposes des HYPOTHÈSES "
        "à faire valider par un humain — tu n'affirmes rien. Réponds en JSON strict : "
        '{"values": {"<critere>": true|false}, "notes": {"<critere>": "<justification courte>"}}. '
        "N'inclus un critère QUE si la documentation fournie permet réellement de trancher ; "
        "en cas de doute, omets-le plutôt que de deviner. "
        f"Critères autorisés : {', '.join(ETHICAL_CRITERIA)}."
    )
    columns = ", ".join(column.name for column in profile.columns[:40])
    has_pii = any(column.is_pii for column in profile.columns)
    user = (
        f"Titre : {meta.title}\n"
        f"Sous-titre : {meta.subtitle}\n"
        f"Licence : {meta.license_name or 'inconnue'}\n"
        f"Description : {meta.description[:2000]}\n"
        f"Colonnes : {columns}\n"
        f"Colonnes identifiées comme potentiellement personnelles : {'oui' if has_pii else 'non'}\n"
        f"Lignes : {profile.row_count}"
    )
    return system, user


def suggest_ethics(meta: KaggleDatasetMeta, profile: FileProfile) -> dict[str, object] | None:
    """Propositions de critères éthiques — `None` si l'IA est indisponible ou incohérente."""
    system, user = _ethics_prompt(meta, profile)
    try:
        result = llm_client.complete(system=system, user=user, json_mode=True, max_tokens=1200)
    except llm_client.LLMUnavailable:
        logger.info("enrichment.ethics_skipped", reason="llm_unavailable")
        return None

    try:
        payload = json.loads(result.text)
    except json.JSONDecodeError:
        logger.warning("enrichment.ethics_unparseable")
        return None
    if not isinstance(payload, dict):
        return None

    raw_values = payload.get("values")
    if not isinstance(raw_values, dict):
        return None

    # Filtrage strict : seulement les 10 critères connus, seulement des booléens.
    # Un modèle qui répond « peut-être » ou invente une clé ne doit pas polluer la base.
    values = {
        name: value
        for name, value in raw_values.items()
        if name in ETHICAL_CRITERIA and isinstance(value, bool)
    }
    if not values:
        return None

    raw_notes = payload.get("notes")
    notes = (
        {k: str(v) for k, v in raw_notes.items() if k in values}
        if isinstance(raw_notes, dict)
        else {}
    )

    return {
        "values": values,
        "notes": notes,
        "model_used": result.model_used,
        "is_fallback": False,
    }


def suggest_objective(meta: KaggleDatasetMeta, profile: FileProfile) -> str | None:
    """Objectif en français, une phrase. `None` si l'IA est indisponible."""
    system = (
        "Tu reformules l'objectif d'un jeu de données en UNE phrase en français, "
        "compréhensible par un non-informaticien. Pas de markdown, pas de guillemets. "
        "Reste strictement fidèle à la documentation fournie : n'invente aucun chiffre."
    )
    user = (
        f"Titre : {meta.title}\nSous-titre : {meta.subtitle}\n"
        f"Description : {meta.description[:1500]}\n"
        f"Colonnes : {', '.join(c.name for c in profile.columns[:30])}"
    )
    try:
        result = llm_client.complete(system=system, user=user, max_tokens=300)
    except llm_client.LLMUnavailable:
        return None
    text = result.text.strip().strip('"')
    return text[:500] or None


def enrich(
    ref: KaggleRef,
    meta: KaggleDatasetMeta,
    profile: FileProfile,
    *,
    access_requested: str,
) -> EnrichmentResult:
    """Point d'entrée appelé par la tâche d'import."""
    objective = suggest_objective(meta, profile)
    metadata = build_base_metadata(
        ref, meta, profile, access_requested=access_requested, objective=objective
    )
    ethics = suggest_ethics(meta, profile)

    return EnrichmentResult(
        metadata=metadata,
        ethics_suggestions=ethics,
        license_forced_private=access_requested == "public" and metadata.access == "private",
    )
