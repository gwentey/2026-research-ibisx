"""Explication textuelle adaptative (CDC §9.5) + chat XAI (CDC §9.6).

- Adaptée au profil (novice ~180 mots / intermediate ~250 / expert ~320) et à la
  langue UI ; température 0 (P4).
- Anti-hallucination : le prompt ne contient QUE les vraies valeurs ; chaque nombre
  cité en sortie doit exister dans le contexte, sinon régénération puis fallback.
- Fallback : template déterministe construit sur les vraies données (P2).
"""

import re
from typing import Any

AUDIENCE_SPECS = {
    "novice": {
        "fr": (
            "un débutant complet : analogies du quotidien, zéro jargon, environ 180 mots, "
            "au maximum 5 variables citées"
        ),
        "en": (
            "a complete beginner: everyday analogies, zero jargon, about 180 words, "
            "at most 5 features mentioned"
        ),
    },
    "intermediate": {
        "fr": "un profil intermédiaire : structuré et orienté décision, environ 250 mots",
        "en": "an intermediate profile: structured and decision-oriented, about 250 words",
    },
    "expert": {
        "fr": (
            "un expert : terminologie exacte (axiomes SHAP, OOB, macro-métriques), environ 320 mots"
        ),
        "en": "an expert: exact terminology (SHAP axioms, OOB, macro metrics), about 320 words",
    },
}

SYSTEM = {
    "fr": (
        "Tu es l'assistant d'explicabilité d'IBIS-X. Tu expliques les résultats d'un modèle de "
        "Machine Learning en t'appuyant EXCLUSIVEMENT sur les valeurs fournies dans le contexte. "
        "INTERDIT d'inventer un chiffre, un pourcentage ou une variable qui n'y figure pas. "
        "Si une information manque, dis-le."
    ),
    "en": (
        "You are the explainability assistant of IBIS-X. You explain a Machine Learning model's "
        "results relying EXCLUSIVELY on the values provided in the context. INVENTING any number, "
        "percentage or feature not present is FORBIDDEN. If something is missing, say so."
    ),
}


def build_context(
    *,
    metrics: dict[str, Any],
    importance: list[dict[str, Any]],
    task_type: str,
    algorithm: str,
    explanation_type: str,
    local_values: dict[str, Any] | None,
) -> str:
    lines = [
        f"Algorithme : {algorithm} | Tâche : {task_type} | Type d'explication : {explanation_type}"
    ]
    numeric_metrics = {k: v for k, v in metrics.items() if isinstance(v, (int, float))}
    lines.append("Métriques réelles : " + ", ".join(f"{k}={v}" for k, v in numeric_metrics.items()))
    if importance:
        lines.append(
            "Importances (top) : "
            + ", ".join(
                f"{i['feature']}={i.get('value', i.get('contribution'))}" for i in importance[:10]
            )
        )
    if local_values:
        lines.append(
            f"Prédiction locale : {local_values.get('prediction')} "
            f"(base {local_values.get('base_value')}, classe {local_values.get('predicted_label')})"
        )
    return "\n".join(lines)


def build_prompt(*, audience: str, language: str, context: str) -> tuple[str, str]:
    lang = "en" if language == "en" else "fr"
    spec = AUDIENCE_SPECS.get(audience, AUDIENCE_SPECS["novice"])[lang]
    if lang == "fr":
        user = (
            f"Explique ces résultats pour {spec}.\n"
            "Structure : ① ce que le modèle a appris ② quelles variables comptent et pourquoi "
            "③ à quel point s'y fier (métriques) ④ une limite à garder en tête.\n\n"
            f"CONTEXTE (seules valeurs autorisées) :\n{context}"
        )
    else:
        user = (
            f"Explain these results for {spec}.\n"
            "Structure: ① what the model learned ② which features matter and why "
            "③ how much to trust it (metrics) ④ one limitation to keep in mind.\n\n"
            f"CONTEXT (only allowed values):\n{context}"
        )
    return SYSTEM[lang], user


NUMBER_RE = re.compile(r"\d+(?:[.,]\d+)?")


