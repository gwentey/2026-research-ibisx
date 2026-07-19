import { describe, expect, it } from "vitest";

import {
  getBlocks,
  normalizeTone,
  parseInline,
  TONE_SURFACE,
  TONE_TEXT,
  type Block
} from "@/lib/xai/blocks";

describe("normalizeTone", () => {
  it("garde les tonalités connues", () => {
    expect(normalizeTone("positive")).toBe("positive");
    expect(normalizeTone("accent")).toBe("accent");
  });
  it("retombe sur neutral pour l'inconnu", () => {
    expect(normalizeTone("rainbow")).toBe("neutral");
    expect(normalizeTone(undefined)).toBe("neutral");
    expect(normalizeTone(42)).toBe("neutral");
  });
  it("chaque tonalité a une classe texte et surface (tokens du kit)", () => {
    for (const tone of ["neutral", "accent", "positive", "negative", "warning"] as const) {
      expect(TONE_TEXT).toHaveProperty(tone);
      expect(TONE_SURFACE[tone]).toBeTruthy();
      // Jamais de couleur hex en dur — que des utilitaires/tokens.
      expect(TONE_SURFACE[tone]).not.toMatch(/#[0-9a-f]{3,6}/i);
    }
  });
});

describe("parseInline", () => {
  it("texte simple → un seul jeton texte", () => {
    expect(parseInline("bonjour")).toEqual([{ kind: "text", value: "bonjour" }]);
  });
  it("gras, italique, code, surlignage", () => {
    expect(parseInline("a **b** c")).toEqual([
      { kind: "text", value: "a " },
      { kind: "bold", value: "b" },
      { kind: "text", value: " c" }
    ]);
    expect(parseInline("x ==clé== y")).toEqual([
      { kind: "text", value: "x " },
      { kind: "highlight", value: "clé" },
      { kind: "text", value: " y" }
    ]);
    expect(parseInline("`code`")).toEqual([{ kind: "code", value: "code" }]);
    expect(parseInline("_ital_")).toEqual([{ kind: "italic", value: "ital" }]);
  });
  it("** est prioritaire sur *", () => {
    expect(parseInline("**fort**")).toEqual([{ kind: "bold", value: "fort" }]);
  });
  it("plusieurs marques dans une phrase", () => {
    const tokens = parseInline("La variable ==revenu== pèse **0.41**.");
    expect(tokens.map((t) => t.kind)).toEqual(["text", "highlight", "text", "bold", "text"]);
  });
  it("n'introduit jamais de HTML", () => {
    const tokens = parseInline("<script>alert(1)</script> **ok**");
    // Le texte reste littéral (rendu comme texte par React), aucune balise interprétée.
    expect(tokens[0]).toEqual({ kind: "text", value: "<script>alert(1)</script> " });
  });
});

describe("getBlocks", () => {
  const doc = {
    schema_version: 1,
    blocks: [
      { type: "paragraph", text: "salut" },
      { type: "table", columns: ["a"], rows: [[{ text: "1" }]] }
    ] satisfies Block[]
  };

  it("extrait la liste depuis le document", () => {
    expect(getBlocks(doc)).toHaveLength(2);
  });
  it("tolère null / mal formé", () => {
    expect(getBlocks(null)).toEqual([]);
    expect(getBlocks({})).toEqual([]);
    expect(getBlocks({ blocks: "nope" })).toEqual([]);
  });
  it("filtre les entrées sans type", () => {
    expect(getBlocks({ blocks: [{ text: "x" }, { type: "paragraph", text: "y" }] })).toHaveLength(
      1
    );
  });
});
