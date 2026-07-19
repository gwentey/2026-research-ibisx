import { allLessons } from "./catalog";
import { lessonNotions } from "./progress";

// Glossaire vivant (O4) : un index PUR des cartes-notions, chacune reliée à la leçon qui
// l'enseigne. Alimente la page /formation/glossaire et l'infobulle contextuelle. Le texte
// (terme, définition, exemple) vit dans l'i18n `formation.notions.<id>` — ici, la structure.

export interface GlossaryEntry {
  notionId: string;
  cursusSlug: string;
  lessonSlug: string;
}

/** Toutes les notions du catalogue, reliées à leur leçon, triées par id (terme). */
export function glossaryEntries(): GlossaryEntry[] {
  const entries: GlossaryEntry[] = [];
  for (const { cursus, lesson } of allLessons()) {
    for (const notionId of lessonNotions(lesson)) {
      entries.push({ notionId, cursusSlug: cursus.slug, lessonSlug: lesson.slug });
    }
  }
  return entries.sort((a, b) => a.notionId.localeCompare(b.notionId));
}

/** Où une notion est-elle enseignée ? (pour le lien « en savoir plus » de l'infobulle) */
export function notionLesson(notionId: string): GlossaryEntry | undefined {
  return glossaryEntries().find((entry) => entry.notionId === notionId);
}
