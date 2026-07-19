# Spec Technique — web/onboarding

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | web/onboarding      |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie    |

---

## Architecture du module

Le module est composé d'une page Next.js App Router (`page.tsx`) qui encapsule un wizard client-side à 3 étapes. La navigation entre étapes est gérée par un état React local (`useState`). Il n'y a pas de store Zustand dédié : l'état du wizard est éphémère et disparaît à la navigation.

```
OnboardingPage (server shell)
  └── OnboardingGuard (auth gate : redirect guest → /login, completed → /dashboard)
        └── OnboardingWizard (client component — état local)
              ├── CalibrationPattern (SVG décoratif, arcs concentriques)
              ├── OnboardingPath    (indicateur de progression horizontal — 3 pastilles)
              ├── Step 1 : RadioGroup + ChoiceCard × 5 (education_level)
              ├── Step 2 : AgeStepper (input number + boutons +/-)
              └── Step 3 : RadioGroup + ChoiceCard × 5 (ai_familiarity) + aperçu audience
```

Le composant `OnboardingPage` est un Server Component minimal dont le seul rôle est d'envelopper `OnboardingWizard` dans `OnboardingGuard`. L'ensemble de la logique est en `"use client"`.

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/web/app/onboarding/page.tsx` | Page principale — wizard 3 étapes, logique de soumission, mappings icônes/tons | ~273 |
| `apps/web/components/ibis/onboarding/age-stepper.tsx` | Stepper +/− pour la saisie de l'âge avec input `type="number"` | ~69 |
| `apps/web/components/ibis/onboarding/calibration-pattern.tsx` | SVG décoratif (5 arcs concentriques) — réservé à l'onboarding | ~40 |
| `apps/web/components/ibis/onboarding/choice-card.tsx` | Carte-choix radio (icône + libellé + description optionnelle) en orientations grid/row | ~77 |
| `apps/web/components/ibis/onboarding/onboarding-path.tsx` | Indicateur de progression horizontal (done/current/upcoming) | ~77 |
| `apps/web/components/ibis/auth-guard.tsx` | `OnboardingGuard` — gate de session et redirection si onboarding déjà complété | ~79 |
| `apps/web/lib/auth/session.ts` | `postLoginDestination()` — détermine /onboarding vs /dashboard post-login | — |
| `apps/web/messages/fr.json` | Clés i18n du namespace `onboarding` (FR) | — |
| `apps/web/messages/en.json` | Clés i18n du namespace `onboarding` (EN) | — |
| `apps/api/ibis/modules/users/routes.py` | `POST /api/v1/users/me/onboarding` | — |
| `apps/api/ibis/modules/users/service.py` | `complete_onboarding()` — validation unicité, derivation xai_audience, horodatage | — |
| `apps/api/ibis/modules/auth/schemas.py` | `OnboardingRequest` (education_level, age ∈ [13,120], ai_familiarity ∈ [1,5]) | — |
| `apps/api/ibis/modules/auth/models.py` | `derive_xai_audience()`, `User.xai_audience`, propriété `onboarding_completed` | — |
| `apps/api/tests/integration/test_users_me.py` | Tests intégration : flow onboarding, validation, re-dérivation audience | ~163 |

---

## Schéma BDD (champs pertinents sur `users`)

Les champs suivants de la table `users` sont écrits lors de l'onboarding :

| Colonne | Type | Contrainte |
|---------|------|------------|
| `education_level` | VARCHAR / Enum | `lycee \| licence \| master \| doctorat \| autre` |
| `age` | INTEGER | 13 ≤ age ≤ 120 |
| `ai_familiarity` | INTEGER | 1 ≤ ai_familiarity ≤ 5 |
| `xai_audience` | Enum | `novice \| intermediate \| expert` (dérivé) |
| `onboarding_completed_at` | TIMESTAMP WITH TIME ZONE | nullable ; pose le flag `onboarding_completed` |

La propriété `onboarding_completed` sur le modèle Python est une propriété calculée : `onboarding_completed_at is not None`.

---

## API / Endpoints

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `POST` | `/api/v1/users/me/onboarding` | Complète l'onboarding (une seule fois) ; retourne `UserRead` ; HTTP 409 si déjà complété | Bearer JWT requis |

**Payload `OnboardingRequest`** :
```json
{
  "education_level": "master",
  "age": 24,
  "ai_familiarity": 2
}
```

**Réponse** : `UserRead` complet avec `onboarding_completed: true` et `xai_audience: "novice"`.

---

## Patterns identifiés

- **Wizard client-side sans store** : l'état multi-étapes est géré par `useState` local dans `OnboardingWizard`. Il n'y a pas de persistance (pas de brouillon) — l'utilisateur recommence depuis l'étape 1 en cas de rechargement.
- **Gate de session (OnboardingGuard)** : pattern identique à `AppGuard` et `GuestGuard` dans `auth-guard.tsx`. Tous les guards appellent `bootstrapSession()` dans un `useEffect` et réagissent aux changements du store Zustand via un second `useEffect`.
- **Mise à jour du store post-soumission** : après l'appel API réussi, `setUser(data)` met à jour le store Zustand directement avec le `UserRead` retourné. Cela déclenche la redirection via le `useEffect` de `OnboardingGuard` sans rechargement de page.
- **Derivation frontend miroir** : la fonction `audienceFor()` dans `page.tsx` reproduit exactement la logique de `derive_xai_audience()` côté backend (CDC §4.1) pour afficher l'aperçu de niveau en temps réel à l'étape 3. Ces deux implémentations doivent rester synchronisées (cf. RETRO-002).
- **ChoiceCard — contrat e2e** : le titre (`title`) doit toujours être dans un nœud `<ItemTitle>` isolé (jamais concaténé à description ou eyebrow). Commentaire explicite dans le composant : requis pour que `getByText(title, { exact: true })` fonctionne dans les tests Playwright.
- **AgeStepper — contrat e2e** : reste l'unique `input[type="number"]` de la page. Commentaire explicite dans le composant.
- **Accessibilité** : `OnboardingPath` utilise `<ol aria-label={ariaLabel}>` ; toutes les icônes décoratives ont `aria-hidden="true"` ; l'input âge porte `aria-invalid` conditionnel.

---

## Configuration i18n (namespace `onboarding`)

Clés principales dans `apps/web/messages/fr.json` et `en.json` :

| Clé | Usage |
|-----|-------|
| `onboarding.title` | Titre de la page ("Faisons connaissance") |
| `onboarding.education.{level}` | Libellés des 5 niveaux d'études |
| `onboarding.familiarity.{1-5}` | Libellés des 5 niveaux de familiarité IA |
| `onboarding.audiencePreview.{novice\|intermediate\|expert}` | Texte d'aperçu du niveau d'explication futur |
| `onboarding.ageReassurance` | Message de confidentialité sur l'âge |
| `onboarding.submit` | Libellé du bouton de soumission finale |

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/api/tests/integration/test_users_me.py` | Flow onboarding complet (201→200, xai_audience=novice) ; validation payload (age<13, level invalide → 422) ; re-dérivation audience via PATCH ; replay onboarding → 409 | Existant |
| `apps/web/e2e/mission.spec.ts` | Parcours e2e complet inscription→onboarding→dashboard (éducation Master, familiarité 4) | Existant |
| `apps/web/e2e/challenge.spec.ts` | Parcours e2e challenge incluant l'onboarding (familiarité 2 → novice) | Existant |

Aucun test unitaire Vitest dédié à l'onboarding n'a été identifié.

---

## Décisions documentées en spec-technique (candidats ADR rejetés)

- **Unicité de l'onboarding (409 sur replay)** — rejeté pour ADR : Q1=NON (changer une condition en service.py < 1 journée). Documenté ici.
- **Contrainte âge [13, 120]** — rejeté : AP-7 (détail de schéma) + Q3=NON (mono-feature).
- **5 niveaux de familiarité avec gradient tonal chart-5→chart-1** — rejeté : aucune catégorie ADR applicable (convention visuelle locale).
- **Mise à jour du store Zustand post-soumission sans rechargement** — rejeté : AP-3 (heuristique d'implémentation locale).
