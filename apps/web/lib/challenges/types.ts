// Types des « Défis » — missions guidées gamifiées (docs/parcours/CAHIER-DES-CHARGES.md).
// Feature d'ORCHESTRATION : ces types décrivent des cas d'étude adossés à de vrais datasets
// seedés, pas de nouvelles entités backend.

/** Niveau d'un défi = degré de guidage (pas un dataset différent). */
export type ChallengeLevel = "novice" | "debutant" | "confirme";

/** Un objectif cochable — se valide sur une VRAIE transition du produit (P1). */
export type ObjectiveId =
  | "open_dataset"
  | "create_project"
  | "launch_training"
  | "read_results"
  | "generate_explanation";

/** Où « Démarrer l'enquête » dépose l'utilisateur dans le vrai produit. */
export type EntryMode = "dataset" | "project_direct";

export interface Challenge {
  /** Slug DU DÉFI (ex. "titanic-1912"), distinct du slug du dataset. */
  slug: string;
  /** Slug DU DATASET seedé mobilisé (ex. "titanic" = DatasetCard.dataset_name). */
  datasetSlug: string;
  level: ChallengeLevel;
  /** Domaine pour le langage visuel (getDomainVisual). */
  domain: string;
  taskType: "classification" | "regression";
  objectives: ObjectiveId[];
  entryMode: EntryMode;
  /** Ordre d'affichage dans son niveau. */
  order: number;
}

/** Progression persistée (localStorage) : slugs de défis terminés. */
export interface ChallengeProgress {
  completed: string[];
}

/** Le niveau du défi SUGGÈRE l'audience XAI (enum XaiAudience du backend). */
export const XAI_AUDIENCE_BY_LEVEL: Record<ChallengeLevel, "novice" | "intermediate" | "expert"> = {
  novice: "novice",
  debutant: "intermediate",
  confirme: "expert"
};
