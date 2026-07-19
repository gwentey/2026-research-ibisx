# RETRO-017 — Guards d'accès purement client-side (redirections UX, pas une couche de sécurité)

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documenté (rétro)   |
| Date       | 2026-07-19          |
| Source     | Rétro-ingénierie    |
| Features   | web/auth            |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | AUTH |
| Q1 — Coût de revert > 1j ? | OUI — Basculer vers un middleware Next.js (`middleware.ts`) pour la protection des routes implique de résoudre l'incompatibilité entre le store Zustand (state navigateur, inaccessible en edge runtime) et la vérification de token en edge context, de créer un mécanisme de lecture du cookie refresh dans le middleware, de supprimer les Guards des layouts et de refactoriser tous les layouts (app), (guest), onboarding et admin. Ce chantier dépasse largement une journée. |
| Q2 — Non-déductible du code ? | OUI — `package.json` et `next.config.ts` ne contiennent pas de `middleware.ts`. Un dev qui arrive sur le projet peut supposer que la protection des routes est assurée par un middleware Next.js (pattern courant) alors qu'elle est 100 % côté React. La distinction « guard UX » vs « guard sécurité » et le fait que le backend réenforce systématiquement ses propres contrôles ne se déduisent pas de la lecture des configs. |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — AppGuard encadre le layout `(app)/` et donc la totalité des features web applicatives : web/dashboard, web/datasets, web/experiments, web/wizard, web/xai, web/formation, web/challenges, web/admin, web/onboarding. Tout nouveau développement sur ces features hérite implicitement de ce pattern. |
| Q4 — Casse un invariant si ignoré ? | OUI — Un dev qui comprend AppGuard comme un mécanisme de sécurité (et non une redirection UX) pourrait ajouter une nouvelle route admin sans dépendance FastAPI `require_role`, en comptant sur le guard client pour bloquer les non-admins. Or AppGuard ne protège pas contre un appel API direct avec un token admin valide — ni contre une navigation en mode hors-ligne ou avec un token artisanal. L'invariant de sécurité réel est le `require_role` backend. |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

L'architecture Next.js offre deux endroits pour protéger les routes : le middleware edge (`middleware.ts`, s'exécute avant le rendu, côté serveur) et des composants React côté client. Le middleware edge est la solution la plus robuste pour le rendu côté serveur, mais il est incompatible avec Zustand (state navigateur) et nécessite un mécanisme distinct pour lire et valider le token d'accès en edge runtime.

IBIS-X a choisi les composants React client (AppGuard, GuestGuard, OnboardingGuard) pour la protection des routes. Cette décision est cohérente avec une architecture où la sécurité réelle est assurée intégralement par le backend FastAPI.

## Décision identifiée

Trois composants `"use client"` encapsulent les layouts Next.js :

- **`AppGuard`** (layout `(app)/`) : exige `status === "authenticated"` et `user.onboarding_completed === true`. Les utilisateurs non connectés sont redirigés vers `/login`, les utilisateurs sans onboarding vers `/onboarding`. Affiche un skeleton loader pendant le bootstrap.
- **`GuestGuard`** (layout `(guest)/`) : si l'utilisateur est déjà authentifié, le redirige vers `postLoginDestination(user)`. Évite qu'un utilisateur connecté atterrisse sur `/login`.
- **`OnboardingGuard`** (page `/onboarding`) : exige une session active ET un onboarding non complété. Les utilisateurs non connectés vont à `/login`, ceux qui ont terminé l'onboarding vont à `/dashboard`.

Le layout `(app)/admin/layout.tsx` ajoute un quatrième guard local : `user.role !== "admin"` → redirection vers `/dashboard`. Lui aussi est explicitement documenté comme guard UX ("la sécurité réelle est backend — chaque route /admin revérifie en base").

Il n'existe pas de `middleware.ts` dans l'application.

## Conséquences observées

### Positives
- La protection des routes ne dépend pas d'une validation de token en edge runtime — simplicité d'implémentation, pas de duplication de la logique de vérification JWT.
- Le store Zustand (session, rôle utilisateur) est directement accessible dans les Guards sans pont ni cookie additionnel.
- Les redirections sont fluides côté client (pas de rechargement de page).

### Négatives / Dette
- Un utilisateur qui désactive JavaScript peut potentiellement afficher le HTML d'une page protégée côté serveur (avant hydratation, les Guards ne sont pas encore exécutés). Ce cas est acceptable car aucune donnée sensible n'est rendue côté serveur dans les layouts.
- Le modèle est invisible pour les nouveaux développeurs : rien dans `next.config.ts` ou à la racine n'indique que la protection des routes est gérée par des composants React plutôt que par un middleware.
- Le chargement initial affiche systématiquement un skeleton (FullPageLoader) le temps du bootstrap — même pour les utilisateurs déjà connectés avec un cookie refresh valide. La durée dépend du temps réseau.

## Recommandation

Garder. Le choix est cohérent avec l'architecture générale : le backend est l'autorité de sécurité, le frontend est UX. Documenter la convention dans l'onboarding : tout nouvel endpoint API ajouté sous un périmètre protégé (ex. : `/admin/*`) DOIT comporter la dépendance FastAPI `require_role` côté backend, indépendamment de l'existence d'un guard client.
