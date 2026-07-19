import { describe, it, expect } from "vitest";

import { referencedChallenges, lessonPractice } from "@/lib/formation/bridge";
import type { Cursus, Lesson } from "@/lib/formation/types";

const withPractice: Lesson = {
  slug: "l-pratique",
  blocks: [
    { type: "visual", id: "v" },
    { type: "practice", id: "p", challenge: "titanic-1912" }
  ]
};
const noPractice: Lesson = { slug: "l-simple", blocks: [{ type: "myth", id: "m" }] };

const cursus: Cursus = {
  slug: "fondations",
  level: "novice",
  grade: "apprenti",
  domain: "education",
  order: 1,
  modules: [
    { slug: "m1", lessons: [noPractice, withPractice] },
    { slug: "m2", lessons: [{ slug: "l3", blocks: [{ type: "practice", id: "p", challenge: "penguins-antarctique" }] }] }
  ]
};

describe("pont Formation → Défis", () => {
  it("lessonPractice renvoie le slug du Défi du premier bloc practice, sinon undefined", () => {
    expect(lessonPractice(withPractice)).toBe("titanic-1912");
    expect(lessonPractice(noPractice)).toBeUndefined();
  });

  it("referencedChallenges collecte tous les Défis cités, dédupliqués", () => {
    expect(referencedChallenges([cursus]).sort()).toEqual(
      ["penguins-antarctique", "titanic-1912"]
    );
  });

  it("referencedChallenges est vide sans bloc practice", () => {
    const c: Cursus = { ...cursus, modules: [{ slug: "m", lessons: [noPractice] }] };
    expect(referencedChallenges([c])).toEqual([]);
  });
});
