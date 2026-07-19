# RETRO-web-auth-01 — Single-flight obligatoire sur les opérations de session (refresh + bootstrap)

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
| Q1 — Coût de revert > 1j ? | OUI — La contrainte de single-flight est une conséquence directe du mécanisme de rotation des refresh tokens côté backend (ADR-003) : chaque appel à `/auth/refresh` invalide le token précédent et en émet un nouveau. Si deux appels concurrents arrivent, le backend révoque toute la famille (détection de vol). Supprimer `refreshInFlight` et `bootstrapPromise` impliquerait de refondre la gestion de la concurrence dans tous les Guards + intercepteurs, et de vérifier qu'aucun composant ne déclenche des refreshs parallèles — bien au-delà d'une journée. |
| Q2 — Non-déductible du code ? | OUI — Le lien entre le singleton frontend et la révocation de famille backend n'est pas visible dans `package.json` ni dans les configs. Il faut lire le commentaire de `session.ts` ("La rotation des refresh tokens interdit deux refresh concurrents (la famille serait révoquée)") ET connaître le comportement de `ADR-003` pour comprendre pourquoi ce pattern est obligatoire et non facultatif. |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — `bootstrapSession()` est appelé par tous les Guards (`AppGuard`, `GuestGuard`, `OnboardingGuard`), qui encadrent toutes les features web : web/dashboard, web/datasets, web/experiments, web/wizard, web/xai, web/formation, web/challenges, web/admin, web/onboarding. `refreshInFlight` s'applique à toutes les requêtes API de toute feature. |
| Q4 — Casse un invariant si ignoré ? | OUI — Un dev qui ajoute un deuxième appel à `refreshToken()` dans un nouveau composant (ex. : un hook personnalisé qui "assure" la fraîcheur du token) déclencherait deux appels concurrents à `/auth/refresh`. Le backend détecte la réutilisation du refresh token révoqué et révoque toute la famille, déconnectant l'utilisateur de toutes ses sessions actives. |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

ADR-003 spécifie que les refresh tokens sont **opaques, à usage unique, avec rotation à chaque usage** : chaque appel à `/auth/refresh` invalide le token consommé et retourne un nouveau. La détection de vol repose sur ce mécanisme : si un token déjà révoqué est présenté, toute la famille est immédiatement révoquée.

En pratique, plusieurs situations déclenchent simultanément un refresh côté frontend :
- Le chargement d'une page montre plusieurs Guards (`AppGuard` du layout + celui d'une page enfant) qui appellent tous `bootstrapSession()` au montage.
- Une requête API sur un token proche de l'expiration (< 60 s) peut arriver en même temps qu'une autre requête déclenchant le même refresh préventif.

## Décision identifiée

`apps/web/lib/auth/session.ts` maintient deux singletons de promesse :

```typescript
let refreshInFlight: Promise<string | null> | null = null;
let bootstrapPromise: Promise<void> | null = null;
```

**`refreshSession()`** : si un refresh est déjà en cours, retourne la promesse existante au lieu d'en créer une nouvelle. La promesse est libérée (mise à `null`) dans le `.finally()`.

**`bootstrapSession()`** : même logique pour la restauration initiale de session. Plusieurs Guards peuvent appeler `bootstrapSession()` dans le même rendu — un seul appel réseau est émis.

L'intercepteur `ensureFreshToken()` évalue l'expiration avant de décider d'un refresh, ce qui réduit les déclenchements inutiles. Mais même si deux chemins atteignent simultanément le refresh, le singleton garantit qu'un seul appel réseau est émis.

## Conséquences observées

### Positives
- La révocation de famille par double-refresh concurrent est rendue impossible côté frontend, quel que soit le nombre de Guards montés simultanément.
- Le nombre d'appels réseau à `/auth/refresh` est minimisé : N Guards montés simultanément = 1 seul appel.

### Négatives / Dette
- `bootstrapPromise` n'est jamais réinitialisé après déconnexion. Si l'utilisateur se déconnecte et revient sur une page invité dans la même session navigateur sans rechargement complet, `bootstrapSession()` ne retentira pas. Ce cas est probablement couvert par `clearSession()` qui passe le statut en `guest` (les Guards réagissent au changement de store), mais la logique n'est pas explicite.
- La contrainte de single-flight est invisible à tout dev qui travaille sur un nouveau composant nécessitant un token frais. Elle doit être documentée explicitement (cette fiche ADR) pour éviter les régressions.

## Recommandation

Garder. Ce pattern est la conséquence inévitable de ADR-003 côté frontend. Documenter la contrainte dans l'onboarding des nouveaux contributeurs : tout nouveau composant qui doit accéder à l'access token doit passer par `lib/auth/session.ts` (via les intercepteurs ou `ensureFreshToken()`), jamais appeler `refreshToken()` directement.
