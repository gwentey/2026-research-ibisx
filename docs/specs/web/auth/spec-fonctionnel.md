# Spec Fonctionnelle — web/auth [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | web/auth            |
| Version    | 0.1.0               |
| Date       | 2026-07-19          |
| Auteur     | retro-documenter    |
| Statut     | DRAFT               |
| Source     | Rétro-ingénierie    |

> **[DRAFT — à valider par le dev]** Cette spec a été générée par rétro-ingénierie
> à partir du code existant. Elle doit être relue et validée par un développeur
> qui connaît le contexte métier.

---

## ADRs

| Identifiant | Titre | Catégorie | Statut |
|-------------|-------|-----------|--------|
| [ADR-003](../../../adr/ADR-003-auth-rbac.md) | Authentification & RBAC | AUTH | Accepté |
| [RETRO-api-auth-01](../../../adr/RETRO-api-auth-01.md) | Anti-énumération email | SECURITY | Documenté (rétro) |
| [RETRO-web-auth-01](../../../adr/RETRO-web-auth-01.md) | Single-flight obligatoire sur refresh et bootstrap | AUTH | Documenté (rétro) |
| [RETRO-web-auth-02](../../../adr/RETRO-web-auth-02.md) | Guards d'accès purement client-side (UX-only, pas de sécurité) | AUTH | Documenté (rétro) |

---

## Contexte et objectif

Le module `web/auth` regroupe l'ensemble des surfaces frontales liées à l'identité de l'utilisateur : création de compte, connexion email/mot de passe, connexion Google OIDC, récupération et réinitialisation de mot de passe, garde des routes applicatives. Il est la couche navigateur du système d'authentification documenté dans ADR-003 : il ne détient aucune logique de sécurité propre — toute vérification réelle est déléguée au backend.

## Règles métier (déduites du code)

1. **Mot de passe — longueur minimale** : 8 caractères à l'inscription et lors de la réinitialisation (validation Zod côté client, vérification indépendante côté backend).
2. **Destination post-connexion** : à l'issue d'une authentification réussie (email/mot de passe, inscription, Google OIDC), l'utilisateur est redirigé vers `/onboarding` si `onboarding_completed = false`, sinon vers `/dashboard`.
3. **Accès aux pages applicatives** : les pages sous `(app)/` exigent une session authentifiée ET un onboarding complété. Un utilisateur non connecté est renvoyé à `/login`. Un utilisateur connecté mais n'ayant pas complété l'onboarding est renvoyé à `/onboarding`.
4. **Rebond depuis les pages invité** : les pages sous `(guest)/` (login, register, forgot-password, reset-password) redirigent automatiquement un utilisateur déjà authentifié vers sa destination post-connexion.
5. **Onboarding exclusif** : la page `/onboarding` est réservée aux utilisateurs connectés qui n'ont pas encore complété l'onboarding ; un onboarding déjà terminé renvoie vers `/dashboard`.
6. **Anti-énumération côté UI** : la page « mot de passe oublié » affiche systématiquement le message « lien envoyé » après soumission, sans égard pour le code de retour de l'API. Ce comportement est le complément frontend de RETRO-api-auth-01.
7. **Désactivation du formulaire de reset sans token** : le bouton de soumission de la page de réinitialisation est désactivé si le paramètre `token` est absent de l'URL.
8. **Protection anti-double invocation Google callback** : le callback OIDC Google utilise un `useRef` booléen pour ne lancer l'échange de code qu'une seule fois, même en mode Strict React (double-invoke des effets en développement).
9. **Access token en mémoire uniquement** : l'access token JWT n'est jamais persisté en localStorage ni en sessionStorage. La persistance de session repose sur le cookie `httpOnly` de refresh géré par le backend (ADR-003).

## Cas d'usage (déduits)

### CU-001 — Connexion email/mot de passe
L'utilisateur saisit son email et son mot de passe sur `/login`. La validation Zod s'effectue avant soumission (email valide, mot de passe non vide). En cas de succès API, le store Zustand est alimenté (access token, expiration, profil) et l'utilisateur est redirigé. En cas d'erreur, un code structuré (`ApiAuthError.code`) est affiché via le catalogue i18n `errors.*`.

