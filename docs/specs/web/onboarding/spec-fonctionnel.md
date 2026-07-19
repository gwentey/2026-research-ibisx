# Spec Fonctionnelle — web/onboarding [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | web/onboarding      |
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

| ADR | Titre | Catégorie | Statut |
|-----|-------|-----------|--------|
| [RETRO-002](../../../adr/RETRO-002.md) | Règle de dérivation familiarity → xai\_audience dupliquée frontend + backend | DATA-MODEL | Documenté (rétro) |

---

## Contexte et objectif

L'onboarding est la première surface que rencontre un utilisateur après l'inscription. Il collecte trois informations de calibration (niveau d'études, âge, familiarité avec l'IA) pour personnaliser le niveau de détail des explications XAI proposées dans l'application.

L'objectif principal est de déterminer le niveau d'audience XAI par défaut (`novice / intermediate / expert`) qui gouverne la profondeur textuelle des explications LLM, la visibilité adaptative des blocs de résultats, et le ton du copilote d'explication.

---

## Règles métier (déduites du code)

1. **Passage unique obligatoire** : l'onboarding ne peut être complété qu'une seule fois via `POST /api/v1/users/me/onboarding`. Toute tentative de replay retourne HTTP 409. La modification ultérieure des préférences passe par `PATCH /api/v1/users/me`.

2. **Contrainte d'âge** : l'âge saisi doit être un entier compris entre 13 et 120 inclus. Le bouton « Suivant » reste désactivé tant que la contrainte n'est pas satisfaite.

3. **Derivation XaiAudience** : la familiarité IA (1–5) est convertie en niveau d'audience selon la règle (CDC §4.1) :
   - 1–2 → `novice`
   - 3 → `intermediate`
   - 4–5 → `expert`
   Cette règle est implémentée côté backend dans `derive_xai_audience()` ET côté frontend dans `audienceFor()` (pour l'aperçu en temps réel). Les deux implémentations doivent rester synchronisées.

4. **Re-dérivation automatique** : si `ai_familiarity` est modifié via `PATCH /users/me` sans qu'un `xai_audience` explicite soit fourni, le backend re-dérive automatiquement l'audience. Si `xai_audience` est fourni explicitement, aucune re-dérivation n'a lieu.

5. **Guard de navigation** :
   - Un utilisateur non authentifié est redirigé vers `/login`.
   - Un utilisateur authentifié ayant déjà complété l'onboarding est redirigé vers `/dashboard`.
   - L'accès aux pages applicatives (`AppGuard`) est bloqué tant que `onboarding_completed = false`.

6. **Progression linéaire** : le wizard compte exactement 3 étapes, non navigables directement (le bouton « Retour » revient d'une étape, pas de saut).

7. **Données de confidentialité** : l'âge est présenté à l'utilisateur comme servant uniquement à adapter le ton des explications et n'est jamais partagé (message explicite `ageReassurance`).

---

## Cas d'usage (déduits)

### CU-001 — Première connexion après inscription

**Acteur** : utilisateur nouvellement inscrit (onboarding_completed = false)

1. L'utilisateur se connecte via login ou OAuth Google.
2. La fonction `postLoginDestination()` détecte `onboarding_completed = false` et redirige vers `/onboarding`.
3. `OnboardingGuard` vérifie la session et la condition ; affiche le wizard.
4. Étape 1 : l'utilisateur choisit son niveau d'études parmi 5 options (cards radio).
5. Étape 2 : l'utilisateur saisit son âge via le stepper +/− ou la saisie directe.
6. Étape 3 : l'utilisateur sélectionne son niveau de familiarité IA (1–5) ; un aperçu du style d'explication futur s'affiche en temps réel.
7. L'utilisateur clique « Commencer avec IBIS-X ».
8. Le frontend appelle `POST /api/v1/users/me/onboarding` avec `{education_level, age, ai_familiarity}`.
9. Le backend dérive `xai_audience`, pose `onboarding_completed_at = now()`, retourne le `UserRead` mis à jour.
10. Le store Zustand est mis à jour avec `setUser(data)`, déclenchant la redirection vers `/dashboard`.

### CU-002 — Accès direct à `/onboarding` par un utilisateur déjà calibré

**Acteur** : utilisateur avec onboarding_completed = true

1. L'utilisateur tente d'accéder à `/onboarding` (lien direct, navigateur).
2. `OnboardingGuard` détecte `user.onboarding_completed = true` et redirige immédiatement vers `/dashboard`.
3. Le wizard n'est jamais affiché.

### CU-003 — Aperçu en temps réel du niveau d'explication (étape 3)

**Acteur** : utilisateur en cours de calibration

1. L'utilisateur sélectionne un niveau de familiarité.
2. `audienceFor(familiarity)` calcule immédiatement le niveau côté client.
3. Un panneau d'aperçu apparaît décrivant le style d'explication futur (ex. : « Vos explications seront simples, avec des analogies du quotidien. » pour novice).

---

## Dépendances

- `lib/auth/store.ts` (Zustand) — lecture du statut de session et mise à jour utilisateur post-onboarding
- `lib/auth/session.ts` — `postLoginDestination()` et `bootstrapSession()`
- `lib/api/generated/` — client OpenAPI généré (`completeOnboarding`, type `EducationLevel`)
- `components/ibis/auth-guard.tsx` — `OnboardingGuard`, `AppGuard`, `GuestGuard`
- `apps/api/ibis/modules/users/` — endpoint `POST /users/me/onboarding` et service
- `apps/api/ibis/modules/auth/models.py` — `derive_xai_audience()`, `XaiAudience`, `User.xai_audience`

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Raison du choix de 5 niveaux de familiarité** (et non 3 ou 7) — les libellés sont dans le fichier i18n mais aucun commentaire n'explique l'origine de la granularité.
- **Usage futur de `education_level` et `age`** — ces champs sont collectés et stockés mais aucun module consommateur n'a été identifié au-delà de l'onboarding lui-même. Leur rôle dans la personnalisation (ton, vocabulaire) est mentionné dans l'i18n mais non implémenté dans le code visible.
- **Modifiabilité de `education_level` et `age` après onboarding** — le service `update_user` (`PATCH /users/me`) reçoit un `UserUpdate` schema qui inclut ces champs, mais aucun test ni doc ne confirme explicitement ce cas d'usage.
