import type { Challenge } from "./types";

export { XAI_AUDIENCE_BY_LEVEL } from "./types";

// Les 6 enquêtes du premier livrable. CHAQUE défi est adossé à un dataset RÉELLEMENT seedé
// (apps/api/seed_data/datasets.yaml) et à une tâche que le pipeline sait exécuter (P1/P5).
// Le texte (briefing, débrief, coach) vit dans l'i18n `challenges.items.<slug>`, jamais ici.
//
// Objectifs croissants avec le niveau : novice va jusqu'aux résultats ; à partir de débutant,
// l'explication XAI fait partie de la quête.
export const CHALLENGES: Challenge[] = [
  {
    slug: "titanic-1912",
    datasetSlug: "titanic",
    level: "novice",
    domain: "social",
    taskType: "classification",
    entryMode: "dataset",
    order: 1,
    objectives: ["open_dataset", "create_project", "launch_training", "read_results"]
  },
  {
    slug: "penguins-antarctique",
    datasetSlug: "penguins",
    level: "novice",
    domain: "biology",
    taskType: "classification",
    entryMode: "dataset",
    order: 2,
    objectives: ["open_dataset", "create_project", "launch_training", "read_results"]
  },
  {
    slug: "eleves-decrochage",
    datasetSlug: "student_performance",
    level: "debutant",
    domain: "education",
    taskType: "classification",
    entryMode: "project_direct",
    order: 1,
    objectives: ["create_project", "launch_training", "read_results", "generate_explanation"]
  },
  {
    slug: "depistage-diabete",
    datasetSlug: "pima_diabetes",
    level: "debutant",
    domain: "healthcare",
    taskType: "classification",
    entryMode: "project_direct",
    order: 2,
    objectives: ["create_project", "launch_training", "read_results", "generate_explanation"]
  },
  {
    slug: "noter-un-vin",
    datasetSlug: "wine_quality_red",
    level: "confirme",
    domain: "business",
    taskType: "regression",
    entryMode: "dataset",
    order: 1,
    objectives: ["create_project", "launch_training", "read_results", "generate_explanation"]
  },
  {
    slug: "iris-hello-world",
    datasetSlug: "iris",
    level: "confirme",
    domain: "biology",
    taskType: "classification",
    entryMode: "dataset",
    order: 2,
    objectives: ["create_project", "launch_training", "read_results"]
  },
  // Défis « équité » (recherche) : entraîner un vrai modèle puis auditer son biais via la XAI.
  {
    slug: "equite-revenus",
    datasetSlug: "adult_income",
    level: "confirme",
    domain: "social",
    taskType: "classification",
    entryMode: "dataset",
    order: 3,
    objectives: ["create_project", "launch_training", "read_results", "generate_explanation"]
  },
  {
    slug: "equite-credit",
    datasetSlug: "german_credit",
    level: "confirme",
    domain: "finance",
    taskType: "classification",
    entryMode: "dataset",
    order: 4,
    objectives: ["create_project", "launch_training", "read_results", "generate_explanation"]
  }
];

export function getChallenge(slug: string): Challenge | undefined {
  return CHALLENGES.find((challenge) => challenge.slug === slug);
}

/** Défis d'un niveau donné, triés par ordre d'affichage. */
export function challengesByLevel(level: Challenge["level"]): Challenge[] {
  return CHALLENGES.filter((challenge) => challenge.level === level).sort((a, b) => a.order - b.order);
}
