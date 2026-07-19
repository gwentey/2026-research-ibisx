# Spec Technique — api/auth

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | api/auth            |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie    |

## Architecture du module

Le module `auth` est organisé en 5 couches :

```
ibis/modules/auth/
├── models.py     — entités SQLAlchemy (User, RefreshToken, PasswordResetToken, OAuthIdentity)
├── schemas.py    — schémas Pydantic (request/response, extra="forbid" sur les écritures)
├── service.py    — logique métier pure (CRUD sessions, rotate/revoke, reset)
├── routes.py     — endpoints FastAPI (rate limited, cookie management)
├── google.py     — OIDC Google (PKCE, validation id_token, upsert identité)
ibis/core/
├── security.py   — primitives bas niveau (Argon2id, JWT HS256, opaque tokens)
├── ratelimit.py  — rate limiting Redis (INCR+EXPIRE, fail-open)
├── deps.py       — (relatif) — les dépendances RBAC sont dans modules/auth/deps.py
```

Les dépendances FastAPI (`CurrentClaims`, `CurrentUser`, `require_role`, `CurrentAdminVerified`, `require_owner_or_admin`) sont définies dans `modules/auth/deps.py` et importées par tous les autres modules qui nécessitent une protection.

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/api/ibis/modules/auth/models.py` | Modèles SQLAlchemy : `User`, `RefreshToken`, `PasswordResetToken`, `OAuthIdentity`, `UserRole`, `XaiAudience`, `EducationLevel`, `derive_xai_audience()` | ~134 |
| `apps/api/ibis/modules/auth/schemas.py` | Schémas Pydantic pour les endpoints auth ET le module users (`OnboardingRequest`, `ProfileUpdateRequest`, etc.) | ~90 |
| `apps/api/ibis/modules/auth/service.py` | Logique : création compte, authenticate, refresh rotation, revoke, reset password | ~198 |
| `apps/api/ibis/modules/auth/routes.py` | Endpoints `/auth/*` — cookie management, rate limiting, Google OIDC dispatch | ~197 |
| `apps/api/ibis/modules/auth/google.py` | Flux OIDC Google : build_authorization_url, exchange_code, _validate_id_token, upsert_google_user | ~162 |
| `apps/api/ibis/modules/auth/deps.py` | Dépendances RBAC FastAPI : `CurrentClaims`, `CurrentUser`, `require_role`, `CurrentAdminVerified`, `require_owner_or_admin` | ~88 |
| `apps/api/ibis/core/security.py` | Primitives : `hash_password`, `verify_password`, `create_access_token`, `decode_access_token`, `generate_opaque_token`, `hash_opaque_token` | ~70 |
| `apps/api/ibis/core/ratelimit.py` | Rate limiting Redis par IP (INCR+EXPIRE, fail-open) | ~36 |
| `apps/api/tests/integration/test_auth.py` | Tests intégration : register, login, rotation, vol détecté, logout, reset, rate limit | ~138 |

## Schéma BDD

### Table `users`

| Colonne | Type | Contraintes | Notes |
|---------|------|-------------|-------|
| `id` | UUID | PK | via `UUIDPk` mixin |
| `email` | String(320) | UNIQUE, INDEX | normalisé lowercase |
| `hashed_password` | String(255) | NULLABLE | NULL = compte Google uniquement |
| `role` | Enum(user_role) | DEFAULT 'user', INDEX | user / contributor / admin |
| `is_active` | Boolean | DEFAULT true | |
| `pseudo` | String(64) | NULLABLE | |
| `avatar_path` | String(255) | NULLABLE | |
| `given_name` | String(120) | NULLABLE | |
| `family_name` | String(120) | NULLABLE | |
| `locale` | String(5) | DEFAULT 'fr' | fr / en |
| `education_level` | Enum(education_level) | NULLABLE | lycee/licence/master/doctorat/autre |
| `age` | SmallInteger | NULLABLE | |
| `ai_familiarity` | SmallInteger | NULLABLE | 1-5 |
| `xai_audience` | Enum(xai_audience) | DEFAULT 'novice' | novice/intermediate/expert |
| `onboarding_completed_at` | DateTime | NULLABLE | |
| `credits` | Integer | DEFAULT 100 | |
| `created_at`, `updated_at` | DateTime | via `Timestamped` | |

### Table `refresh_tokens`

| Colonne | Type | Contraintes | Notes |
|---------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users(id) CASCADE DELETE, INDEX | |
| `token_hash` | String(64) | UNIQUE | SHA-256 du token opaque |
| `family_id` | UUID | INDEX | groupe de rotation (détection de vol) |
| `expires_at` | DateTime | | |
| `revoked_at` | DateTime | NULLABLE | NULL = token actif |
| `user_agent` | String(256) | NULLABLE | |
| `created_at` | DateTime | server_default now() | |

### Table `password_reset_tokens`

| Colonne | Type | Contraintes | Notes |
|---------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users(id) CASCADE DELETE, INDEX | |
| `token_hash` | String(64) | UNIQUE | SHA-256 du token opaque |
| `expires_at` | DateTime | | TTL 1h (RESET_TOKEN_TTL_HOURS) |
| `used_at` | DateTime | NULLABLE | NULL = token non consommé |
| `created_at` | DateTime | server_default now() | |

### Table `oauth_identities`

| Colonne | Type | Contraintes | Notes |
|---------|------|-------------|-------|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → users(id) CASCADE DELETE, INDEX | |
| `provider` | String(20) | | 'google' actuellement |
| `subject` | String(255) | | claim `sub` de l'id_token Google |
| `email` | String(320) | | email Google au moment de la liaison |
| `created_at` | DateTime | server_default now() | |
| — | — | UNIQUE(provider, subject) | empêche double liaison |

## API / Endpoints

| Méthode | Route | Description | Auth | Rate limit |
|---------|-------|-------------|------|------------|
| POST | `/auth/register` | Inscription email+mdp, auto-login | Non | 10/min/IP |
| POST | `/auth/login` | Connexion email+mdp | Non | 10/min/IP |
| POST | `/auth/refresh` | Rotation refresh token (cookie) | Cookie | Non |
| POST | `/auth/logout` | Révocation session | Cookie | Non |
| POST | `/auth/forgot-password` | Génération lien reset (204 toujours) | Non | 10/min/IP |
| POST | `/auth/reset-password` | Consommation lien, nouveau mdp | Non | 10/min/IP |
| GET | `/auth/google/authorize` | URL Google + state | Non | 10/min/IP |
| POST | `/auth/google/exchange` | Échange code → JWT IBIS | Non | 10/min/IP |

## Patterns identifiés

- **Repository inline** : pas de classe Repository séparée ; les requêtes SQLAlchemy sont directement dans `service.py` via des fonctions pures.
- **Service layer** : `service.py` contient toute la logique métier, sans dépendance directe à FastAPI (testable unitairement).
- **Dependency injection FastAPI** : `CurrentClaims`, `CurrentUser`, `CurrentAdminVerified` sont des `Annotated[T, Depends(...)]` réutilisables déclarés dans `deps.py`.
- **Token opaque haché** : les refresh tokens et reset tokens ne sont jamais stockés en clair — seul le SHA-256 est en base. Le token brut est transmis côté client uniquement.
- **PKCE S256 pour OAuth** : le `code_verifier` et le `nonce` sont stockés côtés serveur dans Redis (TTL 10 min) pour résister au replay et au CSRF.
- **Fail-open sur Redis** : le rate limiter laisse passer si Redis est indisponible — la décision est explicitement documentée dans le commentaire du module.

## Configuration

Variables d'environnement consommées :

| Variable | Usage |
|----------|-------|
| `JWT_SECRET` | Clé HS256 (≥ 256 bits recommandé) |
| `ACCESS_TOKEN_MINUTES` | Durée de vie access token (défaut lu dans Settings) |
| `REFRESH_TOKEN_DAYS` | Durée de vie refresh token |
| `DEFAULT_CREDITS` | Crédits attribués à l'inscription |
| `GOOGLE_CLIENT_ID` | Client ID Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Secret Google Cloud Console |
| `OAUTH_REDIRECT_URL` | URL de callback OAuth (côté front) |

## Décisions techniques documentées (non ADR)

- **Schémas partagés** : `schemas.py` contient à la fois les schémas auth (`RegisterRequest`, `LoginRequest`, etc.) et les schémas du module users (`OnboardingRequest`, `ProfileUpdateRequest`, `PasswordChangeRequest`, `AccountDeleteRequest`). Cette co-localisation reflète le fait que le modèle `User` appartient à `auth`, les users partageant le même namespace.
- **Cookie path limité à `/api/v1/auth`** : le refresh cookie porte `path=/api/v1/auth`, ce qui signifie que le navigateur ne l'envoie que sur les endpoints `/auth/*`. Réduction de la surface d'exposition du token.
- **`ROLE_ORDER` dict** : la hiérarchie des rôles est encodée dans un dictionnaire `{UserRole: int}` plutôt que dans une logique ordinale sur l'enum, pour rester explicite et résistant à une réorganisation future de l'ordre de déclaration de l'enum.
- **`StrictModel` (extra="forbid")** : tous les schémas d'écriture héritent de `StrictModel` pour rejeter tout champ inattendu avec HTTP 422 — cf. ADR-007.
- **Argon2id defaults** : l'implémentation utilise les paramètres par défaut de `argon2-cffi` (time_cost=3, memory_cost=65536 soit 64 MiB). Aucun paramètre custom n'est passé.
- **Fallback mailer conditionné à l'environnement** : `ibis/core/mailer.py` logge le contenu complet de l'email quand `SMTP_HOST` est vide — utile en dev pour récupérer le lien de reset. Ce fallback est strictement réservé aux environnements non-production (`settings.is_production`), car le corps porte un lien de réinitialisation valable 1 h : le logger en production reviendrait à donner la prise de contrôle de tout compte à quiconque lit `docker compose logs`. En production sans SMTP, `send_email` émet uniquement `mailer.not_configured` (niveau `warning`) avec le `user_id` — jamais le jeton, le lien ni l'adresse email (ARCH §13).

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/api/tests/integration/test_auth.py` | Register auto-login, duplicate email, weak password, login ok/wrong, refresh rotation, vol détecté (famille révoquée), logout, forgot+reset flow, rate limit 429 | Existant |
| `apps/api/tests/unit/test_mailer.py` | Fallback sans SMTP : en production le corps de l'email (lien de reset) n'atteint jamais le logger — seul `mailer.not_configured` + `user_id` ; hors production le lien reste loggé | Existant |
| Tests unitaires `security.py` | Non trouvés dans ce périmètre | Absent (déduit) |
| Tests RBAC par matrice | Mentionnés dans ADR-003 "testés par la matrice CDC §3.2" — fichier non identifié ici | À confirmer |
