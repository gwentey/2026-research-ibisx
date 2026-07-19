import { describe, it, expect } from "vitest";

import { pathnameToObjectives } from "@/lib/challenges/objective-map";

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
