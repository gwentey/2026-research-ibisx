// Micro-badges de compétence (O13) — nommés par l'ACQUIS, pas par un score creux. Un badge se
// gagne dès que sa leçon-jalon est terminée. Le texte (titre, description) vit dans l'i18n
// `formation.badges.<id>`. Ordre = ordre pédagogique (respecté par earnedBadges).

export interface Badge {
  id: string;
  /** Leçon-jalon dont la complétion débloque le badge. */
  lesson: string;
}

export const BADGES: Badge[] = [
  { id: "premier-modele", lesson: "ta-premiere-enquete" },
  { id: "lire-matrice", lesson: "la-matrice-de-confusion" },
  { id: "reperer-surapprentissage", lesson: "le-surapprentissage" },
  { id: "importance-vs-cause", lesson: "importance-nest-pas-cause" },
  { id: "resultat-reproductible", lesson: "la-reproductibilite" },
  { id: "auditer-equite", lesson: "ta-troisieme-enquete" }
];

/** Ids des badges gagnés, dans l'ordre du catalogue (pédagogique). */
export function earnedBadges(lessonsDone: string[]): string[] {
  return BADGES.filter((badge) => lessonsDone.includes(badge.lesson)).map((badge) => badge.id);
}
