# Spec Fonctionnelle — api/users [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | api/users           |
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

| ADR | Titre | Statut |
|-----|-------|--------|
| [null](../../../adr/RETRO-002.md) |  | Documenté (rétro) |
| [null](../../../adr/RETRO-002.md) |  | Documenté (rétro) |

---

## Contexte et objectif

Le module `api/users` expose la gestion du profil de l'utilisateur connecté. Il couvre toutes les opérations post-authentification sur le compte propre de l'utilisateur : lecture du profil, mise à jour, onboarding initial, changement de mot de passe, upload et récupération d'avatar, et suppression définitive du compte. Il ne gère pas la création de compte ni l'authentification (délégués à `api/auth`).

Le module est central pour la personnalisation de l'expérience XAI : les champs `ai_familiarity` et `xai_audience` qu'il maintient pilotent la profondeur des explications, la visibilité des blocs de résultats et le ton du copilote dans l'ensemble de l'application.

---

## Règles métier (déduites du code)

1. **Onboarding unique** : l'onboarding (`POST /users/me/onboarding`) ne peut être complété qu'une seule fois. Une deuxième tentative renvoie une erreur 409 `ONBOARDING_DONE`. Les champs onboarding (`education_level`, `age`, `ai_familiarity`, `xai_audience`) peuvent ensuite être modifiés via `PATCH /users/me`.

2. **Dérivation de xai_audience à l'écriture** : lors de l'onboarding, `xai_audience` est toujours calculée depuis `ai_familiarity` via la règle CDC §4.1 (1–2 → novice, 3 → intermediate, 4–5 → expert). Lors d'une mise à jour de profil, si `ai_familiarity` est fourni sans `xai_audience` explicite dans le payload, la valeur est redérivée automatiquement ; si `xai_audience` est fourni explicitement dans le même PATCH, le choix explicite prend la priorité sur la redérivation.

3. **Age minimum pour l'onboarding** : l'âge fourni à l'onboarding ou dans le profil doit être compris entre 13 et 120 ans inclus.

4. **Niveaux d'études valides** : `education_level` est un enum fermé (`lycee`, `licence`, `master`, `doctorat`, `autre`). Toute valeur hors liste renvoie 422.

5. **Locale limitée** : la locale ne peut être que `fr` ou `en`. Toute autre valeur renvoie 422.

6. **Changement de mot de passe** : un utilisateur ayant déjà un mot de passe doit fournir le mot de passe actuel correct ; un utilisateur "Google uniquement" (sans mot de passe) peut définir un premier mot de passe sans fournir de valeur courante. Après tout changement réussi, toutes les sessions existantes (refresh tokens) sont révoquées.

7. **Validation d'avatar par parsing effectif** : l'avatar est validé en l'ouvrant effectivement avec PIL (pas uniquement par MIME ou extension). Un fichier qui n'est pas une image valide renvoie 422 `AVATAR_INVALID`. La taille maximale est 2 Mo ; au-delà, 422 `AVATAR_TOO_LARGE`. L'image est normalisée en 256×256 pixels WebP à 85 % de qualité avant stockage.

8. **Suppression de compte par confirmation email** : la suppression requiert que l'utilisateur saisisse son adresse email (normalisée en minuscules) correspondant exactement à celle de son compte. Une non-correspondance renvoie 422 `EMAIL_MISMATCH`. La suppression est une cascade BDD (projets, expériences) ; l'avatar en stockage objet est supprimé avant la suppression de la ligne. Le cookie refresh est nettoyé dans la réponse.

9. **Profil en lecture** : `GET /users/me` renvoie toujours le profil de l'utilisateur courant sans paramètre. Les champs `has_password` et `has_avatar` sont calculés (properties Python, pas de colonnes dédiées).

---

## Cas d'usage (déduits)

### CU-001 — Consultation du profil
Un utilisateur authentifié appelle `GET /users/me`. L'API renvoie son profil complet incluant les champs de personnalisation XAI, le statut d'onboarding, les crédits et les flags de capacités (`has_password`, `has_avatar`).

### CU-002 — Onboarding initial
Lors de la première connexion, le client appelle `POST /users/me/onboarding` avec `education_level`, `age`, et `ai_familiarity`. Le champ `xai_audience` est calculé automatiquement. Le flag `onboarding_completed` passe à `true`.

### CU-003 — Mise à jour du profil
Un utilisateur souhaite modifier son pseudo, sa locale ou sa familiarité IA. Il appelle `PATCH /users/me` avec uniquement les champs à modifier (PATCH partiel). Si `ai_familiarity` est modifié sans `xai_audience` explicite, l'audience est recalculée. Si l'utilisateur souhaite garder son audience actuelle malgré un changement de familiarité, il envoie les deux champs dans le même PATCH.

### CU-004 — Changement de mot de passe
Un utilisateur avec mot de passe appelle `PATCH /users/me/password` en fournissant son mot de passe actuel et le nouveau. Si le mot de passe actuel est incorrect, 403. En cas de succès, toutes ses autres sessions sont invalidées.

### CU-005 — Upload d'avatar
L'utilisateur envoie un fichier image (`PUT /users/me/avatar`). L'API valide (parsing PIL), redimensionne en 256×256 et stocke en WebP. `GET /users/me/avatar` sert ensuite le flux WebP via le stockage.

### CU-006 — Suppression de compte
L'utilisateur confirme la suppression en saisissant son email via `POST /users/me/delete`. En cas de correspondance, son compte et toutes ses données sont supprimés, le cookie refresh est effacé. Les requêtes ultérieures avec l'ancien access token renvoient 401.

---

## Dépendances

- `api/auth` : dépend de `CurrentUser` (injection du user courant depuis le token JWT), de `revoke_all_user_tokens` (révocation de sessions sur changement de mot de passe), de `normalize_email` (normalisation de l'email de confirmation), et de `_clear_refresh_cookie` (nettoyage du cookie à la suppression).
- `ibis.storage` : interface de stockage pour la lecture, l'écriture et la suppression des avatars (backend `local` ou `s3` selon l'env).
- `ibis.core.security` : `hash_password` / `verify_password` pour le changement de mot de passe.
- `ibis.modules.auth.models` : modèle `User`, enum `XaiAudience`, `EducationLevel`, `UserRole`, fonction `derive_xai_audience`.
- `ibis.modules.auth.schemas` : schémas Pydantic partagés (`UserRead`, `OnboardingRequest`, `ProfileUpdateRequest`, `PasswordChangeRequest`, `AccountDeleteRequest`).

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :
- **Quota de crédits** : la colonne `credits` (défaut 100) est présente et exposée dans `UserRead`, mais aucune logique de débit ou de recharge n'est visible dans ce module. Les règles de consommation des crédits par les features IA ne sont pas documentées ici.
- **Politique de suppression différée** : la suppression de compte est immédiate (`db.delete(user)`) ; aucun mécanisme de grâce (soft-delete, délai de rétractation) n'est implémenté dans le code. S'il existe une règle RGPD de délai, elle n'est pas visible.
- **Accès à l'avatar d'autres utilisateurs** : seul `GET /users/me/avatar` est exposé ; aucun endpoint pour servir l'avatar d'un tiers n'est visible dans ce module. La mécanique d'affichage des avatars dans les interfaces listant d'autres utilisateurs (ex. admin) n'est pas clarifiée.
- **Signification métier de `ai_familiarity`** : les valeurs 1–5 correspondent à un auto-positionnement déclaratif. Aucune description des niveaux (ex. « 1 = jamais entendu parler de l'IA ») n'est dans le code — ces labels vivent probablement côté client.
