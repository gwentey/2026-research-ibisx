import { GRADE_ORDER } from "./types";
import type { Cursus, Grade, Lesson, Module } from "./types";

// Helpers PURS de progression (aucun état, aucun React) — testables isolément, comme
// lib/challenges/progress.ts. La progression = la liste des slugs de leçons terminées.

/** Slugs de toutes les leçons d'un cursus, à plat, dans l'ordre. */
export function cursusLessonSlugs(cursus: Cursus): string[] {
  return cursus.modules.flatMap((mod) => mod.lessons.map((lesson) => lesson.slug));
}

/** Un module est fait quand il a au moins une leçon ET que toutes sont faites. */
export function moduleDone(mod: Module, done: string[]): boolean {
  return mod.lessons.length > 0 && mod.lessons.every((lesson) => done.includes(lesson.slug));
}

/** Pourcentage de leçons faites dans un cursus, arrondi. */
export function cursusPercent(cursus: Cursus, done: string[]): number {
  const slugs = cursusLessonSlugs(cursus);
  if (slugs.length === 0) return 0;
  const hit = slugs.filter((slug) => done.includes(slug)).length;
  return Math.round((hit / slugs.length) * 100);
}

/** Un cursus est complet quand toutes ses leçons sont faites. */
export function cursusComplete(cursus: Cursus, done: string[]): boolean {
  const slugs = cursusLessonSlugs(cursus);
  return slugs.length > 0 && slugs.every((slug) => done.includes(slug));
}

/** Première leçon non faite d'un cursus (dans l'ordre), ou null si tout est fait. */
export function nextLesson(cursus: Cursus, done: string[]): Lesson | null {
  for (const mod of cursus.modules) {
    for (const lesson of mod.lessons) {
      if (!done.includes(lesson.slug)) return lesson;
    }
  }
  return null;
}

/**
 * Grade de l'apprenant : progression SÉQUENTIELLE. On monte d'un cran pour chaque cursus
 * complété dans l'ordre ; on s'arrête au premier cursus non terminé (on ne « saute » pas).
 */
export function gradeFor(cursusList: Cursus[], done: string[]): Grade {
  const ordered = [...cursusList].sort((a, b) => a.order - b.order);
  let grade: Grade = "curieux";
  for (const cursus of ordered) {
    if (!cursusComplete(cursus, done)) break;
    grade = cursus.grade;
  }
  return grade;
}

/** Ids des cartes-notions gagnées par une leçon (ses blocs de type "notion"). */
export function lessonNotions(lesson: Lesson): string[] {
  return lesson.blocks
    .filter((block) => block.type === "notion" && block.notion)
    .map((block) => block.notion as string);
}

/** Rang numérique d'un grade (pour comparer/afficher). */
export function gradeRank(grade: Grade): number {
  return GRADE_ORDER.indexOf(grade);
}
