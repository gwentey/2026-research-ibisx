"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { getChallenge } from "./catalog";
import { isChallengeComplete } from "./progress";
import type { ObjectiveId } from "./types";

// Repli sûr là où localStorage n'existe pas (SSR / tests node) : un stockage no-op, pour que
// `persist` ne tente jamais un `setItem` sur `undefined`.
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

// Store UNIQUE de quête (même patron que lib/wizard/store.ts). Persiste la progression en
// localStorage : `completed` (slugs de défis terminés) survit entre les sessions, `activeSlug`
// + `done` portent le défi en cours à travers les navigations (y compris vers le wizard).

interface QuestState {
  activeSlug: string | null;
  done: ObjectiveId[];
  completed: string[];
  start: (slug: string) => void;
  markObjective: (id: ObjectiveId) => void;
  quit: () => void;
  isCompleted: (slug: string) => boolean;
}

export const useQuestStore = create<QuestState>()(
  persist(
    (set, get) => ({
      activeSlug: null,
      done: [],
      completed: [],

      start: (slug) => set({ activeSlug: slug, done: [] }),

      markObjective: (id) => {
        const { activeSlug, done, completed } = get();
        if (done.includes(id)) return;
        const nextDone = [...done, id];
        let nextCompleted = completed;
        const challenge = activeSlug ? getChallenge(activeSlug) : undefined;
        if (
          challenge &&
          isChallengeComplete(challenge.objectives, nextDone) &&
          !completed.includes(challenge.slug)
        ) {
          nextCompleted = [...completed, challenge.slug];
        }
        set({ done: nextDone, completed: nextCompleted });
      },

      quit: () => set({ activeSlug: null, done: [] }),

      isCompleted: (slug) => get().completed.includes(slug)
    }),
    {
      name: "ibis:challenges",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : noopStorage
      ),
      // Ne persister que ce qui doit survivre ; les actions sont recréées à chaque montage.
      partialize: (state) => ({
        activeSlug: state.activeSlug,
        done: state.done,
        completed: state.completed
      })
    }
  )
);
