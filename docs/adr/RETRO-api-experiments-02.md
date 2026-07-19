# RETRO-api-experiments-02 — Modèle crédit : débit à l'entraînement, remboursement conditionnel à l'annulation

| Champ      | Valeur                          |
|------------|---------------------------------|
| Statut     | Documenté (rétro)               |
| Date       | 2026-07-19                      |
| Source     | Rétro-ingénierie                |
| Features   | api/experiments                 |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DATA-MODEL |
| Q1 — Coût de revert > 1j ? | OUI — Changer la sémantique (ex. : débit post-entraînement, suppression des crédits, crédit = unité de dataset plutôt que d'entraînement) nécessiterait une migration de `users.credits`, une refonte de `enforce_quotas_and_debit`, de `cancel_experiment`, du module admin de gestion des crédits, et une synchronisation avec le frontend — bien plus d'une journée. |
| Q2 — Non-déductible du code ? | OUI — La règle « remboursement seulement si encore pending au moment de l'annulation » n'est visible dans aucun fichier de config ou `pyproject.toml` ; elle est uniquement formulée dans la logique de `cancel_experiment` et dans le commentaire `# remboursement : le calcul n'a jamais commencé`. |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — api/experiments (débit, remboursement, vérification de solvabilité), api/users (champ `credits` sur le modèle `User`, exposé via `/users/me`), api/admin (attribution de crédits aux utilisateurs via les routes admin). |
| Q4 — Casse un invariant si ignoré ? | OUI — Omettre le débit = entraînements illimités gratuits ; omettre le remboursement sur annulation pending = utilisateur pénalisé pour un calcul qui n'a jamais démarré ; tester la solvabilité après le débit = race condition possible sous haute concurrence. |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

IBIS-X limite les ressources de calcul par utilisateur via un système de crédits. Ce système sert deux objectifs : réguler la consommation (quotas) et rendre le coût de chaque entraînement explicite pour l'utilisateur (pédagogie). Les valeurs limites (3 simultanés, 20/jour, seuil de crédits) sont configurables par variables d'environnement, mais la structure du modèle — débit à la création, remboursement conditionnel — est un invariant du code.

## Décision identifiée

Lors du lancement d'une expérience (`start_experiment`) :
1. Les quotas sont vérifiés (`max_concurrent_trainings`, `max_daily_trainings`).
2. La solvabilité est vérifiée (`user.credits >= 1`).
3. Un crédit est débité (`user.credits -= 1`) avant la mise en file Celery.

Lors de l'annulation (`cancel_experiment`) :
- Si l'expérience est encore `pending` (le calcul n'a jamais commencé) : un crédit est remboursé (`user.credits += 1`).
- Si l'expérience est `running` : aucun remboursement (calcul déjà consommé).

L'annulation d'une expérience `pending` efface aussi l'artefact partiel s'il existe.

## Conséquences observées

### Positives
- Les crédits reflètent fidèlement la consommation effective : seuls les entraînements réellement exécutés sont facturés.
- Le débit atomique avant l'enqueue évite qu'un utilisateur à 0 crédit saturé la file Celery.
- Le test `test_cancel_pending_refunds_credit` valide l'invariant de remboursement.

### Négatives / Dette
- La vérification des quotas journaliers (`Experiment.created_at >= day_start`) utilise `datetime.now(UTC)` sans fuseau conservé (`replace(tzinfo=None)`), ce qui peut produire un comportement inattendu à minuit UTC si les utilisateurs sont dans un autre fuseau horaire.
- Il n'y a pas de journal d'audit des mouvements de crédits (débit/remboursement) ; seul le solde courant est visible, pas l'historique.

## Recommandation

Garder. Le modèle débit-à-l'enqueue + remboursement-sur-pending est cohérent et bien couvert par les tests. L'absence de journal d'audit de crédits est un manque à combler si le système de facturation évolue vers un modèle payant.
