import { describe, it, expect } from "vitest";

import {
  cursusLessonSlugs,
  moduleDone,
  cursusPercent,
  cursusComplete,
  nextLesson,
  gradeFor,
  lessonNotions
} from "@/lib/formation/progress";
import type { Cursus } from "@/lib/formation/types";

// Fixture minimale (2 cursus, 2 modules, 3 leçons) — indépendante du vrai catalogue.
const eveil: Cursus = {
  slug: "eveil",
  level: "novice",
  grade: "eveille",
  domain: "research",
  order: 0,
  modules: [
    {
      slug: "m1",
      lessons: [
        { slug: "l1", blocks: [{ type: "notion", id: "n", notion: "ia-vs-ml" }] },
        { slug: "l2", blocks: [{ type: "quiz", id: "q", answer: 0, choices: 3 }] }
      ]
    }
  ]
};
const fondations: Cursus = {
  slug: "fondations",
  level: "novice",
  grade: "apprenti",
  domain: "education",
  order: 1,
  modules: [{ slug: "m2", lessons: [{ slug: "l3", blocks: [] }] }]
};
const catalog = [eveil, fondations];

describe("progression de l'académie", () => {
  it("liste à plat les slugs de leçons d'un cursus", () => {
    expect(cursusLessonSlugs(eveil)).toEqual(["l1", "l2"]);
  });

  it("un module est fait quand toutes ses leçons sont faites", () => {
    expect(moduleDone(eveil.modules[0], ["l1"])).toBe(false);
    expect(moduleDone(eveil.modules[0], ["l1", "l2"])).toBe(true);
  });

  it("un module sans leçon n'est jamais 'fait'", () => {
    expect(moduleDone({ slug: "vide", lessons: [] }, [])).toBe(false);
  });

  it("pourcentage de cursus arrondi", () => {
    expect(cursusPercent(eveil, [])).toBe(0);
    expect(cursusPercent(eveil, ["l1"])).toBe(50);
    expect(cursusPercent(eveil, ["l1", "l2"])).toBe(100);
  });

  it("cursusComplete exige toutes les leçons", () => {
    expect(cursusComplete(eveil, ["l1"])).toBe(false);
    expect(cursusComplete(eveil, ["l1", "l2"])).toBe(true);
  });

  it("nextLesson = première leçon non faite, null si tout est fait", () => {
    expect(nextLesson(eveil, [])?.slug).toBe("l1");
    expect(nextLesson(eveil, ["l1"])?.slug).toBe("l2");
    expect(nextLesson(eveil, ["l1", "l2"])).toBeNull();
  });

  it("gradeFor progresse séquentiellement (un cran par cursus complété dans l'ordre)", () => {
    expect(gradeFor(catalog, [])).toBe("curieux");
    expect(gradeFor(catalog, ["l1", "l2"])).toBe("eveille");
    expect(gradeFor(catalog, ["l1", "l2", "l3"])).toBe("apprenti");
  });

  it("gradeFor ne saute pas un cursus non terminé (séquentiel)", () => {
    // Fondations complet mais Éveil incomplet → on reste 'curieux'.
    expect(gradeFor(catalog, ["l3"])).toBe("curieux");
  });

  it("lessonNotions extrait les notions gagnées d'une leçon", () => {
    expect(lessonNotions(eveil.modules[0].lessons[0])).toEqual(["ia-vs-ml"]);
    expect(lessonNotions(eveil.modules[0].lessons[1])).toEqual([]);
  });
});
