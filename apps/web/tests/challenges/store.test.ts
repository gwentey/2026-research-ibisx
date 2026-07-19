import { describe, it, expect, beforeEach } from "vitest";

import { useQuestStore } from "@/lib/challenges/store";
import type { ObjectiveId } from "@/lib/challenges/types";

function reset() {
  useQuestStore.setState({ activeSlug: null, done: [], completed: [] });
}

describe("store de quête", () => {
  beforeEach(reset);

  it("start active un défi et vide les objectifs", () => {
    useQuestStore.getState().start("titanic-1912");
    expect(useQuestStore.getState().activeSlug).toBe("titanic-1912");
    expect(useQuestStore.getState().done).toEqual([]);
  });

  it("markObjective est idempotent", () => {
    useQuestStore.getState().start("titanic-1912");
    useQuestStore.getState().markObjective("open_dataset");
    useQuestStore.getState().markObjective("open_dataset");
    expect(useQuestStore.getState().done).toEqual(["open_dataset"]);
  });

  it("marque le défi complété quand TOUS ses objectifs sont faits", () => {
    // iris-hello-world : create_project, launch_training, read_results
    useQuestStore.getState().start("iris-hello-world");
    (["create_project", "launch_training", "read_results"] as ObjectiveId[]).forEach((objective) =>
      useQuestStore.getState().markObjective(objective)
    );
    expect(useQuestStore.getState().isCompleted("iris-hello-world")).toBe(true);
  });

  it("ne complète pas un défi partiellement fait", () => {
    useQuestStore.getState().start("iris-hello-world");
    useQuestStore.getState().markObjective("create_project");
    expect(useQuestStore.getState().isCompleted("iris-hello-world")).toBe(false);
  });

  it("quit désactive sans effacer les complétions", () => {
    useQuestStore.getState().start("iris-hello-world");
    (["create_project", "launch_training", "read_results"] as ObjectiveId[]).forEach((objective) =>
      useQuestStore.getState().markObjective(objective)
    );
    useQuestStore.getState().quit();
    expect(useQuestStore.getState().activeSlug).toBeNull();
    expect(useQuestStore.getState().isCompleted("iris-hello-world")).toBe(true);
  });
});
