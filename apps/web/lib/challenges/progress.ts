import type { ObjectiveId } from "./types";

// Helpers PURS de progression (aucun état, aucun React) — testables isolément.

export function isChallengeComplete(objectives: ObjectiveId[], done: ObjectiveId[]): boolean {
  return objectives.length > 0 && objectives.every((objective) => done.includes(objective));
}

export function progressPercent(objectives: ObjectiveId[], done: ObjectiveId[]): number {
  if (objectives.length === 0) return 0;
  const hit = objectives.filter((objective) => done.includes(objective)).length;
  return Math.round((hit / objectives.length) * 100);
}

export function nextObjective(objectives: ObjectiveId[], done: ObjectiveId[]): ObjectiveId | null {
  return objectives.find((objective) => !done.includes(objective)) ?? null;
}
