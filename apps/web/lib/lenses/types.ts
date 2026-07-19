// « Regards métier » — types partagés (V1 front déterministe).
// Voir docs/superpowers/specs/2026-07-19-regards-metier-design.md

/** Les 6 disciplines SHS (regards). Le « classique » est l'absence de regard (null). */
export type LensId =
  | "economist"
  | "jurist"
  | "politist"
  | "sociologist"
  | "historian"
  | "ethicist";

export const LENS_IDS: readonly LensId[] = [
  "economist",
  "jurist",
  "politist",
  "sociologist",
  "historian",
  "ethicist"
] as const;

/** Une variable et son importance native (telle que servie par le back : viz_data.feature_importance). */
export interface FeatureImportance {
  feature: string;
  importance: number;
  rank: number;
}

/**
 * Faits RÉELS extraits d'un résultat d'expérience — la seule matière que les regards lisent.
 * Rien n'est inventé : chaque champ vient des vraies données du back (P1).
 */
export interface ResultInsights {
  taskType: "classification" | "regression" | null;
  algorithm: string | null;
  /** Métrique principale déclarée par le back (ex. f1_macro / mae) + sa valeur. */
  primaryMetric: { key: string; value: number } | null;
  /** Top variables associées (nom lisible), triées par importance décroissante. */
  topFeatures: FeatureImportance[];
  /** Nombre total de variables du modèle. */
  featureCount: number;
  /** Variables potentiellement sensibles utilisées par le modèle (noms lisibles, dédupliqués). */
  sensitiveFeatures: string[];
  classNames: string[];
  classCount: number;
  hasConfusion: boolean;
}

/** Entrée minimale acceptée par extractInsights (sous-ensemble structurel d'ExperimentResults). */
export interface RawResults {
  algorithm?: string | null;
  task_type?: string | null;
  class_names?: string[] | null;
  metrics?: Record<string, unknown> | null;
  viz_data?: Record<string, unknown> | null;
}
