import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

// `legal.consent` est le seul message riche du projet : ses balises <terms> et <privacy>
// sont résolues à l'exécution par la page d'inscription. Une balise renommée d'un côté
// sans l'autre ferait planter /register — le chemin d'inscription entier. D'où ce test.
const CATALOGS = { fr, en } as const;

describe("mention de consentement", () => {
  for (const [locale, messages] of Object.entries(CATALOGS)) {
    it(`${locale} — les deux liens légaux sont résolus`, () => {
      const t = createTranslator({ locale, messages, namespace: "legal" });

      const markup = renderToStaticMarkup(
        createElement(
          "p",
          null,
          t.rich("consent", {
            terms: (chunks) => createElement("a", { href: "/legal/terms" }, chunks),
            privacy: (chunks) => createElement("a", { href: "/legal/privacy" }, chunks)
          })
        )
      );

      expect(markup).toContain('href="/legal/terms"');
      expect(markup).toContain('href="/legal/privacy"');
      // Aucune balise ne doit fuiter en texte brut si une fonction manquait.
      expect(markup).not.toContain("<terms>");
      expect(markup).not.toContain("<privacy>");
    });
  }
});