### CU-002 — Inscription
L'utilisateur saisit son email et son mot de passe sur `/register`. Le mot de passe doit contenir au moins 8 caractères. En cas de succès, le comportement est identique à une connexion réussie (session ouverte, redirection post-connexion).

### CU-003 — Connexion Google OIDC
L'utilisateur clique sur « Continuer avec Google » (disponible sur login et register). Le frontend appelle `GET /auth/google/authorize`, reçoit une `authorization_url` et redirige le navigateur. Après authentification Google, le callback `/auth/google/callback` échange le code OIDC, ouvre la session et redirige.

### CU-004 — Mot de passe oublié
L'utilisateur saisit son email sur `/forgot-password`. Le frontend appelle l'API et affiche toujours « lien envoyé » — jamais d'erreur visible, quelle que soit la réponse de l'API.

### CU-005 — Réinitialisation du mot de passe
L'utilisateur arrive sur `/reset-password?token=<token>`. Il saisit un nouveau mot de passe (≥ 8 caractères). En cas de succès, un message de confirmation est affiché. En cas d'erreur API, le code `INVALID_RESET` est affiché. Si le paramètre `token` est absent de l'URL, le bouton reste désactivé.

### CU-006 — Restauration de session au chargement
Dès qu'un composant Guard est monté (chargement de n'importe quelle page), `bootstrapSession()` est appelé. Cette fonction tente de restaurer la session à partir du cookie refresh httpOnly en appelant `POST /auth/refresh`. Plusieurs appels simultanés (ex. : Guard de layout + Guard de page) partagent la même promesse (`bootstrapPromise` singleton).

### CU-007 — Refresh préventif des tokens
Avant chaque requête API (via l'intercepteur du client généré), si l'access token expire dans moins de 60 secondes, un refresh est déclenché. Si un refresh est déjà en cours, la promesse en vol est réutilisée (`refreshInFlight` singleton) — jamais deux appels simultanés à `/auth/refresh`.

### CU-008 — Déconnexion par révocation backend
Si une réponse 401 est reçue sur un endpoint non-auth, le store est vidé (`clearSession()`), passant l'utilisateur en état `guest`. Les Guards détectent ce changement et redirigent vers `/login`.

## Dépendances

- `apps/web/lib/api/generated` — Client OpenAPI TypeScript généré depuis l'API FastAPI (fonctions : `login`, `register`, `logout`, `refreshToken`, `googleAuthorize`, `googleExchange`, `forgotPassword`, `resetPassword`)
- `apps/web/components/ibis/guest-shell.tsx` + `auth-brand-panel.tsx` — Coquille visuelle des pages invité
- `next-intl` — Internationalisation des libellés (clés `auth.*` et `errors.*`)
- `react-hook-form` + `zod` — Gestion et validation des formulaires
- Zustand — Store d'état de session (`useAuthStore`)

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Comportement si le cookie refresh est expiré au chargement** : le code appelle `refreshSession()` qui retourne `null` sans erreur visible. Il n'est pas clair si un message d'information est affiché à l'utilisateur dans ce cas ou s'il est simplement redirigé vers `/login` silencieusement.
- **Durée d'affichage du loader pendant le bootstrap** : le `FullPageLoader` (skeleton) est affiché jusqu'à ce que le statut passe de `loading` à `authenticated` ou `guest`. La durée dépend du temps réseau de l'API `/auth/refresh`. Pas de timeout visible dans le code.
- **Gestion des erreurs réseau sur le callback Google** : si `finishGoogleLogin` lève une erreur non-`ApiAuthError` (erreur réseau), le code `UNKNOWN_ERROR` est affiché. Il n'est pas clair si ce cas est testé.
- **Compatibilité entre `bootstrapPromise` et les navigations côté client** : le singleton `bootstrapPromise` n'est jamais réinitialisé. Si l'utilisateur se déconnecte et revient sur une page invité dans la même session navigateur, le bootstrap n'est pas relancé. Ce comportement est-il intentionnel ?
