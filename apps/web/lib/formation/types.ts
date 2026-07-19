// Types de « Apprendre » (l'Académie IA) — voir docs/formation/CAHIER-DES-CHARGES.md.
// Comme les Défis (lib/challenges), c'est une feature d'ORCHESTRATION : le catalogue ne porte
// que la STRUCTURE ; tout le texte (titres, mythes, explications, quiz) vit dans l'i18n
// `formation.*`, jamais ici. La progression vit dans un store Zustand persistant (localStorage).

/** Grade de l'apprenant — progression séquentielle, un cran par cursus terminé. */
export type Grade = "curieux" | "eveille" | "apprenti" | "praticien" | "analyste";

/** Ordre canonique des grades (index = rang). */
export const GRADE_ORDER: Grade[] = ["curieux", "eveille", "apprenti", "praticien", "analyste"];

/** Niveau d'un cursus — RÉUTILISE l'échelle des Défis (ChallengeLevel) pour la cohérence. */
export type CursusLevel = "novice" | "debutant" | "confirme";

/** Slugs de cursus (les 4 niveaux de l'académie ; la Vague 1 livre eveil + fondations). */
export type CursusSlug = "eveil" | "fondations" | "praticien" | "analyste";

/** Types de blocs pédagogiques (§3.5 du CDC). */
export type BlockType =
  | "myth" // B1 — Mythe → Réalité
  | "visual" // B2 — Explication visuelle (schéma en tokens)
  | "playground" // B3 — Bac à sable interactif (Vague 2)
  | "notion" // B4 — Carte-notion collectionnable
  | "quiz" // B5 — Quiz éclair (réponse expliquée)
  | "practice" // B8 — Mise en pratique (pont vers un vrai Défi)
  | "translator" // B6 — [Vague 2+]
  | "case_study" // B7 — [Vague 3]
  | "tutor" // B9 — [Vague 3]
  | "ia_vs_you"; // B10 — [Vague 2+]

/** Bacs à sable disponibles (B3) — chacun a son composant interactif dédié. */
export type PlaygroundKind = "confusion-threshold" | "overfitting-depth";

/**
 * Un bloc d'une leçon. `id` est le suffixe de clé i18n sous la leçon.
 * Les champs additionnels sont STRUCTURELS (indépendants de la langue) :
 *  - `notion`   : l'id de la carte-notion gagnée (bloc "notion") ;
 *  - `answer`   : l'index de la bonne réponse (bloc "quiz") — jamais dans l'i18n (P3) ;
 *  - `choices`  : le nombre d'options du quiz (bloc "quiz") ;
 *  - `challenge`: le slug d'un Défi VIVANT (bloc "practice") — validé contre CHALLENGES (P5).
 */
export interface Block {
  type: BlockType;
  id: string;
  notion?: string;
  answer?: number;
  choices?: number;
  challenge?: string;
  /** Variante de bac à sable (bloc "playground"). */
  playground?: PlaygroundKind;
}

/** Une leçon = une séquence ordonnée de blocs. */
export interface Lesson {
  slug: string;
  blocks: Block[];
}

/** Un module = un chapitre d'un cursus, regroupant des leçons. */
export interface Module {
  slug: string;
  lessons: Lesson[];
}

/** Un cursus = un niveau complet de l'académie. */
export interface Cursus {
  slug: CursusSlug;
  level: CursusLevel;
  /** Grade conféré à la complétion du cursus. */
  grade: Grade;
  /** Domaine pour le langage visuel (getDomainVisual). */
  domain: string;
  modules: Module[];
  /** Ordre d'affichage / de progression. */
  order: number;
}

/** Le cursus SUGGÈRE l'audience XAI (enum XaiAudience du backend), comme les Défis. */
export const XAI_AUDIENCE_BY_LEVEL: Record<CursusLevel, "novice" | "intermediate" | "expert"> = {
  novice: "novice",
  debutant: "intermediate",
  confirme: "expert"
};
