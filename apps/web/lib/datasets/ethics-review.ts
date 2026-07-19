import type { DatasetDetail } from "@/lib/api/generated";
import { ETHICAL_KEYS } from "@/lib/datasets/constants";

/** Ce que le bandeau de revue éthique doit afficher — logique pure, testable. */
export type EthicsReviewState =
  | { kind: "reviewed"; reviewedAt: string }
  | { kind: "pending"; unset: number; suggested: number }
  | { kind: "hidden" };

type SuggestionPayload = { values?: Record<string, boolean>; notes?: Record<string, string> };

export function suggestionsOf(dataset: Pick<DatasetDetail, "ethics_suggestions">): {
  values: Record<string, boolean>;
  notes: Record<string, string>;
} {
  const raw = dataset.ethics_suggestions as SuggestionPayload | null | undefined;
  return { values: raw?.values ?? {}, notes: raw?.notes ?? {} };
}

export function countUnsetCriteria(criteria: Record<string, boolean | null | undefined>): number {
  return ETHICAL_KEYS.filter((key) => (criteria[key] ?? null) === null).length;
}

/**
 * Le bandeau ne s'affiche que s'il y a réellement quelque chose à faire.
 *
 * Un dataset entièrement renseigné ET revu montre juste la date ; un dataset complet mais
 * jamais formellement revu (le catalogue historique) ne montre rien du tout — inutile de
 * réclamer une validation pour des critères déjà renseignés à la main.
 */
export function ethicsReviewState(
  dataset: Pick<DatasetDetail, "ethical_criteria" | "ethics_suggestions" | "ethics_reviewed_at">
): EthicsReviewState {
  const criteria = dataset.ethical_criteria as Record<string, boolean | null>;
  const unset = countUnsetCriteria(criteria);
  const suggested = Object.keys(suggestionsOf(dataset).values).length;

  if (dataset.ethics_reviewed_at && unset === 0) {
    return { kind: "reviewed", reviewedAt: dataset.ethics_reviewed_at };
  }
  if (unset === 0 && suggested === 0) {
    return { kind: "hidden" };
  }
  return { kind: "pending", unset, suggested };
}
