import { describe, it, expect } from "vitest";

import fr from "../../messages/fr.json";
import en from "../../messages/en.json";
import { CURSUS } from "@/lib/formation/catalog";

// Garde-fou : le catalogue et l'i18n doivent rester alignés. La parité fr/en ne suffit PAS —
// une clé absente des DEUX côtés passerait inaperçue alors qu'elle plante le rendu. Ici, on
// vérifie que CHAQUE clé i18n dont un composant a besoin existe, en FR ET en EN.

function get(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((n, p) => (n as Record<string, unknown>)?.[p], obj);
}

/** Clés i18n requises par le catalogue (miroir de ce que consomment les composants). */
function requiredKeys(): string[] {
  const keys = new Set<string>();
  for (const cursus of CURSUS) {
    for (const suffix of ["title", "tagline", "subtitle"]) {
      keys.add(`formation.cursus.${cursus.slug}.${suffix}`);
    }
    for (const mod of cursus.modules) {
      keys.add(`formation.modules.${mod.slug}.title`);
      keys.add(`formation.modules.${mod.slug}.tagline`);
      for (const lesson of mod.lessons) {
        keys.add(`formation.lessons.${lesson.slug}.title`);
        keys.add(`formation.lessons.${lesson.slug}.summary`);
        for (const block of lesson.blocks) {
          const base = `formation.lessons.${lesson.slug}.${block.id}`;
          if (block.type === "myth") {
            keys.add(`${base}.myth`);
            keys.add(`${base}.reality`);
          } else if (block.type === "visual") {
            keys.add(`${base}.title`);
            keys.add(`${base}.body`);
            keys.add(`${base}.caption`);
          } else if (block.type === "quiz") {
            keys.add(`${base}.question`);
            keys.add(`${base}.explanation`);
            keys.add(`${base}.options`); // tableau, vérifié à part
          } else if (block.type === "practice") {
            keys.add(`${base}.title`);
            keys.add(`${base}.body`);
          } else if (block.type === "case_study") {
            keys.add(`${base}.title`);
            keys.add(`${base}.context`);
            keys.add(`${base}.problem`);
            keys.add(`${base}.takeaway`);
          } else if (block.type === "notion") {
            for (const s of ["term", "definition", "example"]) {
              keys.add(`formation.notions.${block.notion}.${s}`);
            }
          }
          // playground : pas de texte propre à la leçon (labels dans formation.playgrounds.*)
        }
      }
    }
  }
  return [...keys];
}

describe("couverture i18n du catalogue formation", () => {
  it.each([
    ["fr", fr],
    ["en", en]
  ])("chaque clé requise par le catalogue existe et n'est pas vide (%s)", (_lang, messages) => {
    const missing: string[] = [];
    for (const key of requiredKeys()) {
      const value = get(messages, key);
      const ok =
        key.endsWith(".options")
          ? Array.isArray(value) && value.length >= 2 && value.every((v) => typeof v === "string")
          : typeof value === "string" && value.trim().length > 0;
      if (!ok) missing.push(key);
    }
    expect(missing, `clés manquantes/vides : ${missing.join(", ")}`).toEqual([]);
  });

  it("chaque quiz a autant d'options que déclaré dans le catalogue", () => {
    for (const cursus of CURSUS) {
      for (const mod of cursus.modules) {
        for (const lesson of mod.lessons) {
          for (const block of lesson.blocks) {
            if (block.type === "quiz") {
              const opts = get(fr, `formation.lessons.${lesson.slug}.${block.id}.options`);
              expect(Array.isArray(opts) && (opts as unknown[]).length, lesson.slug).toBe(
                block.choices
              );
            }
          }
        }
      }
    }
  });
});
