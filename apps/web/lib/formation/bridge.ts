import type { Cursus, Lesson } from "./types";

// Pont Formation → Défis (§3.4 du CDC). La mise en pratique d'une leçon renvoie vers un VRAI
// Défi vivant (P5 : zéro lien mort). Ces helpers PURS extraient les Défis référencés ; un test
// de catalogue vérifie que chacun existe bien dans CHALLENGES.

/** Slug du Défi de la première mise en pratique d'une leçon, ou undefined. */
export function lessonPractice(lesson: Lesson): string | undefined {
  return lesson.blocks.find((block) => block.type === "practice" && block.challenge)?.challenge;
}

/** Tous les slugs de Défis cités par des blocs "practice", dédupliqués. */
export function referencedChallenges(cursusList: Cursus[]): string[] {
  const slugs = new Set<string>();
  for (const cursus of cursusList) {
    for (const mod of cursus.modules) {
      for (const lesson of mod.lessons) {
        for (const block of lesson.blocks) {
          if (block.type === "practice" && block.challenge) slugs.add(block.challenge);
        }
      }
    }
  }
  return [...slugs];
}
