"""Explication textuelle adaptative (CDC §9.5) + chat XAI (CDC §9.6).

- Adaptée au profil (novice ~180 mots / intermediate ~250 / expert ~320) et à la
  langue UI ; température 0 (P4).
- Anti-hallucination : le prompt ne contient QUE les vraies valeurs ; chaque nombre
  cité en sortie doit exister dans le contexte, sinon régénération puis fallback.
- Fallback : template déterministe construit sur les vraies données (P2).
"""

import re
from typing import Any

from ibis.core.logging import get_logger

logger = get_logger(__name__)

AUDIENCE_SPECS = {
    "novice": {
        "fr": (
            "un grand débutant : commence par une analogie concrète du quotidien, puis traduis "
            "chaque chiffre en langage courant ; zéro jargon, phrases courtes, environ 180 mots, "
            "au maximum 5 variables citées"
        ),
        "en": (
            "a complete beginner: start with a concrete everyday analogy, then translate each "
            "number into plain language; zero jargon, short sentences, about 180 words, at most "
            "5 features mentioned"
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

# Directive de niveau injectée au CHAT (adaptatif §5.2). Novice = métaphores systématiques ;
# expert = terminologie exacte. On sépare volontairement le TON (ici) du contrat de blocs et de
# l'anti-hallucination (SYSTEM) — qui, eux, restent constants quel que soit le niveau.
AUDIENCE_CHAT_TONE = {
    "novice": {
        "fr": (
            "Adresse-toi à un grand débutant : emploie des métaphores et des analogies du "
            "quotidien, traduis chaque chiffre en mots simples, zéro jargon, phrases courtes."
        ),
        "en": (
            "Address a complete beginner: use everyday metaphors and analogies, translate every "
            "number into plain words, zero jargon, short sentences."
        ),
    },
    "intermediate": {
        "fr": "Adresse-toi à un public intermédiaire : structuré et orienté décision.",
        "en": "Address an intermediate audience: structured and decision-oriented.",
    },
    "expert": {
        "fr": "Adresse-toi à un expert : terminologie exacte, réponse concise et précise.",
        "en": "Address an expert: exact terminology, concise and precise.",
    },
}


def _audience_tone(audience: str, lang: str) -> str:
    return AUDIENCE_CHAT_TONE.get(audience, AUDIENCE_CHAT_TONE["intermediate"])[lang]


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


def humanize_feature(name: str) -> str:
    """Nom technique du pipeline → libellé lisible (CDC évolutions §1).

    `cat__Sex_female` → « Sex = female », `num_median_0__Pclass` → « Pclass »,
    `cat__Sex` (ordinal) → « Sex », nom sans préfixe → inchangé. Les colonnes
    snake_case gardent leur sens : coupure au DERNIER « _ » (les catégories
    multi-underscore sont plus rares que les colonnes multi-mots).
    """
    transformer, sep, rest = name.partition("__")
    if not sep or not rest:
        return name
    if transformer == "cat" and "_" in rest:
        column, _, category = rest.rpartition("_")
        return f"{column.replace('_', ' ')} = {category}"
    return rest.replace("_", " ")


def format_share(value: float, total: float) -> str:
    """Part entière de |value| dans total : « 24 % », « <1 % » sous 0.5 %.

    Demi-parts vers le haut (parité exacte avec Math.round côté front).
    """
    if total <= 0:
        return "0 %"
    pct = abs(value) / total * 100
    return "<1 %" if pct < 0.5 else f"{int(pct + 0.5)} %"


def _round3(value: Any) -> str:
    """Format lisible 3 décimales max, robuste aux valeurs non numériques."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return str(value)
    return f"{round(float(value), 3):g}"


def _importance_line(importance: list[dict[str, Any]]) -> str | None:
    """Importances en « part de l'importance affichée » — mêmes % que les graphiques.

    Dénominateur = Σ|v| de la liste reçue ENTIÈRE (le top stocké, celui que le front
    affiche) : le LLM et les charts citent exactement le même « 24 % ».
    """
    values = [float(i.get("value", i.get("contribution")) or 0) for i in importance]
    total = sum(abs(v) for v in values)
    if not values or total <= 0:
        return None
    signed = any("contribution" in item for item in importance)
    parts = []
    for item, raw in zip(importance, values, strict=True):
        label = humanize_feature(str(item.get("feature", "?")))
        share = format_share(raw, total)
        if signed:
            share += " ↗" if raw >= 0 else " ↘"
        parts.append(f"{label} : {share}")
    header = "Importances (part de l'importance affichée"
    if signed:
        header += ", ↗ pousse la prédiction vers le haut / ↘ vers le bas"
    return header + ") : " + ", ".join(parts)


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
    lines.append(
        "Métriques réelles (arrondies) : "
        + ", ".join(f"{k}={_round3(v)}" for k, v in numeric_metrics.items())
    )
    importance_line = _importance_line(importance)
    if importance_line:
        lines.append(importance_line)
    if local_values:
        lines.append(
            f"Prédiction locale : {_round3(local_values.get('prediction'))} "
            f"(base {_round3(local_values.get('base_value'))}, "
            f"classe {local_values.get('predicted_label')})"
        )
    return "\n".join(lines)


def build_prompt(*, audience: str, language: str, context: str) -> tuple[str, str]:
    lang = "en" if language == "en" else "fr"
    spec = AUDIENCE_SPECS.get(audience, AUDIENCE_SPECS["novice"])[lang]
    if lang == "fr":
        user = (
            f"Explique ces résultats pour {spec}.\n"
            "Structure : ① ce que le modèle a appris ② quelles variables comptent et pourquoi "
            "③ à quel point s'y fier (métriques) ④ une limite à garder en tête.\n"
            "Cite les nombres tels qu'affichés dans le contexte (arrondis / en %) — "
            "ne re-dérive jamais une précision supérieure.\n\n"
            f"CONTEXTE (seules valeurs autorisées) :\n{context}"
        )
    else:
        user = (
            f"Explain these results for {spec}.\n"
            "Structure: ① what the model learned ② which features matter and why "
            "③ how much to trust it (metrics) ④ one limitation to keep in mind.\n"
            "Quote numbers exactly as displayed in the context (rounded / in %) — "
            "never re-derive extra precision.\n\n"
            f"CONTEXT (only allowed values):\n{context}"
        )
    return SYSTEM[lang], user


NUMBER_RE = re.compile(r"\d+(?:[.,]\d+)?")


def numbers_exist_in_context(text: str, context: str) -> bool:
    """Post-validation : tout nombre cité doit exister dans le contexte (tolérance arrondis)."""
    context_numbers: set[str] = set()
    for raw in NUMBER_RE.findall(context.replace(",", ".")):
        value = float(raw)
        # Valeur EXACTE du contexte (écho fidèle du modèle, quelle que soit sa précision) :
        # sans ça, une importance SHAP « 0.242421 » recopiée telle quelle était rejetée à tort.
        context_numbers.add(f"{value:g}")
        for digits in (0, 1, 2, 3, 4):
            context_numbers.add(f"{value:.{digits}f}".rstrip("0").rstrip("."))
            context_numbers.add(
                f"{value * 100:.{digits}f}".rstrip("0").rstrip(".")
            )  # % équivalents
            context_numbers.add(
                f"{value / 100:.{digits}f}".rstrip("0").rstrip(".")
            )  # écho décimal d'un % affiché (24 → 0.24)
    foreign: list[str] = []
    for raw in NUMBER_RE.findall(text.replace(",", ".")):
        normalized = f"{float(raw):g}"
        if normalized in ("1", "2", "3", "4", "5", "10", "100"):  # petits ordinaux tolérés
            continue
        if normalized not in context_numbers:
            foreign.append(normalized)
    if foreign:
        # Diagnostic : quels nombres cités par l'IA ne sont pas dans le contexte (→ rejet).
        logger.info("xai_text.foreign_numbers", numbers=foreign[:10])
    return not foreign


def fallback_text(
    *,
    audience: str,
    language: str,
    metrics: dict[str, Any],
    importance: list[dict[str, Any]],
    task_type: str,
    algorithm: str,
) -> str:
    """Template déterministe sur les VRAIES données, ADAPTÉ au niveau (adaptatif §5.3).

    Trois formulations distinctes (novice → analogie + langage courant ; intermédiaire →
    orienté décision ; expert → terminologie), toujours ancrées sur les valeurs calculées et
    toujours badgées « généré sans IA » (P2). Le novice reçoit l'essentiel (moins de variables).
    """
    en = language == "en"
    primary = str(metrics.get("primary_metric", ""))
    primary_value = metrics.get(primary) if primary else None
    has_primary = bool(primary) and primary_value is not None

    if audience == "novice":
        top = [humanize_feature(str(i["feature"])) for i in importance[:3]]  # l'essentiel
        if en:
            parts = [
                f"In plain words: the {algorithm} model learned from examples to make "
                f"predictions ({task_type}) — a bit like learning to recognise a fruit after "
                "seeing many of them.",
                (
                    f"Its main score ({primary}) is {_round3(primary_value)}: the closer to 1, "
                    "the better."
                    if has_primary
                    else "Its main score is unavailable here."
                ),
                (
                    "What counted most: " + ", ".join(top) + "."
                    if top
                    else "Which information counted most is unavailable."
                ),
                "This summary was generated without AI, from the computed values only.",
            ]
        else:
            parts = [
                f"Pour faire simple : le modèle {algorithm} a appris, à partir d'exemples, à "
                f"faire des prédictions ({task_type}) — un peu comme on apprend à reconnaître un "
                "fruit après en avoir vu beaucoup.",
                (
                    f"Sa note principale ({primary}) est de {_round3(primary_value)} : plus c'est "
                    "proche de 1, mieux c'est."
                    if has_primary
                    else "Sa note principale n'est pas disponible ici."
                ),
                (
                    "Ce qui a le plus compté : " + ", ".join(top) + "."
                    if top
                    else "L'information qui a le plus compté n'est pas disponible."
                ),
                "Ce résumé a été généré sans IA, uniquement à partir des valeurs calculées.",
            ]
        return " ".join(parts)

    top = [humanize_feature(str(i["feature"])) for i in importance[:5]]
    if audience == "expert":
        if en:
            parts = [
                f"Model {algorithm} — {task_type} task.",
                (
                    f"Main metric {primary} = {_round3(primary_value)} "
                    "(see the full grid for macro metrics)."
                    if has_primary
                    else "Main metric unavailable."
                ),
                (
                    "Most influential features, by decreasing importance: " + ", ".join(top) + "."
                    if top
                    else "Feature importance unavailable."
                ),
                "Summary generated without AI, from the computed values only.",
            ]
        else:
            parts = [
                f"Modèle {algorithm} — tâche de {task_type}.",
                (
                    f"Métrique principale {primary} = {_round3(primary_value)} "
                    "(voir la grille complète pour les macro-métriques)."
                    if has_primary
                    else "Métrique principale indisponible."
                ),
                (
                    "Variables les plus influentes, par importance décroissante : "
                    + ", ".join(top)
                    + "."
                    if top
                    else "Importance des variables indisponible."
                ),
                "Résumé généré sans IA, à partir des seules valeurs calculées.",
            ]
        return " ".join(parts)

    # intermediate (défaut) : structuré, orienté décision.
    if en:
        parts = [
            f"The {algorithm} model was trained for a {task_type} task.",
            (
                f"Main metric {primary} = {_round3(primary_value)}."
                if has_primary
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
    parts = [
        f"Le modèle {algorithm} a été entraîné pour une tâche de {task_type}.",
        (
            f"Métrique principale {primary} = {_round3(primary_value)}."
            if has_primary
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


def chat_system_v2(language: str, audience: str = "intermediate") -> str:
    """Système chat v2 = honnêteté anti-hallucination + niveau (§5.2) + contrat de blocs."""
    lang = "en" if language == "en" else "fr"
    grammar = _BLOCKS_GRAMMAR_EN if lang == "en" else _BLOCKS_GRAMMAR
    return SYSTEM[lang] + "\n\n" + _audience_tone(audience, lang) + "\n\n" + grammar


def chat_prompt_v2(
    *,
    question: str,
    context: str,
    history: list[tuple[str, str]],
    language: str,
    audience: str = "intermediate",
) -> str:
    lang = "en" if language == "en" else "fr"
    history_block = "\n".join(f"{role}: {content}" for role, content in history[-10:])
    tone = _audience_tone(audience, lang)
    if lang == "fr":
        return (
            f"CONTEXTE (seules valeurs autorisées) :\n{context}\n\n"
            f"HISTORIQUE :\n{history_block}\n\n"
            f"QUESTION : {question}\n\n"
            f"{tone}\n"
            "Rédige une réponse claire et STRUCTURÉE en blocs (≤ 6 blocs, ≤ 120 mots au total). "
            "Utilise un tableau ou featureImpact quand cela éclaire vraiment, un callout pour une "
            "limite. Cite les nombres tels qu'affichés dans le contexte (arrondis / en %). "
            "Appuie-toi UNIQUEMENT sur le contexte."
        )
    return (
        f"CONTEXT (only allowed values):\n{context}\n\n"
        f"HISTORY:\n{history_block}\n\n"
        f"QUESTION: {question}\n\n"
        f"{tone}\n"
        "Write a clear, STRUCTURED answer in blocks (≤ 6 blocks, ≤ 120 words total). "
        "Use a table or featureImpact only when it truly helps, a callout for a limitation. "
        "Quote numbers exactly as displayed in the context (rounded / in %). "
        "Rely ONLY on the context."
    )


def suggested_questions(
    task_type: str,
    language: str,
    audience: str | None = None,
    *,
    top_feature: str | None = None,
    metric_name: str | None = None,
    metric_value: Any | None = None,
) -> list[str]:
    """Questions suggérées contextuelles — déterministes (pas de LLM requis), adaptées au
    niveau (adaptatif §5.2) : le novice se voit proposer des questions en langage courant.

    Contextualisées (CDC évolutions §4) : quand la dernière explication fournit la variable
    dominante (nom humanisé) et la métrique principale, les questions citent le VRAI modèle
    (« Pourquoi « Sex » domine-t-elle ? », « Un score f1 de 0.732, puis-je m'y fier ? »).
    Sans contexte, repli sur les formulations génériques d'origine.
    """
    en = language == "en"
    value = _round3(metric_value) if metric_value is not None else None
    has_metric = bool(metric_name) and value is not None
    if audience == "novice":
        if en:
            common = [
                "In plain words, what did the model learn?",
                (
                    f"Is a {metric_name} of {value} good or not?"
                    if has_metric
                    else "Can I trust this result, simply put?"
                ),
                (
                    f"Why did “{top_feature}” matter so much?"
                    if top_feature
                    else "Which piece of information mattered most, and why?"
                ),
            ]
            return (
                [*common, "The confusion matrix — like what, in everyday terms?"]
                if task_type == "classification"
                else [*common, "The average error — what does it mean in real life?"]
            )
        common = [
            "En clair, qu'a appris le modèle ?",
            (
                f"Un score {metric_name} de {value}, c'est bon ou pas ?"
                if has_metric
                else "Puis-je faire confiance à ce résultat, simplement ?"
            ),
            (
                f"Pourquoi « {top_feature} » a-t-il autant compté ?"
                if top_feature
                else "Quelle information a le plus compté, et pourquoi ?"
            ),
        ]
        return (
            [*common, "La matrice de confusion, c'est comme quoi au quotidien ?"]
            if task_type == "classification"
            else [*common, "L'erreur moyenne, ça représente quoi dans la vraie vie ?"]
        )

    if en:
        common = [
            (
                f"Why does “{top_feature}” dominate the prediction?"
                if top_feature
                else "Why does the top feature dominate the prediction?"
            ),
            (
                f"Can I trust a {metric_name} of {value}?"
                if has_metric
                else "Can I trust these results?"
            ),
            "What should I improve before using this model?",
        ]
        return (
            [*common, "What does the confusion matrix tell me?"]
            if task_type == "classification"
            else [*common, "What does the MAE mean in practice?"]
        )
    common = [
        (
            f"Pourquoi la variable « {top_feature} » domine-t-elle la prédiction ?"
            if top_feature
            else "Pourquoi la variable dominante pèse-t-elle autant ?"
        ),
        (
            f"Un score {metric_name} de {value}, puis-je m'y fier ?"
            if has_metric
            else "Puis-je me fier à ces résultats ?"
        ),
        "Que devrais-je améliorer avant d'utiliser ce modèle ?",
    ]
    return (
        [*common, "Que m'apprend la matrice de confusion ?"]
        if task_type == "classification"
        else [*common, "Que signifie la MAE en pratique ?"]
    )
