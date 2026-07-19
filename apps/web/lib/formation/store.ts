"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Repli sûr là où localStorage n'existe pas (SSR / tests node) — même patron que
// lib/challenges/store.ts, pour que `persist` ne touche jamais un `undefined`.
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

// Store UNIQUE de progression de l'académie. Persiste en localStorage :
//  - `lessonsDone`  : slugs des leçons terminées (→ grade & pourcentages, via progress.ts) ;
//  - `notionsOwned` : le « deck » de cartes-notions gagnées.
// La complétion des DÉFIS reste, elle, dans le store de quête (`ibis:challenges`) : source
// unique de vérité (P3) — l'académie la LIT pour ses examens-diplômes, ne la recopie pas.

interface AcademyState {
  lessonsDone: string[];
  notionsOwned: string[];
  completeLesson: (lessonSlug: string, notions?: string[]) => void;
  isLessonDone: (slug: string) => boolean;
  reset: () => void;
}

export const useAcademyStore = create<AcademyState>()(
  persist(
    (set, get) => ({
      lessonsDone: [],
      notionsOwned: [],

      completeLesson: (lessonSlug, notions = []) => {
        const { lessonsDone, notionsOwned } = get();
        const nextLessons = lessonsDone.includes(lessonSlug)
          ? lessonsDone
          : [...lessonsDone, lessonSlug];
        const nextNotions = [...new Set([...notionsOwned, ...notions])];
        set({ lessonsDone: nextLessons, notionsOwned: nextNotions });
      },

      isLessonDone: (slug) => get().lessonsDone.includes(slug),

      reset: () => set({ lessonsDone: [], notionsOwned: [] })
    }),
    {
      name: "ibis:formation",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : noopStorage
      ),
      partialize: (state) => ({
        lessonsDone: state.lessonsDone,
        notionsOwned: state.notionsOwned
      })
    }
  )
);
