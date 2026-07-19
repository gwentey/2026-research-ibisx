# Spec Technique — api/users

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | api/users           |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie    |

---

## Architecture du module

Le module suit le pattern **Router → Service → ORM** standard de l'API. Il ne possède pas de modèle propre : l'entité centrale `User` est définie dans `ibis.modules.auth.models` et les schémas Pydantic dans `ibis.modules.auth.schemas` (partage explicite avec `api/auth`).

Le routeur (`routes.py`) délègue toute logique métier au service (`service.py`). Les dépendances sont injectées via `Depends` FastAPI : session SQLAlchemy (`DbDep`), utilisateur courant authentifié (`CurrentUser` depuis `api/auth`), et settings applicatifs (`SettingsDep`).

Deux dépendances externes au module sont appelées directement depuis `routes.py` plutôt que depuis `service.py` :
- `get_storage()` pour servir le flux avatar (lecture en streaming).
- `_clear_refresh_cookie` importé depuis `api/auth/routes.py` pour le nettoyage du cookie lors de la suppression de compte.

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/api/ibis/modules/users/routes.py` | Déclaration des 7 endpoints REST, injection de dépendances | ~78 |
| `apps/api/ibis/modules/users/service.py` | Logique métier : onboarding, mise à jour profil, changement de mot de passe, avatar, suppression | ~101 |
| `apps/api/ibis/modules/auth/schemas.py` | Schémas Pydantic partagés : `UserRead`, `OnboardingRequest`, `ProfileUpdateRequest`, `PasswordChangeRequest`, `AccountDeleteRequest` | ~106 |
| `apps/api/ibis/modules/auth/models.py` | Modèle `User`, enums `UserRole`/`XaiAudience`/`EducationLevel`, fonction `derive_xai_audience` | ~134 |
| `apps/api/ibis/storage/base.py` | Interface de stockage abstraite utilisée pour les avatars | ~31 |
| `apps/api/tests/integration/test_users_me.py` | Tests d'intégration couvrant les 7 opérations | ~163 |

---

## Schéma BDD

Toutes les colonnes utilisées par ce module appartiennent à la table `users` (définie dans `api/auth`) :

| Colonne | Type SQL | Rôle |
|---------|----------|------|
| `id` | UUID PK | Identifiant |
| `email` | VARCHAR(320) UNIQUE | Adresse email normalisée (minuscules) |
| `hashed_password` | VARCHAR(255) NULL | NULL = compte Google uniquement |
| `role` | ENUM(user_role) | `user` / `contributor` / `admin` |
| `is_active` | BOOLEAN | Activation du compte |
| `pseudo` | VARCHAR(64) NULL | Pseudo public |
| `avatar_path` | VARCHAR(255) NULL | Clé opaque dans le storage (ex. `avatars/{id}.webp`) |
| `given_name` | VARCHAR(120) NULL | Prénom |
| `family_name` | VARCHAR(120) NULL | Nom de famille |
| `locale` | VARCHAR(5) | Locale interface (`fr` ou `en`) |
| `education_level` | ENUM(education_level) NULL | Niveau d'études déclaré à l'onboarding |
| `age` | SMALLINT NULL | Âge déclaré (13–120) |
| `ai_familiarity` | SMALLINT NULL | Auto-évaluation familiarité IA (1–5) |
| `xai_audience` | ENUM(xai_audience) | Niveau d'audience XAI (`novice` / `intermediate` / `expert`), persisté à l'écriture |
| `onboarding_completed_at` | TIMESTAMP NULL | NULL = onboarding non fait ; non-NULL = flag `onboarding_completed` |
| `credits` | INTEGER | Crédits disponibles (défaut 100) |
| `created_at` | TIMESTAMP | Horodatage de création (via mixin `Timestamped`) |
| `updated_at` | TIMESTAMP | Horodatage de dernière modification |

La suppression d'un `User` déclenche une cascade `ON DELETE CASCADE` sur `refresh_tokens`, `password_reset_tokens`, `oauth_identities`, et les tables des features dépendantes (projets, expériences).

---

## API / Endpoints

| Méthode | Route | Operation ID | Description | Auth |
|---------|-------|--------------|-------------|------|
| GET | `/users/me` | `getMe` | Lecture du profil courant | JWT requis |
| PATCH | `/users/me` | `updateMe` | Mise à jour partielle du profil | JWT requis |
| POST | `/users/me/onboarding` | `completeOnboarding` | Onboarding initial (une seule fois) | JWT requis |
| PATCH | `/users/me/password` | `changePassword` | Changement de mot de passe (204) | JWT requis |
| PUT | `/users/me/avatar` | `uploadAvatar` | Upload et normalisation de l'avatar | JWT requis |
| GET | `/users/me/avatar` | `getMyAvatar` | Streaming de l'avatar en WebP | JWT requis |
| POST | `/users/me/delete` | `deleteAccount` | Suppression de compte (204) | JWT requis |

Tous les endpoints sont préfixés `/api/v1` par le routeur principal. Tous les schemas d'entrée utilisent `extra="forbid"` (héritage `StrictModel`) — tout champ inattendu renvoie 422.

---

## Patterns identifiés

- **Router → Service pattern** : les routes sont des thin wrappers ; toute logique métier est dans `service.py`.
- **PATCH partiel via `model_dump(exclude_unset=True)`** : seuls les champs fournis dans le payload sont appliqués à l'entité, évitant d'écraser des valeurs non fournies.
- **Streaming avatar** : `GET /users/me/avatar` renvoie un `StreamingResponse` alimenté par l'itérateur de chunks du storage (`storage.stream()`), sans charger l'image complète en mémoire.
- **Validation d'image par double-ouverture PIL** : `probe.verify()` valide le fichier, puis la source est rouverte (`Image.open` une seconde fois) car `verify()` invalide l'objet PIL — pattern requis par la librairie Pillow.
- **Clé storage déterministe pour avatars** : `avatars/{user.id}.webp` — un nouvel upload écrase silencieusement le précédent (pas de versioning).
- **Dépendance croisée `users` → `auth/routes`** : `_clear_refresh_cookie` est importé depuis `auth/routes.py`, créant un couplage direct entre les deux modules au niveau des routes (pas uniquement des services).

---

## Décisions techniques documentées ici (non-ADR)

### Confirmation email pour suppression de compte
La suppression requiert la saisie de l'email plutôt que du mot de passe. Ce choix permet la suppression même pour les comptes "Google uniquement" (sans mot de passe local). La confirmation est normalisée avant comparaison via `auth_service.normalize_email`. Impact mono-module → documenté ici, pas en ADR.

### Révocation de toutes les sessions au changement de mot de passe
`change_password` appelle `auth_service.revoke_all_user_tokens(db, user.id)` après le commit du nouveau hash. Ce comportement invalide toutes les sessions actives (protection contre les accès non autorisés si le mot de passe a été compromis). La décision de révocation de famille est documentée dans `ADR-003` (api/auth) ; l'appel depuis ce module est une conséquence de cette politique, pas une décision nouvelle.

### Normalisation avatar : WebP 256×256 @ 85 %
Constantes `AVATAR_MAX_BYTES = 2 * 1024 * 1024` et `AVATAR_SIZE = 256` définies en tête de `service.py`. Le format WebP est choisi pour sa compression supérieure au JPEG/PNG. La qualité 85 est un paramètre de trade-off taille/qualité. Ces valeurs sont arbitraires et modifiables sans impact transverse.

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/api/tests/integration/test_users_me.py` | Auth requise sur `/me`, flux onboarding (succès + 409 + validation), mise à jour profil avec redérivation audience, changement de mot de passe (mauvais actuel → 403, succès + login avec nouveau), upload avatar (succès + format WebP + taille ≤256, rejet fichier non-image), suppression compte (email erroné → 422, succès + token invalidé) | Existant |
| Tests unitaires `service.py` | Aucun test unitaire dédié identifié (couverture assurée par les tests d'intégration) | Absent |
