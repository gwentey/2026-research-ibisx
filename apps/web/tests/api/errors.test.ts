import { describe, expect, it } from "vitest";

import { apiErrorCode, apiErrorMessage } from "@/lib/api/errors";

const FALLBACK = "Repli";

describe("apiErrorMessage", () => {
  it("affiche le message métier de l'API tel quel", () => {
    // Le backend rédige ces messages pour l'utilisateur final : les remplacer par un texte
    // générique ferait perdre l'explication précise du refus.
    const error = {
      detail: {
        code: "KAGGLE_URL_NOT_A_DATASET",
        message: "Ce lien pointe vers « code », pas vers un dataset."
      }
    };

    expect(apiErrorMessage(error, FALLBACK)).toBe(
      "Ce lien pointe vers « code », pas vers un dataset."
    );
  });

  it("ne rend JAMAIS « [object Object] »", () => {
    // Régression : un `String(detail)` naïf sur l'enveloppe { code, message } produisait
    // « [object Object] » à l'écran, masquant l'explication du backend.
    const shapes: unknown[] = [
      { detail: { code: "X", message: "ok" } },
      { detail: { code: "X" } },
      { detail: {} },
      { detail: [] },
      { detail: [{ msg: "field required", loc: ["body", "url"] }] },
      { detail: null },
      { detail: 42 },
      {},
      null,
      undefined,
      "boom"
    ];

    for (const shape of shapes) {
      expect(apiErrorMessage(shape, FALLBACK)).not.toContain("[object");
    }
  });

  it("retombe sur le repli quand le message est vide ou absent", () => {
    expect(apiErrorMessage({ detail: { code: "X" } }, FALLBACK)).toBe(FALLBACK);
    expect(apiErrorMessage({ detail: { code: "X", message: "   " } }, FALLBACK)).toBe(FALLBACK);
    expect(apiErrorMessage({}, FALLBACK)).toBe(FALLBACK);
    expect(apiErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
  });

  it("annote le repli avec l'erreur Pydantic sans l'imposer seule", () => {
    // FastAPI renvoie AUSSI du 422 pour ses erreurs de schéma, mais sous forme de tableau,
    // avec des messages techniques inutilisables tels quels pour un utilisateur final.
    const error = { detail: [{ msg: "field required", loc: ["body", "url"] }] };

    expect(apiErrorMessage(error, FALLBACK)).toBe("Repli (field required)");
  });

  it("accepte un detail déjà textuel", () => {
    expect(apiErrorMessage({ detail: "Trop de tentatives" }, FALLBACK)).toBe(
      "Trop de tentatives"
    );
  });
});

describe("apiErrorCode", () => {
  it("extrait le code métier", () => {
    expect(apiErrorCode({ detail: { code: "NOT_OWNER" } })).toBe("NOT_OWNER");
  });

  it("distingue une erreur de validation Pydantic", () => {
    expect(apiErrorCode({ detail: [{ msg: "field required" }] })).toBe("VALIDATION_ERROR");
  });

  it("retombe sur UNKNOWN_ERROR pour toute forme inattendue", () => {
    expect(apiErrorCode({ detail: {} })).toBe("UNKNOWN_ERROR");
    expect(apiErrorCode({})).toBe("UNKNOWN_ERROR");
    expect(apiErrorCode(null)).toBe("UNKNOWN_ERROR");
  });
});
