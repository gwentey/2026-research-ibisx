"""Schéma de blocs riches pour le chat XAI v2 (CDC copilote §4).

Contrat STRICT partagé avec le frontend (`components/ibis/xai/ibis-blocks.tsx`) :
l'assistant renvoie un document JSON de blocs typés, chacun mappé à un composant
du design system. Les couleurs sont des TONALITÉS sémantiques (`tone`), jamais des
valeurs hex → le kit reste seul maître du rendu (design template intouchable).

Robustesse : `parse_document` tolère les enrobages fréquents des LLM (fences ```json,
tableau nu au lieu d'un objet). En cas d'échec, l'appelant régénère puis retombe sur
`fallback_document` (déterministe, badgé « sans IA », P2).
"""

from __future__ import annotations

import json
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from ibis.modules.llm.xai_text import format_share, humanize_feature

SCHEMA_VERSION = 1

# Tonalités sémantiques — mappées côté front sur les tokens du kit (jamais de hex ici).
Tone = Literal["neutral", "accent", "positive", "negative", "warning"]


class _Block(BaseModel):
    # `ignore` (et non `forbid`) : un champ superflu de l'IA ne doit pas faire échouer
    # tout le document ; on ne rend de toute façon que les champs connus.
    model_config = ConfigDict(extra="ignore")


class ParagraphBlock(_Block):
    type: Literal["paragraph"]
    # 2000 : une explication expert (~320 mots) peut tenir dans un seul paragraphe long.
    text: str = Field(min_length=1, max_length=2000)


class HeadingBlock(_Block):
    type: Literal["heading"]
    text: str = Field(min_length=1, max_length=160)
    level: Literal[3, 4] = 3


class ListBlock(_Block):
    type: Literal["list"]
    ordered: bool = False
    items: list[str] = Field(min_length=1, max_length=12)


class Cell(_Block):
    text: str = Field(default="", max_length=200)
    tone: Tone = "neutral"


class TableBlock(_Block):
    type: Literal["table"]
    columns: list[str] = Field(min_length=1, max_length=5)
    rows: list[list[Cell]] = Field(min_length=1, max_length=14)


class CalloutBlock(_Block):
    type: Literal["callout"]
    tone: Tone = "neutral"
    title: str | None = Field(default=None, max_length=120)
    text: str = Field(min_length=1, max_length=800)


class KeyValueItem(_Block):
    label: str = Field(max_length=120)
    value: str = Field(max_length=120)
    tone: Tone = "neutral"


class KeyValueBlock(_Block):
    type: Literal["keyValue"]
    items: list[KeyValueItem] = Field(min_length=1, max_length=8)


class FeatureImpactItem(_Block):
    feature: str = Field(max_length=120)
    weight: float = Field(ge=0)
    direction: Literal["up", "down"] = "up"


class FeatureImpactBlock(_Block):
    """Barres d'importance — `direction` colore (vert = pousse vers / rouge = contre)."""

    type: Literal["featureImpact"]
    items: list[FeatureImpactItem] = Field(min_length=1, max_length=10)


Block = Annotated[
    ParagraphBlock
    | HeadingBlock
    | ListBlock
    | TableBlock
    | CalloutBlock
    | KeyValueBlock
    | FeatureImpactBlock,
    Field(discriminator="type"),
]


class BlockDocument(_Block):
    schema_version: int = SCHEMA_VERSION
    blocks: list[Block] = Field(min_length=1, max_length=16)


# --------------------------------------------------------------------- Parsing / sérialisation


def _strip_fences(raw: str) -> str:
    """Retire un éventuel enrobage ```json … ``` autour du JSON."""
    text = raw.strip()
    if text.startswith("```"):
        text = text[3:]
        if text[:4].lower() == "json":
            text = text[4:]
        end = text.rfind("```")
        if end != -1:
            text = text[:end]
    return text.strip()