def numbers_exist_in_context(text: str, context: str) -> bool:
    """Post-validation : tout nombre cité doit exister dans le contexte (tolérance arrondis)."""
    context_numbers: set[str] = set()
    for raw in NUMBER_RE.findall(context.replace(",", ".")):
        value = float(raw)
        for digits in (0, 1, 2, 3, 4):
            context_numbers.add(f"{value:.{digits}f}".rstrip("0").rstrip("."))
            context_numbers.add(
                f"{value * 100:.{digits}f}".rstrip("0").rstrip(".")
            )  # % équivalents
    for raw in NUMBER_RE.findall(text.replace(",", ".")):
        normalized = f"{float(raw):g}"
        if normalized in ("1", "2", "3", "4", "5", "10", "100"):  # petits ordinaux tolérés
            continue
        if normalized not in context_numbers:
            return False
    return True


def fallback_text(
    *,
    audience: str,
    language: str,
    metrics: dict[str, Any],
    importance: list[dict[str, Any]],
    task_type: str,
    algorithm: str,
) -> str:
    """Template déterministe sur les VRAIES données — badge « généré sans IA » (P2)."""
    top = [str(i["feature"]) for i in importance[:5]]
    if language == "en":
        primary = metrics.get("primary_metric", "")
        parts = [
            f"The {algorithm} model was trained for a {task_type} task.",
            (
                f"Main metric {primary} = {metrics.get(primary)}."
                if primary and metrics.get(primary) is not None
                else "Main metric unavailable."
            ),
            (
                "The most influential features are: " + ", ".join(top) + "."
                if top
                else "Feature importance is unavailable."
            ),
            "This summary was generated without AI, from the computed values only.",
        ]
        return " ".join(parts)
    primary = metrics.get("primary_metric", "")
    parts = [
        f"Le modèle {algorithm} a été entraîné pour une tâche de {task_type}.",
        (
            f"Métrique principale {primary} = {metrics.get(primary)}."
            if primary and metrics.get(primary) is not None
            else "Métrique principale indisponible."
        ),
        (
            "Les variables les plus influentes sont : " + ", ".join(top) + "."
            if top
            else "L'importance des variables est indisponible."
        ),
        "Ce résumé a été généré sans IA, uniquement à partir des valeurs calculées.",
    ]
    return " ".join(parts)


# ------------------------------------ Chat (CDC §9.6) ---------------------------------------


def chat_system(language: str) -> str:
    return SYSTEM["en" if language == "en" else "fr"]


def chat_prompt(
    *, question: str, context: str, history: list[tuple[str, str]], language: str
) -> str:
    lang = "en" if language == "en" else "fr"
    history_block = "\n".join(f"{role}: {content}" for role, content in history[-10:])
    if lang == "fr":
        return (
            f"CONTEXTE (seules valeurs autorisées) :\n{context}\n\n"
            f"HISTORIQUE :\n{history_block}\n\n"
            f"QUESTION : {question}\n"
            "Réponds en 120 mots maximum, en t'appuyant uniquement sur le contexte."
        )
    return (
        f"CONTEXT (only allowed values):\n{context}\n\n"
        f"HISTORY:\n{history_block}\n\n"
        f"QUESTION: {question}\n"
        "Answer in at most 120 words, relying only on the context."
    )


# ------------------------------------ Chat v2 : réponse en blocs (CDC copilote §4/§6) --------

# Grammaire de blocs injectée au modèle. On la garde COURTE et fermée : plus le contrat est
# explicite, moins le JSON dérive (→ moins de fallback). Le schéma exact est validé en Pydantic
# côté worker (ibis.modules.xai.blocks) ; ici on décrit l'INTENTION d'usage des tonalités.
_BLOCKS_GRAMMAR = (
    'Réponds UNIQUEMENT par un objet JSON : {"schema_version":1,"blocks":[…]}. '
    "Aucun texte hors du JSON. Types de blocs autorisés :\n"
    '- {"type":"paragraph","text":"…"}  (markdown inline autorisé : **gras**, *italique*, '
    "`code`, ==surligné==)\n"
    '- {"type":"heading","text":"…","level":3}\n'
    '- {"type":"list","ordered":false,"items":["…"]}\n'
    '- {"type":"table","columns":["…"],"rows":[[{"text":"…","tone":"neutral"}]]}\n'
    '- {"type":"callout","tone":"warning","title":"…","text":"…"}\n'
    '- {"type":"keyValue","items":[{"label":"…","value":"…","tone":"accent"}]}\n'
    '- {"type":"featureImpact","items":[{"feature":"…","weight":0.4,"direction":"up"}]}\n'
    "Tonalités (tone) — sémantiques, JAMAIS décoratives : "
    '"positive" = pousse vers / favorable, "negative" = pousse contre / risque, '
    '"warning" = limite ou prudence, "accent" = point clé / variable dominante, '
    '"neutral" = neutre. featureImpact.direction : "up" (favorable) ou "down" (défavorable).'
)

