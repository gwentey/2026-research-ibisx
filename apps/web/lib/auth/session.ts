"use client";

import {
  googleAuthorize,
  googleExchange,
  login as apiLogin,
  logout as apiLogout,
  refreshToken,
  register as apiRegister
} from "@/lib/api/generated";
import type { TokenResponse, UserRead } from "@/lib/api/generated";
import { client } from "@/lib/api/generated/client.gen";
import { useAuthStore } from "@/lib/auth/store";

// ---------------------------------------------------------------------------
// Session côté navigateur : refresh préventif single-flight + intercepteurs.
// La rotation des refresh tokens interdit deux refresh concurrents (la famille
// serait révoquée) : tout passe par UNE promesse partagée.
// ---------------------------------------------------------------------------

const AUTH_PATH_PREFIX = "/api/v1/auth/";
const REFRESH_MARGIN_MS = 60_000;

let refreshInFlight: Promise<string | null> | null = null;
let interceptorsInstalled = false;

export class ApiAuthError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

function extractErrorCode(error: unknown): string {
  const detail = (error as { detail?: { code?: string } | unknown[] } | undefined)?.detail;
  if (Array.isArray(detail)) return "VALIDATION_ERROR"; // erreurs de schéma Pydantic (422)
  return (detail as { code?: string } | undefined)?.code ?? "UNKNOWN_ERROR";
}

function applyTokenResponse(body: TokenResponse): UserRead {
  useAuthStore.getState().setSession(body.access_token, body.expires_in, body.user);
  return body.user;
}

async function doRefresh(): Promise<string | null> {
  const { data } = await refreshToken({ throwOnError: false });
  if (!data) {
    useAuthStore.getState().clearSession();
    return null;
  }
  applyTokenResponse(data);
  return data.access_token;
}

export function refreshSession(): Promise<string | null> {
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function ensureFreshToken(): Promise<string | null> {
  const { accessToken, expiresAt, status } = useAuthStore.getState();
  if (accessToken && expiresAt && expiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return accessToken;
  }
  if (status === "guest") return null;
  return refreshSession();
}

export function installAuthInterceptors(): void {
  if (interceptorsInstalled) return;
  interceptorsInstalled = true;

  client.interceptors.request.use(async (request) => {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith(AUTH_PATH_PREFIX)) return request;
    const token = await ensureFreshToken();
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  });

  client.interceptors.response.use((response) => {
    const { pathname } = new URL(response.url);
    if (response.status === 401 && !pathname.startsWith(AUTH_PATH_PREFIX)) {
      // Session morte (famille révoquée, compte désactivé…) → état invité
      useAuthStore.getState().clearSession();
    }
    return response;
  });
}

// --------------------------------- Bootstrap --------------------------------

let bootstrapPromise: Promise<void> | null = null;

/** Au chargement de l'app : tente de restaurer la session via le cookie refresh. */
export function bootstrapSession(): Promise<void> {
  bootstrapPromise ??= (async () => {
    installAuthInterceptors();
    if (useAuthStore.getState().status === "authenticated") return;
    await refreshSession();
  })();
  return bootstrapPromise;
}

// ---------------------------------- Actions ---------------------------------

export async function loginAction(email: string, password: string): Promise<UserRead> {
  const { data, error } = await apiLogin({ body: { email, password }, throwOnError: false });
  if (!data) throw new ApiAuthError(extractErrorCode(error));
  return applyTokenResponse(data);
}

export async function registerAction(email: string, password: string): Promise<UserRead> {
  const { data, error } = await apiRegister({ body: { email, password }, throwOnError: false });
  if (!data) throw new ApiAuthError(extractErrorCode(error));
  return applyTokenResponse(data);
}

export async function logoutAction(): Promise<void> {
  await apiLogout({ throwOnError: false });
  useAuthStore.getState().clearSession();
}

export async function startGoogleLogin(): Promise<void> {
  const { data, error } = await googleAuthorize({ throwOnError: false });
  if (!data) throw new ApiAuthError(extractErrorCode(error));
  window.location.assign(data.authorization_url);
}

export async function finishGoogleLogin(code: string, state: string): Promise<UserRead> {
  const { data, error } = await googleExchange({
    body: { code, state },
    throwOnError: false
  });
  if (!data) throw new ApiAuthError(extractErrorCode(error));
  return applyTokenResponse(data);
}

/** Cible post-connexion : onboarding obligatoire tant que non complété (CDC §4.1). */
export function postLoginDestination(user: UserRead): string {
  return user.onboarding_completed ? "/dashboard" : "/onboarding";
}
