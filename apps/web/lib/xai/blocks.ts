// Contrat de rendu du chat XAI v2 (CDC copilote §4/§5) — miroir TS du schéma Pydantic
// backend (`apps/api/ibis/modules/xai/blocks.py`). Logique PURE (testable en node) :
// typage des blocs, parsing inline (gras/italique/code/surlignage) et mapping des
// tonalités sémantiques vers les tokens du kit. Aucune couleur en dur ailleurs.

export type Tone = "neutral" | "accent" | "positive" | "negative" | "warning";

const TONES: readonly Tone[] = ["neutral", "accent", "positive", "negative", "warning"];

export function normalizeTone(value: unknown): Tone {
  return TONES.includes(value as Tone) ? (value as Tone) : "neutral";
}

// -------------------------------------------------------------------------- Types de blocs

export interface ParagraphBlock {
  type: "paragraph";
  text: string;
}
export interface HeadingBlock {
  type: "heading";
  text: string;
  level?: 3 | 4;
}
export interface ListBlock {
  type: "list";
  ordered?: boolean;
  items: string[];
}
export interface TableCell {
  text: string;
  tone?: Tone;
}
export interface TableBlock {
  type: "table";
  columns: string[];
  rows: TableCell[][];
}
export interface CalloutBlock {
  type: "callout";
  tone?: Tone;
  title?: string | null;
  text: string;
}
export interface KeyValueItem {
  label: string;
  value: string;
  tone?: Tone;
}
export interface KeyValueBlock {
  type: "keyValue";
  items: KeyValueItem[];
}
export interface FeatureImpactItem {
  feature: string;
  weight: number;
  direction?: "up" | "down";
}
export interface FeatureImpactBlock {
  type: "featureImpact";
  items: FeatureImpactItem[];
}

export type Block =
  | ParagraphBlock
  | HeadingBlock
  | ListBlock
  | TableBlock
  | CalloutBlock
  | KeyValueBlock
  | FeatureImpactBlock;

export const KNOWN_BLOCK_TYPES: readonly Block["type"][] = [
  "paragraph",
  "heading",
  "list",
  "table",
  "callout",
  "keyValue",
  "featureImpact"
];

/**
 * Extrait la liste de blocs d'un champ `message.blocks` (dict opaque côté API).
 * Robuste : renvoie [] si absent/mal formé ; un type inconnu est laissé tel quel et
 * dégradé en paragraphe par le renderer (jamais de rendu HTML arbitraire).
 */
export function getBlocks(raw: unknown): Block[] {
  if (!raw || typeof raw !== "object") return [];
  const list = (raw as { blocks?: unknown }).blocks;
  if (!Array.isArray(list)) return [];
  return list.filter((b): b is Block => !!b && typeof b === "object" && "type" in b);
}

// -------------------------------------------------------------------------- Parsing inline

export type InlineToken =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "italic"; value: string }
  | { kind: "code"; value: string }
  | { kind: "highlight"; value: string };

// `**gras**` puis `==surligné==` puis `` `code` `` puis `*italique*` / `_italique_`.
// L'ordre compte : ** doit être tenté avant *.
const INLINE_RE = /(\*\*(.+?)\*\*|==(.+?)==|`(.+?)`|\*(.+?)\*|_(.+?)_)/g;

/** Découpe un texte en jetons inline. Grammaire fermée, non imbriquée, sûre (pas de HTML). */
export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    const idx = match.index ?? 0;
    if (idx > last) tokens.push({ kind: "text", value: text.slice(last, idx) });
    if (match[2] !== undefined) tokens.push({ kind: "bold", value: match[2] });
    else if (match[3] !== undefined) tokens.push({ kind: "highlight", value: match[3] });
    else if (match[4] !== undefined) tokens.push({ kind: "code", value: match[4] });
    else tokens.push({ kind: "italic", value: match[5] ?? match[6] ?? "" });
    last = idx + match[0].length;
  }
  if (last < text.length) tokens.push({ kind: "text", value: text.slice(last) });
  return tokens;
}

// -------------------------------------------------------------------------- Tonalités → tokens

// Couleur de texte — alignée sur explanation-view.tsx (cohérence visuelle de l'onglet XAI).
export const TONE_TEXT: Record<Tone, string> = {
  neutral: "",
  accent: "text-ai",
  positive: "text-green-600 dark:text-green-400",
  negative: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400"
};

// Pastille (point) de la même tonalité.
export const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-muted-foreground/40",
  accent: "bg-ai",
  positive: "bg-green-600 dark:bg-green-400",
  negative: "bg-red-600 dark:bg-red-400",
  warning: "bg-amber-600 dark:bg-amber-400"
};

// Surface d'un callout (bordure + fond doux + texte).
export const TONE_SURFACE: Record<Tone, string> = {
  neutral: "border-border bg-muted/40",
  accent: "border-ai/40 bg-ai/5",
  positive: "border-green-500/40 bg-green-500/5",
  negative: "border-red-500/40 bg-red-500/5",
  warning: "border-amber-500/40 bg-amber-500/5"
};
