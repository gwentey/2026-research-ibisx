import { describe, it, expect } from "vitest";

import {
  confusionAt,
  confusionMetrics,
  overfittingCurve,
  type ScoredPoint
} from "@/lib/formation/playground";

// Nuage d'illustration : 4 positifs (scores hauts) + 4 négatifs (scores bas).
const POINTS: ScoredPoint[] = [
  { score: 0.9, positive: true },
  { score: 0.8, positive: true },
  { score: 0.6, positive: true },
  { score: 0.55, positive: true },
  { score: 0.5, positive: false },
  { score: 0.4, positive: false },
  { score: 0.3, positive: false },
  { score: 0.1, positive: false }
];

describe("playground — matrice de confusion selon le seuil", () => {
  it("prédit positif quand score >= seuil (seuil bas : tout est capté)", () => {
    // seuil 0.55 : les 4 positifs passent, aucun négatif → séparation parfaite
    expect(confusionAt(POINTS, 0.55)).toEqual({ tp: 4, fp: 0, tn: 4, fn: 0 });
  });

  it("seuil haut : on rate des positifs (faux négatifs montent)", () => {
    expect(confusionAt(POINTS, 0.65)).toEqual({ tp: 2, fp: 0, tn: 4, fn: 2 });
  });

  it("seuil trop bas : des négatifs passent (faux positifs montent)", () => {
    expect(confusionAt(POINTS, 0.35)).toEqual({ tp: 4, fp: 2, tn: 2, fn: 0 });
  });

  it("métriques dérivées (précision, rappel, exactitude), sans division par zéro", () => {
    const m = confusionMetrics({ tp: 2, fp: 0, tn: 4, fn: 2 });
    expect(m.precision).toBe(1);
    expect(m.recall).toBe(0.5);
    expect(m.accuracy).toBe(0.75);
    // aucun prédit positif → précision définie à 0 (pas NaN)
    expect(confusionMetrics({ tp: 0, fp: 0, tn: 8, fn: 0 }).precision).toBe(0);
  });
});

describe("playground — sur-apprentissage selon la profondeur", () => {
  it("l'exactitude d'entraînement monte toujours avec la profondeur", () => {
    const curve = overfittingCurve();
    for (let i = 1; i < curve.length; i += 1) {
      expect(curve[i].train).toBeGreaterThanOrEqual(curve[i - 1].train);
    }
  });

  it("l'exactitude de test monte puis redescend (l'écart se creuse)", () => {
    const curve = overfittingCurve();
    const bestTest = Math.max(...curve.map((p) => p.test));
    // le dernier point (arbre le plus profond) sur-apprend : test < meilleur test
    expect(curve[curve.length - 1].test).toBeLessThan(bestTest);
    // et l'écart train-test y est le plus large
    const gap = (p: { train: number; test: number }) => p.train - p.test;
    expect(gap(curve[curve.length - 1])).toBeGreaterThan(gap(curve[0]));
  });
});
