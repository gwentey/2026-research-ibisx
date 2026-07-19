# Spec Fonctionnelle — api/auth [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | api/auth            |
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
| [RETRO-001](../../../adr/RETRO-001.md) | Anti-énumération email : réponse opaque sur authenticate et forgot-password | Documenté (rétro) |
| [RETRO-002](../../../adr/RETRO-002.md) | Niveau d'audience XAI : dérivation, priorité au choix explicite, et capture immuable | Documenté (rétro) |

> *Table auto-générée par adr-linker. Ne pas éditer manuellement.*

---

## Contexte et objectif

Le module `api/auth` constitue le point d'entrée unique de toutes les identités sur la plateforme IBIS-X. Il couvre l'inscription, la connexion email/mot de passe, la connexion Google OIDC, la rotation de session, la déconnexion, la réinitialisation de mot de passe et l'enforcement des rôles sur les routes protégées.

Le module a été conçu sans bibliothèque d'authentification tierce (ni fastapi-users, ni Auth0/Clerk/Firebase) afin de ne pas dépendre d'un service externe facturable et de garder la logique de session sous contrôle total.

## Règles métier (déduites du code)

1. **Unicité email** : deux comptes ne peuvent pas partager le même email (normalisé en minuscules, espaces tronqués). Toute tentative de création sur un email déjà pris renvoie HTTP 409.

2. **Mot de passe minimum** : 8 caractères minimum, 128 maximum. La validation est faite au niveau du schéma Pydantic avant tout appel au service.

3. **Auto-connexion à l'inscription** : la création d'un compte émet immédiatement une paire access/refresh token — l'utilisateur est connecté sans étape de login séparée.

4. **Réponse opaque sur échec d'authentification** : quelle que soit la raison de l'échec (email inconnu, mot de passe incorrect, compte sans mot de passe), le message retourné est identique ("Email ou mot de passe incorrect") afin de ne pas permettre l'énumération d'emails.

5. **Refresh token httpOnly, rotation à chaque usage** : le refresh token est un cookie `httpOnly Secure SameSite=Lax` dont le chemin est limité à `/api/v1/auth`. À chaque appel à `/auth/refresh`, l'ancien token est révoqué et un nouveau est émis dans la même famille. La réutilisation d'un token déjà révoqué entraîne la révocation de toute la famille (détection de vol présumé).

6. **Révocation globale après reset de mot de passe** : toutes les sessions actives d'un utilisateur sont invalidées dès que son mot de passe est réinitialisé avec succès.

7. **Lien de reset à usage unique, TTL 1 heure** : le token de réinitialisation ne peut être consommé qu'une seule fois (`used_at` tamponné). Tout appel ultérieur avec le même token renvoie une erreur.

8. **Forgot-password toujours 204** : l'endpoint `/auth/forgot-password` renvoie 204 qu'il existe un compte ou non — même politique anti-énumération que le login.

9. **Connexion Google = OIDC pur, aucun token Google stocké** : le backend échange le code, valide l'`id_token` signé (RS256, `email_verified` obligatoire, vérification de l'issuer, de l'audience et du nonce), puis émet ses propres JWT IBIS. Les tokens Google ne sont jamais persistés.

10. **Liaison par email vérifié** : si un compte email existe déjà au moment d'une première connexion Google, l'identité OAuth est rattachée au compte existant sans créer de doublon.

11. **Compte "Google uniquement"** : un compte créé via Google a `hashed_password = NULL`. Il peut ultérieurement définir un mot de passe via le module users.

12. **RBAC 3 niveaux hiérarchiques** : `user < contributor < admin`. Le rôle est encodé dans le claim JWT et vérifié sans appel base pour les routes courantes. Les actions admin critiques revérifient le rôle en base (protection contre une élévation de privilège à la volée).

13. **Rate limiting 10 req/min/IP sur `/auth/*`** : implémenté via Redis (INCR + EXPIRE). En cas d'indisponibilité Redis, le rate limiting est désactivé (fail-open) — la disponibilité du service prime sur la protection de débit, Argon2id restant la dernière ligne de défense côté brute-force.

14. **Audience XAI dérivée à l'onboarding** : la valeur `xai_audience` est calculée automatiquement depuis `ai_familiarity` (1-2 → novice, 3 → intermediate, 4-5 → expert) lors de la complétion de l'onboarding. Cette valeur pilote l'ensemble de l'adaptation XAI sur la plateforme.

