# RETRO-013 — `success_rate` absent (None) quand aucune expérience terminée

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documenté (rétro)   |
| Date       | 2026-07-19          |
| Source     | Rétro-ingénierie    |
| Features   | api/dashboard, web/dashboard |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DATA-MODEL |
| Q1 — Coût de revert > 1j ? | OUI — passer `success_rate` de `float \| None` à `float` non-nullable impose : (1) modifier le schéma Pydantic `DashboardKpis`, (2) régénérer le client TypeScript (`@hey-api/openapi-ts`), (3) adapter le composant frontend qui conditionne l'affichage sur `null`, (4) mettre à jour les tests d'intégration qui assertent `None`. Changement multi-couches API + web coordonné. |
| Q2 — Non-déductible du code ? | OUI — le type `float \| None` est visible dans `routes.py`, mais l'intention (ne jamais afficher un taux de 0 % pour un compte neuf, principe d'honnêteté "P1") n'est pas lisible depuis `package.json`, `pyproject.toml`, ou les configs. Le commentaire `# None tant qu'aucune expérience terminée/échouée (P1)` est la seule trace du pourquoi. |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — la spec `api/dashboard` fixe le contrat émetteur ; la spec `web/dashboard` (composant frontend) doit afficher "N/A" ou "-" plutôt que "0 %" quand le champ est `null`. Ces deux specs sont couplées par ce champ nullable. |
| Q4 — Casse un invariant si ignoré ? | OUI — un dev remplaçant `None` par `0.0` (ou retirant la condition `if finished > 0`) afficherait silencieusement "0 % de succès" à tout nouvel utilisateur n'ayant encore jamais lancé d'expérience, ce qui est factuellement faux et trompeur pour l'UX. |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

La v1 du dashboard (référencée dans le commentaire `[NE PAS REPRODUIRE]` du code) affichait des tuiles avec des valeurs décoratives. Lors de la réécriture M7 (CDC §10), l'exigence P1 a imposé que chaque chiffre soit une agrégation SQL réelle. Cette exigence inclut le taux de succès : pour un compte sans expérience terminée, il n'existe pas de taux calculable — afficher 0 % serait une donnée inventée.

## Décision identifiée

Le champ `success_rate` est typé `float | None` dans le schéma Pydantic `DashboardKpis`. La logique de calcul est :

```python
success_rate = round(completed / finished, 4) if finished > 0 else None
```

où `finished = completed + failed`. Tant que `finished == 0`, le champ est `null` dans la réponse JSON. Le test d'intégration `test_dashboard_empty_account_is_honest` vérifie explicitement ce comportement.

## Conséquences observées

### Positives

- Le frontend peut distinguer "pas encore de données" de "0 % de réussite" et adapter l'affichage (placeholder vs valeur réelle).
- L'invariant est couvert par un test d'intégration dédié, ce qui empêche une régression silencieuse.
- Le schéma OpenAPI expose correctement la nullabilité, et le client TypeScript généré reflète `number | null`.

### Négatives / Dette

- Les composants frontend doivent gérer le cas `null` explicitement à chaque affichage du KPI, ce qui ajoute une branche conditionnelle dans le rendu.
- Si d'autres KPI nullables sont ajoutés (ex. `average_dataset_size`), la convention `None = pas encore de données` doit être documentée et appliquée systématiquement pour rester cohérente.

## Recommandation

Garder. L'invariant est intentionnel, testé, et constitue une garantie d'honnêteté UX fondamentale. Toute évolution du dashboard ajoutant un KPI calculé doit appliquer la même règle : retourner `null` si le dénominateur est zéro, jamais une valeur par défaut inventée.
