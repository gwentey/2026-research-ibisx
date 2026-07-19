import { describe, it, expect } from "vitest";

import { BADGES, earnedBadges } from "@/lib/formation/badges";
import { findLesson } from "@/lib/formation/catalog";

describe("micro-badges de compétence (O13)", () => {
  it("aucun badge sans progression", () => {
    expect(earnedBadges([])).toEqual([]);
  });

  it("un badge est gagné dès que sa leçon-jalon est faite", () => {
    expect(earnedBadges(["la-matrice-de-confusion"])).toContain("lire-matrice");
  });

  it("ne rend que les badges dont la leçon est faite (ordre stable = ordre du catalogue)", () => {
    const earned = earnedBadges(["le-surapprentissage", "la-matrice-de-confusion"]);
    expect(earned).toEqual(["lire-matrice", "reperer-surapprentissage"]);
  });

  it("chaque badge vise une leçon-jalon VIVANTE du catalogue", () => {
    for (const badge of BADGES) {
      expect(findLesson(badge.lesson), `leçon manquante : ${badge.lesson}`).toBeDefined();
    }
  });

  it("les ids de badges sont uniques", () => {
    const ids = BADGES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
