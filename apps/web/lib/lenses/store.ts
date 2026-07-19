"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { LensId } from "./types";

// Store du regard par défaut choisi au profil (même patron que lib/challenges/store.ts).
// `discipline === null` = vue classique. Persisté en localStorage (zéro backend en V1).

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

interface LensState {
  discipline: LensId | null;
  setDiscipline: (id: LensId | null) => void;
}

export const useLensStore = create<LensState>()(
  persist(
    (set) => ({
      discipline: null,
      setDiscipline: (id) => set({ discipline: id })
    }),
    {
      name: "ibis:lens",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : noopStorage
      ),
      partialize: (state) => ({ discipline: state.discipline })
    }
  )
);