# Plafonds du schéma par type de bloc : listes TRONQUÉES avant validation plutôt que
# rejet du document entier (constaté en réel : 10 métriques dans un keyValue ≤ 8 → repli
# à tort d'une explication par ailleurs parfaite).
_LIST_CAPS: dict[str, tuple[str, int]] = {
    "keyValue": ("items", 8),
    "featureImpact": ("items", 10),
    "list": ("items", 12),
    "table": ("rows", 14),
}


def _clamp_lists(payload: Any) -> Any:
    """Tronque blocs et listes internes aux plafonds du schéma (tolérance LLM)."""
    if not isinstance(payload, dict) or not isinstance(payload.get("blocks"), list):
        return payload
    payload["blocks"] = payload["blocks"][:16]
    for block in payload["blocks"]:
        if not isinstance(block, dict):
            continue
        cap = _LIST_CAPS.get(str(block.get("type")))
        if cap is not None and isinstance(block.get(cap[0]), list):
            block[cap[0]] = block[cap[0]][: cap[1]]
        if block.get("type") == "table" and isinstance(block.get("columns"), list):
            block["columns"] = block["columns"][:5]
            if isinstance(block.get("rows"), list):
                block["rows"] = [row[:5] if isinstance(row, list) else row for row in block["rows"]]
    return payload


def parse_document(raw: str) -> BlockDocument:
    """Parse + valide la sortie LLM. Lève ValueError/ValidationError si non conforme."""
    payload: Any = json.loads(_strip_fences(raw))
    if isinstance(payload, list):  # l'IA a renvoyé le tableau de blocs directement
        payload = {"blocks": payload}
    return BlockDocument.model_validate(_clamp_lists(payload))


def extract_text(doc: BlockDocument) -> str:
    """Concatène tous les champs TEXTE (post-validation anti-hallucination + miroir).

    On ignore volontairement les poids de `featureImpact` : ce sont des magnitudes
    d'affichage normalisées, pas des faits chiffrés assertés dans une phrase.
    """
    parts: list[str] = []
    for block in doc.blocks:
        if isinstance(block, (ParagraphBlock, HeadingBlock)):
            parts.append(block.text)
        elif isinstance(block, ListBlock):
            parts.extend(block.items)
        elif isinstance(block, TableBlock):
            parts.extend(block.columns)
            parts.extend(cell.text for row in block.rows for cell in row)
        elif isinstance(block, CalloutBlock):
            if block.title:
                parts.append(block.title)
            parts.append(block.text)
        elif isinstance(block, KeyValueBlock):
            for item in block.items:
                parts.append(item.label)
                parts.append(item.value)
        elif isinstance(block, FeatureImpactBlock):
            parts.extend(item.feature for item in block.items)
    return "\n".join(parts)


def to_plain_text(doc: BlockDocument) -> str:
    """Miroir texte lisible du document (champ `content` : copie, recherche, a11y, repli)."""
    lines: list[str] = []
    for block in doc.blocks:
        if isinstance(block, ParagraphBlock):
            lines.append(block.text)
        elif isinstance(block, HeadingBlock):
            lines.append(("###" if block.level == 3 else "####") + " " + block.text)
        elif isinstance(block, ListBlock):
            prefix = (lambda i: f"{i + 1}.") if block.ordered else (lambda _i: "-")
            lines.extend(f"{prefix(i)} {item}" for i, item in enumerate(block.items))
        elif isinstance(block, TableBlock):
            lines.append(" | ".join(block.columns))
            lines.extend(" | ".join(cell.text for cell in row) for row in block.rows)
        elif isinstance(block, CalloutBlock):
            lines.append((f"{block.title} — " if block.title else "") + block.text)
        elif isinstance(block, KeyValueBlock):
            lines.extend(f"{item.label} : {item.value}" for item in block.items)
        elif isinstance(block, FeatureImpactBlock):
            lines.extend(
                f"{item.feature} ({'↑' if item.direction == 'up' else '↓'} {item.weight:g})"
                for item in block.items
            )
        lines.append("")
    return "\n".join(lines).strip()


# --------------------------------------------------------------------- Fallback déterministe


def _fmt(value: Any) -> str:
    if isinstance(value, bool):
        return str(value)
    if isinstance(value, (int, float)):
        return f"{round(float(value), 3):g}"  # 3 déc. max — cohérent avec le contexte LLM
    return str(value)


