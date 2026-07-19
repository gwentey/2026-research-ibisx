import { describe, it, expect, beforeEach } from "vitest";

import { useAcademyStore } from "@/lib/formation/store";

function reset() {
  useAcademyStore.setState({ lessonsDone: [], notionsOwned: [] });
}

describe("store de l'académie", () => {
  beforeEach(reset);

  it("completeLesson marque une leçon faite (idempotent)", () => {
    useAcademyStore.getState().completeLesson("le-grand-malentendu");
    useAcademyStore.getState().completeLesson("le-grand-malentendu");
    expect(useAcademyStore.getState().lessonsDone).toEqual(["le-grand-malentendu"]);
  });

  it("completeLesson attribue les cartes-notions de la leçon (dédupliquées)", () => {
    useAcademyStore.getState().completeLesson("l1", ["ia-predictive"]);
    useAcademyStore.getState().completeLesson("l2", ["ia-predictive", "modele"]);
    expect(useAcademyStore.getState().notionsOwned.sort()).toEqual(["ia-predictive", "modele"]);
  });

  it("isLessonDone reflète l'état", () => {
    expect(useAcademyStore.getState().isLessonDone("l1")).toBe(false);
    useAcademyStore.getState().completeLesson("l1");
    expect(useAcademyStore.getState().isLessonDone("l1")).toBe(true);
  });

  it("reset vide la progression", () => {
    useAcademyStore.getState().completeLesson("l1", ["modele"]);
    useAcademyStore.getState().reset();
    expect(useAcademyStore.getState().lessonsDone).toEqual([]);
    expect(useAcademyStore.getState().notionsOwned).toEqual([]);
  });
});
