// « Regards métier » — extraction PURE et HONNÊTE des faits réels d'un résultat (P1).
// Aucune donnée inventée : tout vient de RawResults (métriques, importance, matrice).
// Testé isolément : tests/lenses/insights.test.ts

import type { FeatureImportance, RawResults, ResultInsights } from "./types";

/** Retire le préfixe de transformer sklearn (`num__`, `cat__`, `remainder__`…). */
export function prettyFeatureName(raw: string): string {
  const idx = raw.indexOf("__");
  return idx >= 0 ? raw.slice(idx + 2) : raw;
}

// Attributs potentiellement protégés (RGPD / non-discrimination). Chaque entrée : un libellé
// canonique + des correspondances par TOKEN (jamais par sous-chaîne, pour éviter « average »→age).
const SENSITIVE: { label: string; exact: string[]; prefix: string[] }[] = [
  { label: "sex", exact: ["sex", "sexe", "gender", "genre"], prefix: [] },
  { label: "age", exact: ["age"], prefix: [] },
  { label: "race", exact: ["race", "ethnie", "ethnicity", "skin"], prefix: ["ethnic"] },
  {
    label: "origin",
    exact: ["origin", "origine", "nationality", "nationalite", "country", "pays", "native", "citizen", "citizenship"],
    prefix: ["nationalit"]
  },
  { label: "religion", exact: ["religion"], prefix: ["religio"] },
  { label: "disability", exact: ["disability", "handicap"], prefix: ["disab"] },
  {
    label: "family",
    exact: ["marital", "married", "marie", "mariee", "pregnant", "enceinte"],
    prefix: ["pregnan"]
  }
];

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function tokenize(raw: string): string[] {
  return stripAccents(raw)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Repère les attributs sensibles utilisés par le modèle, par TOKENISATION (pas sous-chaîne),
 * et renvoie leurs libellés canoniques dédupliqués, dans l'ordre de première apparition.
 */
export function detectSensitiveFeatures(featureNames: string[]): string[] {
  const found: string[] = [];
  for (const name of featureNames) {
    const tokens = tokenize(name);
    for (const entry of SENSITIVE) {
      if (found.includes(entry.label)) continue;
      const hit =
        tokens.some((token) => entry.exact.includes(token)) ||
        tokens.some((token) => entry.prefix.some((stem) => token.startsWith(stem)));
      if (hit) found.push(entry.label);
    }
  }
  return found;
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readFeatureImportance(vizData: Record<string, unknown> | null | undefined): FeatureImportance[] {
  const raw = vizData?.["feature_importance"];
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is FeatureImportance =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as FeatureImportance).feature === "string" &&
        typeof (item as FeatureImportance).importance === "number"
    )
    .map((item) => ({
      feature: prettyFeatureName(item.feature),
      importance: item.importance,
      rank: item.rank
    }))
    .sort((a, b) => b.importance - a.importance);
}

/** Construit les faits réels lus par les regards. Tolérant : un champ absent → null / []. */
export function extractInsights(results: RawResults): ResultInsights {
  const metrics = results.metrics ?? null;
  const vizData = results.viz_data ?? null;

  const rawImportance = Array.isArray(vizData?.["feature_importance"])
    ? (vizData!["feature_importance"] as { feature?: unknown }[])
    : [];
  const rawNames = rawImportance
    .map((item) => (typeof item.feature === "string" ? item.feature : ""))
    .filter(Boolean);

  const topFeatures = readFeatureImportance(vizData);

  let primaryMetric: ResultInsights["primaryMetric"] = null;
  if (metrics && typeof metrics["primary_metric"] === "string") {
    const key = metrics["primary_metric"] as string;
    const value = toNumber(metrics[key]);
    if (value !== null) primaryMetric = { key, value };
  }

  const taskType =
    results.task_type === "classification" || results.task_type === "regression"
      ? results.task_type
      : null;

  const classNames = Array.isArray(results.class_names) ? results.class_names : [];
  const confusion = vizData?.["confusion_matrix"];

  return {
    taskType,
    algorithm: typeof results.algorithm === "string" ? results.algorithm : null,
    primaryMetric,
    topFeatures,
    featureCount: topFeatures.length,
    sensitiveFeatures: detectSensitiveFeatures(rawNames),
    classNames,
    classCount: classNames.length,
    hasConfusion: typeof confusion === "object" && confusion !== null
  };
}