_BLOCKS_GRAMMAR_EN = (
    'Answer ONLY with a JSON object: {"schema_version":1,"blocks":[…]}. '
    "No text outside the JSON. Allowed block types:\n"
    '- {"type":"paragraph","text":"…"}  (inline markdown allowed: **bold**, *italic*, '
    "`code`, ==highlight==)\n"
    '- {"type":"heading","text":"…","level":3}\n'
    '- {"type":"list","ordered":false,"items":["…"]}\n'
    '- {"type":"table","columns":["…"],"rows":[[{"text":"…","tone":"neutral"}]]}\n'
    '- {"type":"callout","tone":"warning","title":"…","text":"…"}\n'
    '- {"type":"keyValue","items":[{"label":"…","value":"…","tone":"accent"}]}\n'
    '- {"type":"featureImpact","items":[{"feature":"…","weight":0.4,"direction":"up"}]}\n'
    "Tones — semantic, NEVER decorative: "
    '"positive" = pushes toward / favorable, "negative" = pushes against / risk, '
    '"warning" = limitation or caution, "accent" = key point / dominant feature, '
    '"neutral" = neutral. featureImpact.direction: "up" (favorable) or "down" (unfavorable).'
)


def chat_system_v2(language: str) -> str:
    """Système chat v2 = honnêteté anti-hallucination + contrat de blocs."""
    lang = "en" if language == "en" else "fr"
    grammar = _BLOCKS_GRAMMAR_EN if lang == "en" else _BLOCKS_GRAMMAR
    return SYSTEM[lang] + "\n\n" + grammar


def chat_prompt_v2(
    *, question: str, context: str, history: list[tuple[str, str]], language: str
) -> str:
    lang = "en" if language == "en" else "fr"
    history_block = "\n".join(f"{role}: {content}" for role, content in history[-10:])
    if lang == "fr":
        return (
            f"CONTEXTE (seules valeurs autorisées) :\n{context}\n\n"
            f"HISTORIQUE :\n{history_block}\n\n"
            f"QUESTION : {question}\n\n"
            "Rédige une réponse claire et STRUCTURÉE en blocs (≤ 6 blocs, ≤ 120 mots au total). "
            "Utilise un tableau ou featureImpact quand cela éclaire vraiment, un callout pour une "
            "limite. Appuie-toi UNIQUEMENT sur le contexte."
        )
    return (
        f"CONTEXT (only allowed values):\n{context}\n\n"
        f"HISTORY:\n{history_block}\n\n"
        f"QUESTION: {question}\n\n"
        "Write a clear, STRUCTURED answer in blocks (≤ 6 blocks, ≤ 120 words total). "
        "Use a table or featureImpact only when it truly helps, a callout for a limitation. "
        "Rely ONLY on the context."
    )


def suggested_questions(task_type: str, language: str) -> list[str]:
    """Questions suggérées contextuelles — déterministes (pas de LLM requis)."""
    if language == "en":
        common = [
            "Why does the top feature dominate the prediction?",
            "Can I trust these results?",
            "What should I improve before using this model?",
        ]
        return (
            [*common, "What does the confusion matrix tell me?"]
            if task_type == "classification"
            else [*common, "What does the MAE mean in practice?"]
        )
    common = [
        "Pourquoi la variable dominante pèse-t-elle autant ?",
        "Puis-je me fier à ces résultats ?",
        "Que devrais-je améliorer avant d'utiliser ce modèle ?",
    ]
    return (
        [*common, "Que m'apprend la matrice de confusion ?"]
        if task_type == "classification"
        else [*common, "Que signifie la MAE en pratique ?"]
    )
