import { describe, it, expect } from "vitest";

import { CHALLENGES, getChallenge, XAI_AUDIENCE_BY_LEVEL } from "@/lib/challenges/catalog";

// Datasets réellement embarqués dans le seed (apps/api/seed_data/datasets.yaml) — 24 jeux.
const SEEDED = [
  "iris", "student_performance", "titanic", "pima_diabetes", "wine_quality_red", "penguins",
  "wine_recognition", "breast_cancer_wisconsin", "diabetes_progression", "handwritten_digits",
  "german_credit", "adult_income", "mushroom", "car_evaluation", "heart_disease", "bank_marketing",
  "glass_identification", "ionosphere", "banknote_authentication", "blood_transfusion",
  "contraceptive_choice", "abalone_age", "auto_mpg", "california_housing"
];

describe("catalogue de défis", () => {
  it("chaque défi cible un dataset réellement seedé (P5)", () => {
    for (const c of CHALLENGES) expect(SEEDED).toContain(c.datasetSlug);
  });

  it("les slugs de défi sont uniques", () => {
    const slugs = CHALLENGES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("chaque défi a au moins 3 objectifs et se termine par read_results", () => {
    for (const c of CHALLENGES) {
      expect(c.objectives.length).toBeGreaterThanOrEqual(3);
      expect(c.objectives).toContain("read_results");
    }
  });

  it("les 3 niveaux sont représentés", () => {
    const levels = new Set(CHALLENGES.map((c) => c.level));
    expect(levels).toEqual(new Set(["novice", "debutant", "confirme"]));
  });

  it("getChallenge résout par slug", () => {
    expect(getChallenge("titanic-1912")?.datasetSlug).toBe("titanic");
    expect(getChallenge("inexistant")).toBeUndefined();
  });

  it("mappe chaque niveau à une audience XAI", () => {
    expect(XAI_AUDIENCE_BY_LEVEL.novice).toBe("novice");
    expect(XAI_AUDIENCE_BY_LEVEL.debutant).toBe("intermediate");
    expect(XAI_AUDIENCE_BY_LEVEL.confirme).toBe("expert");
  });
});
