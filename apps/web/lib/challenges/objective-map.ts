import type { ObjectiveId } from "./types";

// Mapping PUR route → objectifs franchis. Chaque objectif ne se coche que sur une VRAIE
// transition du produit (P1) :
//  - une FICHE dataset (/datasets/<id>) = l'utilisateur a ouvert le jeu de données ;
//  - le WIZARD (/wizard) = un projet a forcément été créé en amont pour y arriver ;
//  - une page de RÉSULTATS (/experiments/<id>) = un entraînement réel a tourné puis abouti.
// L'explication (generate_explanation) n'est pas déductible de l'URL : elle est signalée par
// le débrief qui vérifie la présence d'un vrai résultat XAI.
const NON_DATASET_SEGMENTS = new Set(["score", "upload"]);

export function pathnameToObjectives(pathname: string): ObjectiveId[] {
  const dataset = pathname.match(/^\/datasets\/([^/]+)$/);
  if (dataset && !NON_DATASET_SEGMENTS.has(dataset[1])) return ["open_dataset"];

  if (pathname === "/wizard" || pathname.startsWith("/wizard/")) return ["create_project"];

  if (/^\/experiments\/[^/]+$/.test(pathname)) return ["launch_training", "read_results"];

  return [];
}

// Emplacement dans le parcours, déduit de l'URL — pour un coaching indexé sur OÙ l'utilisateur
// se trouve (le bon geste sur la page courante), pas sur l'objectif « suivant » (qui peut couvrir
// deux pages : la fiche dataset PUIS la création de projet mènent toutes deux à « créer le projet »).
export type CoachLocation = "at_dataset" | "at_project" | "at_wizard" | "at_results";

export function coachLocation(pathname: string): CoachLocation | null {
  const dataset = pathname.match(/^\/datasets\/([^/]+)$/);
  if (dataset && !NON_DATASET_SEGMENTS.has(dataset[1])) return "at_dataset";
  if (pathname === "/projects/new") return "at_project";
  if (pathname === "/wizard" || pathname.startsWith("/wizard/")) return "at_wizard";
  if (/^\/experiments\/[^/]+$/.test(pathname)) return "at_results";
  return null;
}