15. **Crédits initiaux** : chaque nouveau compte reçoit le nombre de crédits configuré dans `settings.default_credits` (valeur observée 100 dans les tests).

16. **Locale détectée à l'inscription** : la locale (`fr`/`en`) est déduite de l'en-tête `Accept-Language` au moment de l'inscription email. Seules `fr` et `en` sont acceptées — toute autre valeur repasse à `fr`.

## Cas d'usage (déduits)

### CU-001 — Inscription email/mot de passe
L'utilisateur soumet email + mot de passe. Le service normalise l'email, vérifie l'unicité, hache le mot de passe (Argon2id), crée le compte avec le rôle `user` et 100 crédits, puis émet une paire access+refresh. Réponse HTTP 201 avec le JWT et les données profil.

### CU-002 — Connexion email/mot de passe
L'utilisateur soumet email + mot de passe. Le service vérifie l'existence du compte, le hachage Argon2id, l'état actif. Tout échec (email inconnu, mauvais mot de passe, compte inactif sur mauvais mot de passe) renvoie le même message générique HTTP 401.

### CU-003 — Rotation de session
Le front appelle `POST /auth/refresh` avec le cookie httpOnly. Le service révoque l'ancien token, émet un nouveau (même famille), et répond avec un nouveau JWT access + nouveau cookie.

### CU-004 — Détection de vol de session
Si le front rejoue un token refresh déjà révoqué (par exemple après une compromission), le service révoque toute la famille de tokens et retourne 401. L'utilisateur doit se reconnecter.

### CU-005 — Déconnexion
`POST /auth/logout` révoque le refresh token en cours et supprime le cookie. Toute tentative de refresh ultérieure avec le même token retourne 401.

### CU-006 — Réinitialisation de mot de passe
L'utilisateur demande un lien (réponse toujours 204). S'il existe un compte actif, un token opaque est généré, haché en base, et l'URL est envoyée par email (loggée en dev sans SMTP). Le lien est valable 1 heure et à usage unique. Après reset, toutes les sessions existantes sont révoquées.

### CU-007 — Connexion Google
1. Le front demande `GET /auth/google/authorize` → reçoit l'URL d'autorisation Google et le `state`.
2. Google redirige le front avec le code.
3. Le front poste `POST /auth/google/exchange` (code + state).
4. Le backend valide l'`id_token` (RS256, nonce, email_verified), effectue l'upsert de l'identité, émet les JWT IBIS.

### CU-008 — Accès aux routes protégées
Toute route protégée injecte `CurrentClaims` (JWT décodé sans BDD) ou `CurrentUser` (JWT + chargement BDD). Les routes admin critiques utilisent `CurrentAdminVerified` (vérification BDD du rôle).

## Dépendances

- `ibis.core.security` — primitives Argon2id, JWT HS256, tokens opaques SHA-256
- `ibis.core.ratelimit` — rate limiting Redis
- `ibis.core.redis` — stockage des états OAuth (state/nonce/verifier, TTL 10 min)
- `ibis.core.mailer` — envoi de l'email de reset (loggé en dev sans SMTP)
- `ibis.core.config` — `Settings` : JWT secret, durées de vie, Google credentials, `default_credits`
- `ibis.db.engine` — sessions SQLAlchemy
- Module `api/users` — partage les schémas `OnboardingRequest`, `ProfileUpdateRequest`, `PasswordChangeRequest`, `AccountDeleteRequest` définis dans `auth/schemas.py`

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **TTL du refresh token** : le code lit `settings.refresh_token_days`. La valeur exacte configurée en prod/dev n'est pas visible dans ce module.
- **Premier admin** : ADR-003 mentionne `ibis create-admin` CLI et `INITIAL_ADMIN_*` au boot — ce mécanisme n'est pas dans `api/auth` mais dans un module à localiser.
- **Envoi d'email** : `send_email()` est appelé mais l'implémentation SMTP/provider réel de prod n'est pas visible depuis ce module.
- **Nettoyage des tokens expirés** : aucune tâche de purge des `refresh_tokens` expirés n'est visible dans ce module — un job de maintenance dans Celery est plausible mais à confirmer.
- **Revocation sur changement de rôle admin** : si un admin est rétrogradé, son JWT actif (30 min) reste valide jusqu'à expiration — la politique de révocation immédiate dans ce cas n'est pas visible ici.
