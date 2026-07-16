import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import fr from "../messages/fr.json";

// i18n FR/EN complet (CDC §12.1) : les deux catalogues doivent rester
// strictement parallèles — toute clé ajoutée d'un côté doit exister de l'autre.
function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key)
  );
}

describe("catalogues i18n", () => {
  it("fr et en exposent exactement les mêmes clés", () => {
    const frKeys = flattenKeys(fr).sort();
    const enKeys = flattenKeys(en).sort();
    expect(frKeys).toEqual(enKeys);
  });

  it("aucune valeur vide", () => {
    const check = (value: unknown, path: string): void => {
      if (typeof value === "string") {
        expect(value.trim(), `clé vide : ${path}`).not.toHaveLength(0);
        return;
      }
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        check(child, `${path}.${key}`);
      }
    };
    check(fr, "fr");
    check(en, "en");
  });
});
