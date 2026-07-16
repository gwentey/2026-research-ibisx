# ADR-003 — Authentification & RBAC

- **Statut** : accepté (2026-07-16)
- **Source** : [docs/refonte/02-ARCHITECTURE.md](../refonte/02-ARCHITECTURE.md) §7

## Décision

**Auth maison courte (~300 lignes), sans IDP tiers** (pas d'Auth0/Clerk/Firebase/Supabase/Keycloak — rien d'hébergé ni de facturable) et sans framework d'auth lourd ([NE PAS REPRODUIRE] fastapi-users).

- **Access token JWT** HS256 (secret ≥ 256 bits via env), durée 30 min, claims `sub`, `role`, `exp`, `iat`, `jti`. Stocké **en mémoire** côté front (jamais localStorage).
- **Refresh token opaque** (256 bits), haché en base, 7 jours, **rotation à chaque usage** ; réutilisation d'un token révoqué → révocation de la famille (détection de vol). Cookie `httpOnly Secure SameSite=Lax` limité à `/api/v1/auth`.
- Hash **Argon2id** (argon2-cffi).
- **Connexion Google = OIDC direct** avec authlib (identifiants Google Cloud Console gratuits) : le backend échange le code, valide l'`id_token` (`email_verified`), lie par email vérifié ou crée le compte, puis émet **nos** JWT. Aucun token Google conservé.
- RBAC : rôle unique `user < contributor < admin` en claim JWT, enforcement par dépendances FastAPI (`CurrentUser`, `require_role`, `require_owner_or_admin`), testé par la matrice CDC §3.2.
- Premier admin : CLI `ibis create-admin` ou `INITIAL_ADMIN_*` au boot — [NE PAS REPRODUIRE] `/admin/temporary-grant`.

## Conséquences

- Plus de gateway ni de headers `X-User-ID` forgeables : l'API vérifie elle-même ses tokens.
- Rate limiting sur `/auth/*` (Redis). Les actions admin critiques revérifient le rôle en base.
