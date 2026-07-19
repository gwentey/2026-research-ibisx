import type { XaiAudience } from "@/lib/api/generated";

// Politique d'adaptation par niveau (docs/adaptatif/CAHIER-DES-CHARGES.md §4).
// Le « niveau effectif » (profil par défaut, surchargeable) pilote QUELS blocs de résultats
// sont montrés directement, et lesquels sont REPLIÉS (jamais supprimés — P1).

export const AUDIENCE_ORDER: XaiAudience[] = ["novice", "intermediate", "expert"];

export const AUDIENCE_RANK: Record<XaiAudience, number> = {
  novice: 0,
  intermediate: 1,
  expert: 2
};

/** Blocs de l'onglet Performance soumis à la révélation progressive. */
export type ResultBlock =
  | "metric_grid"
  | "confusion"
  | "curves"
  | "importance"
  | "regression"
  | "tree"
  | "preprocessing"
  | "logs";

/** Niveau minimal pour voir un bloc directement (en dessous → replié dans « Détails avancés »). */
export const BLOCK_MIN_AUDIENCE: Record<ResultBlock, XaiAudience> = {
  confusion: "novice", // matrice de confusion : visuelle, intuitive
  importance: "novice", // ce qui a compté
  metric_grid: "intermediate", // grille complète des métriques secondaires
  curves: "intermediate", // ROC / PR
  regression: "intermediate", // prédictions vs réel / résidus
  tree: "intermediate", // arbre de décision
  preprocessing: "expert", // transformations réellement appliquées
  logs: "expert" // journal d'entraînement
};

export function isBlockVisible(block: ResultBlock, effective: XaiAudience): boolean {
  return AUDIENCE_RANK[effective] >= AUDIENCE_RANK[BLOCK_MIN_AUDIENCE[block]];
}

export type AudienceComparison = "same" | "above" | "below";

/** Le niveau effectif est-il au-dessus / en-dessous / égal au niveau du profil ? */
export function compareAudience(effective: XaiAudience, profile: XaiAudience): AudienceComparison {
  if (AUDIENCE_RANK[effective] === AUDIENCE_RANK[profile]) return "same";
  return AUDIENCE_RANK[effective] > AUDIENCE_RANK[profile] ? "above" : "below";
}
