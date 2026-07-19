import { describe, expect, it } from "vitest";

import { ETHICAL_KEYS } from "@/lib/datasets/constants";
import {
  countUnsetCriteria,
  ethicsReviewState,
  suggestionsOf
} from "@/lib/datasets/ethics-review";

const allNull = Object.fromEntries(ETHICAL_KEYS.map((key) => [key, null]));
const allTrue = Object.fromEntries(ETHICAL_KEYS.map((key) => [key, true]));

const dataset = (overrides: Record<string, unknown> = {}) =>
  ({
    ethical_criteria: allNull,
    ethics_suggestions: null,
    ethics_reviewed_at: null,
    ...overrides
  }) as never;

describe("countUnsetCriteria", () => {
  it("compte les 10 critères quand rien n'est renseigné", () => {
    expect(countUnsetCriteria(allNull)).toBe(10);
  });

  it("ne compte pas un critère explicitement refusé", () => {
    // false = « évalué, absent » : c'est une décision, pas une absence de décision.
    expect(countUnsetCriteria({ ...allNull, transparency: false })).toBe(9);
  });

  it("tolère un critère totalement absent de l'objet", () => {
    const partial = { transparency: true };
    expect(countUnsetCriteria(partial)).toBe(9);
  });
});

describe("suggestionsOf", () => {
  it("renvoie des structures vides plutôt que undefined", () => {
    expect(suggestionsOf({ ethics_suggestions: null } as never)).toEqual({
      values: {},
      notes: {}
    });
  });

  it("extrait valeurs et justifications", () => {
    const result = suggestionsOf({
      ethics_suggestions: {
        values: { transparency: true },
        notes: { transparency: "Licence CC0." }
      }
    } as never);

    expect(result.values).toEqual({ transparency: true });
    expect(result.notes.transparency).toBe("Licence CC0.");
  });
});

describe("ethicsReviewState", () => {
  it("réclame une revue sur un import fraîchement arrivé", () => {
    const state = ethicsReviewState(
      dataset({ ethics_suggestions: { values: { transparency: true } } })
    );

    expect(state).toEqual({ kind: "pending", unset: 10, suggested: 1 });
  });

  it("réclame une revue même sans suggestion d'IA", () => {
    // Panne LLM à l'import : les critères sont vides, il faut quand même les remplir.
    expect(ethicsReviewState(dataset())).toMatchObject({ kind: "pending", suggested: 0 });
  });

  it("affiche la date une fois tout tranché et revu", () => {
    const state = ethicsReviewState(
      dataset({ ethical_criteria: allTrue, ethics_reviewed_at: "2026-07-19T10:00:00" })
    );

    expect(state).toEqual({ kind: "reviewed", reviewedAt: "2026-07-19T10:00:00" });
  });

  it("reste silencieux sur le catalogue historique déjà renseigné à la main", () => {
    // Renseigné mais jamais « revu » formellement : inutile de réclamer quoi que ce soit.
    expect(ethicsReviewState(dataset({ ethical_criteria: allTrue }))).toEqual({ kind: "hidden" });
  });

  it("continue de réclamer si la revue est partielle", () => {
    const partiallyReviewed = { ...allTrue, user_control: null };
    const state = ethicsReviewState(
      dataset({
        ethical_criteria: partiallyReviewed,
        ethics_reviewed_at: "2026-07-19T10:00:00"
      })
    );

    expect(state).toMatchObject({ kind: "pending", unset: 1 });
  });
});
