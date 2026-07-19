# Spec Technique — web/auth

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | web/auth            |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie    |

## Architecture du module

Le module `web/auth` est organisé autour de deux couches bien séparées :

**Couche état** (`lib/auth/store.ts`) : store Zustand non persisté qui détient le statut de session (`loading / authenticated / guest`), le profil utilisateur, l'access token en mémoire, et son epoch d'expiration.

**Couche session** (`lib/auth/session.ts`) : module "use client" qui orchestre toutes les opérations asynchrones — bootstrap au démarrage, refresh préventif, actions utilisateur (login/register/logout/Google), intercepteurs HTTP. Il est le seul consommateur direct du client OpenAPI généré pour les opérations d'auth.

**Couche garde** (`components/ibis/auth-guard.tsx`) : trois composants React (AppGuard, GuestGuard, OnboardingGuard) qui encapsulent les layouts Next.js concernés. Ils appellent `bootstrapSession()` au montage et réagissent aux changements de `useAuthStore` via des `useEffect`. Ils n'effectuent aucune vérification de sécurité — ce sont des redirections UX.

**Couche présentation** : quatre pages sous `(guest)/` + le callback Google sous `app/auth/`. Chaque page compose son formulaire avec `react-hook-form` + `zod` et délègue toutes les actions à `lib/auth/session.ts`.

