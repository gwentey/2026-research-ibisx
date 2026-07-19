import { describe, expect, it } from "vitest";

import {
  detectSensitiveFeatures,
  extractInsights,
  prettyFeatureName
} from "@/lib/lenses/insights";
import type { RawResults } from "@/lib/lenses/types";

describe("prettyFeatureName", () => {
  it("retire le préfixe de transformer sklearn", () => {
    expect(prettyFeatureName("num__age")).toBe("age");
    expect(prettyFeatureName("cat__sex_Male")).toBe("sex_Male");
  });

  it("laisse un nom déjà propre intact", () => {
    expect(prettyFeatureName("absences")).toBe("absences");
  });
});

describe("detectSensitiveFeatures", () => {
  it("repère les attributs protégés par tokenisation (pas par sous-chaîne)", () => {
    const detected = detectSensitiveFeatures([
      "cat__sex_Male",
      "num__age",
      "cat__race_White",
      "num__hours_per_week"
    ]);
    expect(detected).toContain("sex");
    expect(detected).toContain("age");
    expect(detected).toContain("race");
    expect(detected).not.toContain("hours_per_week");
  });

  it("ne produit AUCUN faux positif quand 'age' n'est qu'une sous-chaîne", () => {
    const detected = detectSensitiveFeatures([
      "average_score",
      "page_views",
      "usage_count",
      "storage_gb"
    ]);
    expect(detected).toEqual([]);
  });

  it("déduplique les expansions one-hot d'une même colonne", () => {
    const detected = detectSensitiveFeatures([
      "cat__race_White",
      "cat__race_Black",
      "cat__race_Asian"
    ]);
    expect(detected).toEqual(["race"]);
  });

  it("reconnaît les libellés français et l'origine (native-country)", () => {
    const detected = detectSensitiveFeatures(["sexe", "cat__native_country_France", "religion"]);
    expect(detected).toContain("sex");
    expect(detected).toContain("origin");
    expect(detected).toContain("religion");
  });
});

describe("extractInsights", () => {
  const results: RawResults = {
    algorithm: "random_forest",
    task_type: "classification",
    class_names: ["<=50K", ">50K"],
    metrics: { f1_macro: 0.78, accuracy: 0.85, primary_metric: "f1_macro" },
    viz_data: {
      feature_importance: [
        { feature: "cat__sex_Male", importance: 0.1, rank: 3 },
        { feature: "num__education_num", importance: 0.4, rank: 1 },
        { feature: "num__hours_per_week", importance: 0.25, rank: 2 }
      ],
      confusion_matrix: { classes: ["<=50K", ">50K"], matrix: [[100, 10], [20, 70]] }
    }
  };

  it("trie les variables par importance décroissante et nettoie les noms", () => {
    const insights = extractInsights(results);
    expect(insights.topFeatures.map((f) => f.feature)).toEqual([
      "education_num",
      "hours_per_week",
      "sex_Male"
    ]);
    expect(insights.featureCount).toBe(3);
  });

  it("expose la métrique principale déclarée par le back", () => {
    const insights = extractInsights(results);
    expect(insights.primaryMetric).toEqual({ key: "f1_macro", value: 0.78 });
  });

  it("détecte les variables sensibles parmi les features du modèle", () => {
    const insights = extractInsights(results);
    expect(insights.sensitiveFeatures).toContain("sex");
  });

  it("remonte classes, tâche et présence de matrice de confusion", () => {
    const insights = extractInsights(results);
    expect(insights.taskType).toBe("classification");
    expect(insights.classNames).toEqual(["<=50K", ">50K"]);
    expect(insights.classCount).toBe(2);
    expect(insights.hasConfusion).toBe(true);
  });

  it("reste robuste sur un résultat vide (aucune donnée inventée)", () => {
    const insights = extractInsights({});
    expect(insights.topFeatures).toEqual([]);
    expect(insights.sensitiveFeatures).toEqual([]);
    expect(insights.primaryMetric).toBeNull();
    expect(insights.taskType).toBeNull();
    expect(insights.hasConfusion).toBe(false);
  });
});
