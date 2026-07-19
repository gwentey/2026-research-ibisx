import { describe, it, expect } from "vitest";

import { pathnameToObjectives, coachLocation } from "@/lib/challenges/objective-map";

describe("pathnameToObjectives", () => {
  it("une fiche dataset → open_dataset", () => {
    expect(pathnameToObjectives("/datasets/abc-123")).toEqual(["open_dataset"]);
  });

  it("le catalogue et les sous-pages ne comptent pas comme fiche", () => {
    expect(pathnameToObjectives("/datasets")).toEqual([]);
    expect(pathnameToObjectives("/datasets/score")).toEqual([]);
    expect(pathnameToObjectives("/datasets/upload")).toEqual([]);
  });

  it("le wizard → create_project (le projet existe forcément en amont)", () => {
    expect(pathnameToObjectives("/wizard")).toEqual(["create_project"]);
  });

  it("une page de résultats → launch_training + read_results", () => {
    expect(pathnameToObjectives("/experiments/xyz-9")).toEqual(["launch_training", "read_results"]);
  });

  it("la liste des expériences ne compte pas", () => {
    expect(pathnameToObjectives("/experiments")).toEqual([]);
  });

  it("une route quelconque → aucun objectif", () => {
    expect(pathnameToObjectives("/dashboard")).toEqual([]);
  });
});

describe("coachLocation", () => {
  it("mappe chaque page-clé du parcours à son emplacement", () => {
    expect(coachLocation("/datasets/abc-123")).toBe("at_dataset");
    expect(coachLocation("/projects/new")).toBe("at_project");
    expect(coachLocation("/wizard")).toBe("at_wizard");
    expect(coachLocation("/experiments/xyz-9")).toBe("at_results");
  });

  it("ignore les pages hors parcours", () => {
    expect(coachLocation("/datasets")).toBeNull();
    expect(coachLocation("/datasets/upload")).toBeNull();
    expect(coachLocation("/projects")).toBeNull();
    expect(coachLocation("/dashboard")).toBeNull();
  });
});