```
app/(guest)/
  layout.tsx          → <GuestGuard>
  login/page.tsx      → loginAction()
  register/page.tsx   → registerAction()
  forgot-password/page.tsx → forgotPassword() (client généré direct)
  reset-password/page.tsx  → resetPassword() (client généré direct)

app/auth/google/callback/page.tsx → finishGoogleLogin()

lib/auth/
  store.ts    → Zustand state (status, user, accessToken, expiresAt)
  session.ts  → actions + interceptors + bootstrap + single-flight

components/ibis/
  auth-guard.tsx       → AppGuard / GuestGuard / OnboardingGuard
  google-button.tsx    → startGoogleLogin()
  guest-shell.tsx      → layout coquille (panneau marque + formulaire)
  auth-brand-panel.tsx → panneau de marque responsive (desktop plein / mobile compact)
```

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/web/app/(guest)/login/page.tsx` | Page de connexion email/mot de passe | ~150 |
| `apps/web/app/(guest)/register/page.tsx` | Page d'inscription | ~153 |
| `apps/web/app/(guest)/forgot-password/page.tsx` | Page mot de passe oublié | ~84 |
| `apps/web/app/(guest)/reset-password/page.tsx` | Page de réinitialisation + Suspense | ~127 |
| `apps/web/app/(guest)/layout.tsx` | Layout groupe guest → GuestGuard | ~11 |
| `apps/web/app/auth/google/callback/page.tsx` | Callback OIDC Google + Suspense | ~69 |
| `apps/web/lib/auth/store.ts` | Store Zustand d'état de session | ~36 |
| `apps/web/lib/auth/session.ts` | Logique session, intercepteurs, actions, bootstrap | ~144 |
| `apps/web/components/ibis/auth-guard.tsx` | AppGuard / GuestGuard / OnboardingGuard | ~79 |
| `apps/web/components/ibis/google-button.tsx` | Bouton Google OAuth | ~54 |
| `apps/web/components/ibis/guest-shell.tsx` | Coquille layout pages invité | ~17 |
| `apps/web/components/ibis/auth-brand-panel.tsx` | Panneau de marque responsive | ~176 |

## API / Endpoints utilisés

| Méthode | Route | Fonction générée | Auth |
|---------|-------|-----------------|------|
| `POST` | `/api/v1/auth/login` | `login()` | Non |
| `POST` | `/api/v1/auth/register` | `register()` | Non |
| `POST` | `/api/v1/auth/refresh` | `refreshToken()` | Cookie httpOnly |
| `POST` | `/api/v1/auth/logout` | `logout()` | Cookie httpOnly |
| `GET` | `/api/v1/auth/google/authorize` | `googleAuthorize()` | Non |
| `POST` | `/api/v1/auth/google/exchange` | `googleExchange()` | Non |
| `POST` | `/api/v1/auth/forgot-password` | `forgotPassword()` | Non |
| `POST` | `/api/v1/auth/reset-password` | `resetPassword()` | Non |

Toutes ces fonctions proviennent du client TypeScript généré dans `apps/web/lib/api/generated/` via `@hey-api/openapi-ts` (ADR-007).

## Patterns identifiés

### Single-flight sur refresh et bootstrap (RETRO-016)

`session.ts` maintient deux singletons de promesse :

```typescript
let refreshInFlight: Promise<string | null> | null = null;
let bootstrapPromise: Promise<void> | null = null;
```

`refreshSession()` : si un refresh est déjà en cours, retourne la promesse existante. Cela est rendu obligatoire par le mécanisme de rotation des refresh tokens côté backend (ADR-003) : deux appels concurrents à `/auth/refresh` déclencheraient la révocation de la famille.

`bootstrapSession()` : même logique. Plusieurs Guards peuvent appeler `bootstrapSession()` simultanément lors du chargement de la première page — un seul appel réseau est émis.

### Intercepteurs HTTP sur le client généré

Deux intercepteurs sont installés une seule fois (`interceptorsInstalled` flag) :
- **Request interceptor** : injecte `Authorization: Bearer <token>` avant chaque requête non-auth. Déclenche un refresh préventif si l'access token expire dans moins de `REFRESH_MARGIN_MS` (60 000 ms).
- **Response interceptor** : si une réponse 401 est reçue sur un endpoint non-auth, appelle `clearSession()` pour passer l'utilisateur en état `guest`.

Les routes `/api/v1/auth/*` sont exemptées des deux intercepteurs pour éviter les boucles infinies.

### Extraction structurée des codes d'erreur

```typescript
function extractErrorCode(error: unknown): string {
  const detail = (error as { detail?: { code?: string } | unknown[] })?.detail;
  if (Array.isArray(detail)) return "VALIDATION_ERROR"; // erreurs 422 Pydantic
  return (detail as { code?: string })?.code ?? "UNKNOWN_ERROR";
}
```

Les pages affichent les codes via `tErrors.has(code) ? tErrors(code) : tErrors("UNKNOWN_ERROR")` pour éviter les clés manquantes.

### Guards React (UX-only, RETRO-017)

Trois composants wrappent les layouts Next.js :
- `AppGuard` : exige `status === "authenticated"` et `user.onboarding_completed`. Sinon : loader skeleton.
- `GuestGuard` : si authentifié → redirection. Sinon : contenu invité.
- `OnboardingGuard` : exige `status === "authenticated"` et `!user.onboarding_completed`.

Ces guards n'apportent aucune garantie de sécurité — ils sont uniquement des redirections UX. La sécurité réelle est enforced par le backend (dépendances FastAPI `CurrentUser`, `require_role`).

### Guard admin supplémentaire côté client

Le layout `(app)/admin/layout.tsx` vérifie en plus `user.role !== "admin"` et redirige vers `/dashboard`. Ce guard est documenté explicitement comme UX uniquement.

### Anti-double invocation React StrictMode sur le callback Google

```typescript
const startedRef = useRef(false);
useEffect(() => {
  if (startedRef.current) return;
  startedRef.current = true;
  // échange du code OAuth
}, []);
```

React StrictMode double-invoke les effets en développement. Le code OIDC étant à usage unique (invalide après le premier échange), le ref empêche un second appel.

### Validation des formulaires

Tous les formulaires utilisent `react-hook-form` avec `zodResolver`. Les schémas Zod sont locaux à chaque page :
- Login : `email` (`.email()`), `password` (`.min(1)`)
- Register/Reset : `password` (`.min(8)`)
- Forgot : `email` (`.email()`)

Les champs password ont un toggle show/hide avec `aria-label` i18n.

### postLoginDestination

```typescript
export function postLoginDestination(user: UserRead): string {
  return user.onboarding_completed ? "/dashboard" : "/onboarding";
}
```

Fonction pure consommée par tous les flux de connexion réussie (login, register, Google callback) et par GuestGuard.

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|----------------|--------|
| `apps/web/e2e/mission.spec.ts` | Parcours complet : inscription → onboarding → wizard → résultats (inclut login implicite) | Existant |
| — | Tests unitaires dédiés au module web/auth | Absent |

Aucun test unitaire Vitest ne cible directement `lib/auth/store.ts`, `lib/auth/session.ts` ou les composants Guards. La couverture de l'auth frontend repose sur les specs e2e Playwright (parcours mission).
