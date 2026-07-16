import { create } from "zustand";

import type { UserRead } from "@/lib/api/generated";

// Access token UNIQUEMENT en mémoire (jamais localStorage — ADR-003).
// La persistance de session est portée par le cookie refresh httpOnly côté API.

export type AuthStatus = "loading" | "authenticated" | "guest";

interface AuthState {
  status: AuthStatus;
  user: UserRead | null;
  accessToken: string | null;
  /** Epoch ms d'expiration de l'access token (pour le refresh préventif). */
  expiresAt: number | null;
  setSession: (token: string, expiresInSeconds: number, user: UserRead) => void;
  setUser: (user: UserRead) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "loading",
  user: null,
  accessToken: null,
  expiresAt: null,
  setSession: (token, expiresInSeconds, user) =>
    set({
      status: "authenticated",
      accessToken: token,
      expiresAt: Date.now() + expiresInSeconds * 1000,
      user
    }),
  setUser: (user) => set({ user }),
  clearSession: () =>
    set({ status: "guest", user: null, accessToken: null, expiresAt: null })
}));
