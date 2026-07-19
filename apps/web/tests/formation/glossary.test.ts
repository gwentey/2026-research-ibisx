import { describe, it, expect } from "vitest";

import { glossaryEntries, notionLesson } from "@/lib/formation/glossary";
import { findLesson } from "@/lib/formation/catalog";

describe("glossaire vivant", () => {
  it("expose une entrée par carte-notion du catalogue, sans doublon", () => {
    const entries = glossaryEntries();
    const ids = entries.map((e) => e.notionId);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("chaque entrée pointe vers une leçon VIVANTE (cursus + leçon existants)", () => {
    for (const entry of glossaryEntries()) {
      const found = findLesson(entry.lessonSlug);
      expect(found, `leçon manquante pour ${entry.notionId}`).toBeDefined();
      expect(found!.cursus.slug).toBe(entry.cursusSlug);
    }
  });

  it("notionLesson résout un terme connu, undefined sinon", () => {
    expect(notionLesson("ia-predictive")?.lessonSlug).toBe("lia-predictive");
    expect(notionLesson("terme-inexistant")).toBeUndefined();
  });

  it("les entrées sont triées par terme (ordre alphabétique des ids stable)", () => {
    const ids = glossaryEntries().map((e) => e.notionId);
    expect([...ids]).toEqual([...ids].sort());
  });
});
