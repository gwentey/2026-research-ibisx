import { describe, it, expect } from "vitest";

import { isChallengeComplete, progressPercent, nextObjective } from "@/lib/challenges/progress";
import type { ObjectiveId } from "@/lib/challenges/types";

const objs: ObjectiveId[] = ["create_project", "launch_training", "read_results"];

describe("progression d'un défi", () => {
  it("incomplet tant qu'il manque un objectif", () => {
    expect(isChallengeComplete(objs, ["create_project"])).toBe(false);
  });

  it("complet quand tous les objectifs y sont (ordre indifférent)", () => {
    expect(isChallengeComplete(objs, ["read_results", "create_project", "launch_training"])).toBe(true);
  });

  it("pourcentage arrondi", () => {
    expect(progressPercent(objs, ["create_project"])).toBe(33);
    expect(progressPercent(objs, [])).toBe(0);
    expect(progressPercent([], [])).toBe(0);
  });

  it("prochain objectif = premier non fait, null si tout est fait", () => {
    expect(nextObjective(objs, ["create_project"])).toBe("launch_training");
    expect(nextObjective(objs, objs)).toBeNull();
  });
});
