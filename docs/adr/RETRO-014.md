# RETRO-014 — Role admin reverifiee en base sur chaque route admin

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documente (retro)   |
| Date       | 2026-07-19          |
| Source     | Retro-ingenierie    |
| Features   | api/admin           |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Categorie | SECURITY |
| Q1 — Cout de revert > 1j ? | OUI — Abandonner cette decision imposerait d'adopter des JWT a tres courte duree de vie (ou un mecanisme de blacklist) pour maintenir le meme niveau de garantie ; cela touche la strategie auth globale (ADR-003), la configuration du TTL des tokens, les tests d'integration auth, et potentiellement le refresh flow. La modification deborde largement au-dela de `deps.py`. |
| Q2 — Non-deductible du code ? | OUI — `package.json` / `pyproject.toml` ne revelent pas pourquoi les routes admin font un aller-retour BDD supplementaire. La distinction `CurrentUser` vs `CurrentAdminVerified` et son intention securitaire (resilience a un token JWT valide mais revoque en base) ne se lisent pas dans les dependances. |
| Q3 — Impact transverse (>= 2 specs) ? | OUI — Toutes les routes `api/admin` (9 endpoints) dependent de `CurrentAdminVerified`. La feature `web/admin` depend indirectement du comportement : un admin revoque en base est bloque meme avec un JWT valide. La feature `api/auth` partage `deps.py` ou la fonction `get_verified_admin` est definie. |
| Q4 — Casse un invariant si ignore ? | OUI — Un developpeur ajoutant une nouvelle route admin avec `CurrentUser` ou `require_role(UserRole.admin)` (qui ne fait pas de round-trip BDD) permettrait a un admin revoque en base — mais dont le JWT est encore valide — d'executer des actions privilegiees jusqu'a l'expiration du token. |

> Valide contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

Le module admin expose des operations a fort impact : modification de roles, suppression
de comptes, recharge de credits. Le claim `role` dans le JWT est emis au moment de la
connexion et reste valide jusqu'a l'expiration du token (TTL non specifie dans le code
observe). Si un administrateur est revoque en base entre deux requetes (par un autre
admin), son JWT reste techniquement valide.

Plutot que de raccourcir la duree de vie des access tokens (impactant l'UX de tous les
utilisateurs), l'equipe a ajoute une verification supplementaire en base uniquement sur
les routes admin — un compromis entre securite et performance.

## Decision identifiee

Toutes les routes du router `/admin` utilisent `CurrentAdminVerified` comme dependance
FastAPI, definie dans `auth/deps.py` :

```python
def get_verified_admin(claims: CurrentClaims, db: Session) -> User:
    # 1. Controle du claim JWT (sans BDD)
    if ROLE_ORDER[claims.role] < ROLE_ORDER[UserRole.admin]:
        raise ForbiddenError(...)
    # 2. Chargement en base et double verification
    user = db.get(User, claims.user_id)
    if user is None or not user.is_active or user.role != UserRole.admin:
        raise ForbiddenError(...)
    return user
```

Cette fonction fait un `db.get(User, ...)` supplementaire par rapport a `CurrentUser`,
specifiquement pour reverifier `user.role` et `user.is_active` directement en base.

Le commentaire de `routes.py` rend l'invariant explicite :
`[NE PAS REPRODUIRE] S1/S2 (endpoints sans controle) ni /admin/temporary-grant`.

## Consequences observees

### Positives

- Un admin revoque en base est bloque immediatement, sans attendre l'expiration du JWT.
- Le pattern est self-documenting : `CurrentAdminVerified` vs `CurrentUser` signale
  explicitement les routes a haut privilege.
- La garantie est independante du TTL des access tokens.

### Negatives / Dette

- Chaque route admin genere un aller-retour BDD supplementaire (query `SELECT * FROM users WHERE id = ?`)
  en plus de la query metier de la route.
- Si le pool de connexions est sature, les routes admin sont impactees deux fois.
- La securite repose sur une convention (`CurrentAdminVerified` obligatoire) sans enforcement
  automatique — un oubli lors de l'ajout d'une nouvelle route admin ne serait pas detecte
  en compilation.

## Recommandation

**Garder.** La surcout BDD est negligeable face a la garantie de securite apportee.
Pour reduire le risque d'oubli, envisager un test d'integration qui verifie que toutes
les routes du router `/admin` utilisent bien `CurrentAdminVerified`.
