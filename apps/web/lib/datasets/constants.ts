// Miroir UI des constantes du backend (l'ordre suit ethics.ETHICAL_CRITERIA).
// La source de vérité des VALEURS reste l'API (P3) — ceci ne sert qu'à itérer/étiqueter.

export const ETHICAL_KEYS = [
  "informed_consent",
  "transparency",
  "user_control",
  "equity_non_discrimination",
  "security_measures_in_place",
  "data_quality_documented",
  "anonymization_applied",
  "record_keeping_policy_exists",
  "purpose_limitation_respected",
  "accountability_defined"
] as const;

export type EthicalKey = (typeof ETHICAL_KEYS)[number];

export const SORT_KEYS = [
  "name",
  "year",
  "instances",
  "features",
  "citations",
  "created",
  "updated"
] as const;

export const PAGE_SIZES = [12, 24, 48, 96] as const;

export const KNOWN_DOMAINS = [
  "education",
  "healthcare",
  "finance",
  "social",
  "biology",
  "business",
  "environment",
  "technology",
  "research"
] as const;

export const KNOWN_TASKS = [
  "classification",
  "regression",
  "clustering",
  "nlp",
  "time_series"
] as const;

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat().format(value);
}

/** Couleur du score (CDC §6.4) : ≥80 vert, ≥60 lime, ≥40 ambre, <40 rouge. */
export function scoreColorClass(percent: number): string {
  if (percent >= 80) return "text-green-600 dark:text-green-400";
  if (percent >= 60) return "text-lime-600 dark:text-lime-400";
  if (percent >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}
