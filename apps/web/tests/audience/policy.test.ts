import { describe, it, expect } from "vitest";

import { isBlockVisible, compareAudience } from "@/lib/audience/policy";

describe("politique de révélation progressive", () => {
  it("le novice voit l'essentiel (confusion, importance) mais pas l'avancé", () => {
    expect(isBlockVisible("confusion", "novice")).toBe(true);
    expect(isBlockVisible("importance", "novice")).toBe(true);
    expect(isBlockVisible("metric_grid", "novice")).toBe(false);
    expect(isBlockVisible("curves", "novice")).toBe(false);
    expect(isBlockVisible("tree", "novice")).toBe(false);
    expect(isBlockVisible("preprocessing", "novice")).toBe(false);
    expect(isBlockVisible("logs", "novice")).toBe(false);
  });

  it("l'intermédiaire voit les graphes techniques mais pas les internes expert", () => {
    expect(isBlockVisible("metric_grid", "intermediate")).toBe(true);
    expect(isBlockVisible("curves", "intermediate")).toBe(true);
    expect(isBlockVisible("tree", "intermediate")).toBe(true);
    expect(isBlockVisible("preprocessing", "intermediate")).toBe(false);
    expect(isBlockVisible("logs", "intermediate")).toBe(false);
  });

  it("l'expert voit tout", () => {
    for (const block of ["metric_grid", "confusion", "curves", "importance", "regression", "tree", "preprocessing", "logs"] as const) {
      expect(isBlockVisible(block, "expert")).toBe(true);
    }
  });

  it("compareAudience situe le niveau effectif vs le profil", () => {
    expect(compareAudience("novice", "novice")).toBe("same");
    expect(compareAudience("expert", "novice")).toBe("above");
    expect(compareAudience("novice", "expert")).toBe("below");
    expect(compareAudience("intermediate", "novice")).toBe("above");
  });
});
