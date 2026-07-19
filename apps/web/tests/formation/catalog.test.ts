import { describe, it, expect } from "vitest";

import { CURSUS, getCursus, findLesson, allLessons } from "@/lib/formation/catalog";
import { referencedChallenges } from "@/lib/formation/bridge";
import { getChallenge } from "@/lib/challenges/catalog";
import { GRADE_ORDER } from "@/lib/formation/types";

describe("catalogue de l'académie", () => {
  it("livre les cursus dans l'ordre (Éveil, Fondations, Praticien, Analyste)", () => {
    expect(CURSUS.map((c) => c.slug)).toEqual(["eveil", "fondations", "praticien", "analyste"]);
    expect(CURSUS.map((c) => c.order)).toEqual([0, 1, 2, 3]);
  });

  it("chaque bloc playground déclare une variante connue", () => {
    const kinds = new Set(["confusion-threshold", "overfitting-depth"]);
    for (const { lesson } of allLessons()) {
      for (const block of lesson.blocks) {
        if (block.type === "playground") {
          expect(kinds, `leçon ${lesson.slug}`).toContain(block.playground);
        }
      }
    }
  });

  it("chaque bloc practice pointe vers un Défi VIVANT (P5)", () => {
    for (const slug of referencedChallenges(CURSUS)) {
      expect(getChallenge(slug), `Défi manquant : ${slug}`).toBeDefined();
    }
  });

  it("les slugs de leçons sont uniques dans tout le catalogue", () => {
    const slugs = allLessons().map(({ lesson }) => lesson.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("les slugs de modules sont uniques", () => {
    const slugs = CURSUS.flatMap((c) => c.modules.map((m) => m.slug));
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("chaque quiz a un index de réponse cohérent avec son nombre d'options", () => {
    for (const { lesson } of allLessons()) {
      for (const block of lesson.blocks) {
        if (block.type === "quiz") {
          expect(block.choices).toBeGreaterThanOrEqual(2);
          expect(block.answer).toBeGreaterThanOrEqual(0);
          expect(block.answer!).toBeLessThan(block.choices!);
        }
      }
    }
  });

  it("chaque leçon a un bloc explicatif (visuel ou étude de cas) et se termine par quiz/pratique", () => {
    for (const { lesson } of allLessons()) {
      const types = lesson.blocks.map((b) => b.type);
      const hasExplainer = types.includes("visual") || types.includes("case_study");
      expect(hasExplainer, `leçon ${lesson.slug}`).toBe(true);
      const last = types[types.length - 1];
      expect(["quiz", "practice"], `leçon ${lesson.slug}`).toContain(last);
    }
  });

  it("les ids de cartes-notions sont uniques", () => {
    const notions = allLessons().flatMap(({ lesson }) =>
      lesson.blocks.filter((b) => b.type === "notion").map((b) => b.notion)
    );
    expect(new Set(notions).size).toBe(notions.length);
  });

  it("les grades des cursus sont des grades connus et croissants", () => {
    const ranks = CURSUS.map((c) => GRADE_ORDER.indexOf(c.grade));
    ranks.forEach((r) => expect(r).toBeGreaterThan(0));
    expect([...ranks]).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("getCursus et findLesson résolvent, undefined sinon", () => {
    expect(getCursus("eveil")?.order).toBe(0);
    expect(getCursus("inexistant")).toBeUndefined();
    expect(findLesson("ta-premiere-enquete")?.cursus.slug).toBe("fondations");
    expect(findLesson("inexistant")).toBeUndefined();
  });

  it("chaque cursus renvoie vers le bon niveau de Défi (ou aucun pour Éveil)", () => {
    expect(referencedChallenges([getCursus("eveil")!])).toEqual([]);
    expect(referencedChallenges([getCursus("fondations")!])).toEqual(["titanic-1912"]);
    expect(referencedChallenges([getCursus("praticien")!])).toEqual(["eleves-decrochage"]);
    expect(referencedChallenges([getCursus("analyste")!])).toEqual(["equite-revenus"]);
  });
});