def _fallback_intro(
    *, fr: bool, audience: str, algorithm: str, task_type: str, primary: str, value: Any
) -> str:
    """Intro du repli chat, ADAPTÉE au niveau (adaptatif §5.2) — novice = langage courant,
    expert = terminologie. Sans clé LLM, c'est ce texte qui « parle » à l'utilisateur."""
    has = bool(primary) and value is not None
    if audience == "novice":
        if fr:
            intro = (
                f"Pour faire simple : le modèle {algorithm} a appris "
                f"à faire des prédictions ({task_type})."
            )
            return intro + (f" Sa note principale ({primary}) vaut {_fmt(value)}." if has else "")
        intro = f"In plain words: the {algorithm} model learned to make predictions ({task_type})."
        return intro + (f" Its main score ({primary}) is {_fmt(value)}." if has else "")
    if audience == "expert":
        if fr:
            intro = f"Modèle {algorithm} — tâche de {task_type}."
            return intro + (f" Métrique principale {primary} = {_fmt(value)}." if has else "")
        intro = f"Model {algorithm} — {task_type} task."
        return intro + (f" Main metric {primary} = {_fmt(value)}." if has else "")
    # intermediate (défaut)
    if fr:
        intro = f"Le modèle {algorithm} a été entraîné pour une tâche de {task_type}."
        return intro + (f" Métrique principale {primary} = {_fmt(value)}." if has else "")
    intro = f"The {algorithm} model was trained for a {task_type} task."
    return intro + (f" Main metric {primary} = {_fmt(value)}." if has else "")


def fallback_document(
    *,
    language: str,
    metrics: dict[str, Any],
    importance: list[dict[str, Any]],
    task_type: str,
    algorithm: str,
    audience: str = "intermediate",
) -> BlockDocument:
    """Document déterministe (paragraphe + tableau des top-variables + note « sans IA »),
    ADAPTÉ au niveau (adaptatif §5.2 : l'intro parle au niveau de l'explication commentée).

    CDC §11-③. Uniquement construit sur les VRAIES valeurs calculées (P2).
    """
    fr = language != "en"
    primary = str(metrics.get("primary_metric", ""))
    primary_value = metrics.get(primary) if primary else None
    intro = _fallback_intro(
        fr=fr,
        audience=audience,
        algorithm=algorithm,
        task_type=task_type,
        primary=primary,
        value=primary_value,
    )

    if fr:
        table_cols = ["Variable", "Poids (%)"]
        note_title = "Réponse générée sans IA"
        note_text = (
            "L'assistant est momentanément indisponible : ce résumé s'appuie uniquement "
            "sur les valeurs calculées, sans reformulation par l'IA."
        )
        no_imp = "L'importance des variables n'est pas disponible pour cette explication."
    else:
        table_cols = ["Feature", "Weight (%)"]
        note_title = "Generated without AI"
        note_text = (
            "The assistant is momentarily unavailable: this summary relies only on the "
            "computed values, with no AI rephrasing."
        )
        no_imp = "Feature importance is not available for this explanation."

    blocks: list[Any] = [ParagraphBlock(type="paragraph", text=intro)]

    top = importance[:6]
    if top:
        # Mêmes % que le contexte LLM et les graphiques : dénominateur = liste reçue ENTIÈRE.
        values = [float(i.get("value", i.get("contribution")) or 0) for i in importance]
        total = sum(abs(v) for v in values)
        rows: list[list[Cell]] = [
            [
                Cell(text=humanize_feature(str(item.get("feature", "?")))),
                Cell(text=format_share(value, total)),
            ]
            for item, value in zip(importance[:6], values[:6], strict=True)
        ]
        blocks.append(TableBlock(type="table", columns=table_cols, rows=rows))
    else:
        blocks.append(ParagraphBlock(type="paragraph", text=no_imp))

    blocks.append(CalloutBlock(type="callout", tone="warning", title=note_title, text=note_text))
    return BlockDocument(blocks=blocks)
