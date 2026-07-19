import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { PRIVACY_SECTIONS, TERMS_SECTIONS } from "../../lib/legal/documents";

// Les pages légales alimentent l'écran de consentement OAuth Google : une clé manquante
// afficherait le chemin brut de la traduction à un utilisateur (et à un relecteur Google).
// Ce test garantit que chaque section déclarée existe, traduite, dans les deux catalogues.
const CATALOGS = { fr, en } as const;

type Section = { title?: unknown; body?: unknown; items?: unknown };

function sectionsOf(catalog: unknown, doc: "privacy" | "terms"): Record<string, Section> {
  const legal = (catalog as { legal?: Record<string, { sections?: unknown }> }).legal;
  return (legal?.[doc]?.sections ?? {}) as Record<string, Section>;
}

describe("documents légaux", () => {
  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    for (const [doc, plan] of [
      ["privacy", PRIVACY_SECTIONS],
      ["terms", TERMS_SECTIONS]
    ] as const) {
      it(`${locale} — ${doc} : chaque section déclarée a un titre et un corps`, () => {
        const sections = sectionsOf(catalog, doc);
        for (const { id } of plan) {
          expect(typeof sections[id]?.title, `${locale}.legal.${doc}.sections.${id}.title`).toBe(
            "string"
          );
          expect(typeof sections[id]?.body, `${locale}.legal.${doc}.sections.${id}.body`).toBe(
            "string"
          );
        }
      });

      it(`${locale} — ${doc} : aucune section orpheline dans le catalogue`, () => {
        const declared = plan.map((section) => section.id).sort();
        expect(Object.keys(sectionsOf(catalog, doc)).sort()).toEqual(declared);
      });
    }
  }

  it("les listes ont la même longueur en FR et en EN", () => {
    for (const doc of ["privacy", "terms"] as const) {
      const frSections = sectionsOf(fr, doc);
      const enSections = sectionsOf(en, doc);
      for (const id of Object.keys(frSections)) {
        const frItems = frSections[id].items;
        if (!Array.isArray(frItems)) continue;
        expect(enSections[id].items, `legal.${doc}.sections.${id}.items`).toHaveLength(
          frItems.length
        );
      }
    }
  });
});
