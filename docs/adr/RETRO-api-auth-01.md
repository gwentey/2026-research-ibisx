# RETRO-api-auth-01 — Anti-énumération email : réponse opaque sur authenticate et forgot-password

| Champ      | Valeur                |
|------------|-----------------------|
| Statut     | Documenté (rétro)     |
| Date       | 2026-07-19            |
| Source     | Rétro-ingénierie      |
| Features   | api/auth              |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | SECURITY |
| Q1 — Coût de revert > 1j ? | OUI — La politique anti-énumération est appliquée à la fois dans `service.authenticate()` (message d'erreur générique "Email ou mot de passe incorrect" même si l'email est inconnu), dans `routes.forgot_password()` (réponse 204 systématique), et dans les tests d'intégration. La corriger impliquerait de revoir ces trois couches + tout endpoint futur susceptible d'exposer l'existence d'un compte. |
| Q2 — Non-déductible du code ? | OUI — Le choix du message générique plutôt que deux messages distincts ("email inconnu" / "mauvais mot de passe") ne se voit pas dans package.json ni dans les configs. Il faut lire le commentaire dans `service.py` ("Erreur générique unique : pas d'énumération d'emails possible") pour comprendre l'intention. |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — Concerne api/auth (authenticate, forgot_password, endpoints register/login) et api/users (tout endpoint qui manipule des adresses email doit respecter la même convention pour ne pas contredire l'invariant, ex. : vérification de disponibilité d'email avant inscription). |
| Q4 — Casse un invariant si ignoré ? | OUI — Un dev qui ajoute un endpoint `GET /auth/check-email` ou qui modifie le message d'erreur de `authenticate()` pour différencier "email inconnu" de "mauvais mot de passe" expose une surface d'attaque permettant la constitution d'une liste d'emails valides par brute-force. |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

En authentification, retourner des messages d'erreur distincts selon que l'email existe ou non ("Cet email n'est pas enregistré" vs "Mot de passe incorrect") permet à un attaquant de vérifier silencieusement l'existence d'un compte par simple essai — attaque dite "email enumeration". La même logique s'applique à la récupération de mot de passe : répondre différemment selon l'existence du compte permet l'énumération.

## Décision identifiée

L'ensemble des endpoints qui traitent une adresse email non authentifiée retournent une réponse intentionnellement neutre :

- `service.authenticate()` : le même objet `UnauthorizedError("Email ou mot de passe incorrect", code="INVALID_CREDENTIALS")` est levé que l'email soit inconnu, que le compte n'ait pas de mot de passe (compte Google uniquement), ou que le mot de passe soit incorrect. Le code de retour est identique dans tous les cas.
- `routes.forgot_password()` : répond toujours HTTP 204, qu'un compte existe ou non à cette adresse.
- Les tests vérifient explicitement que `ghost@example.org` (email inexistant) retourne le même code d'erreur qu'un mauvais mot de passe.

## Conséquences observées

### Positives
- Un attaquant ne peut pas déterminer si une adresse email est enregistrée sans posséder le mot de passe correct.
- La surface d'une attaque de type "credential stuffing" est réduite.

### Négatives / Dette
- L'UX est légèrement dégradée : un utilisateur qui se trompe d'adresse email voit le même message que celui qui tape un mauvais mot de passe. Un mécanisme d'aide (ex. "essayez de vous connecter avec Google") compenserait partiellement.
- La convention doit être maintenue sur tout nouvel endpoint qui touche une adresse email — elle n'est pas enforced automatiquement, uniquement par convention de code.

## Recommandation

Garder. L'invariant est critique pour la sécurité. Documenter explicitement la convention dans les onboarding docs pour que tout dev qui ajoute un endpoint lié aux emails en soit informé.
