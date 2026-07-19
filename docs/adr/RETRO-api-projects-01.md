# RETRO-api-projects-01 — Recommandations déléguées à score_datasets() : invariant P3

| Champ      | Valeur                          |
|------------|---------------------------------|
| Statut     | Documenté (rétro)               |
| Date       | 2026-07-19                      |
| Source     | Rétro-ingénierie                |
| Features   | api/projects, api/scoring       |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DATA-MODEL |
| Q1 — Coût de revert > 1j ? | OUI — Implémenter un calcul de score indépendant dans `projects/service.py` produirait deux implémentations divergentes du même algorithme multi-critères pondéré. Réconcilier les résultats ultérieurement imposerait de parcourir et corriger tous les appels aux deux fonctions, de migrer les résultats stockés ou mis en cache, et de mettre à jour les tests d'intégration croisée — bien plus d'une journée. |
| Q2 — Non-déductible du code ? | OUI — La contrainte que `GET /projects/{id}/recommendations` DOIT déléguer à `score_datasets()` (et non implémenter un calcul local) n'est pas visible dans `pyproject.toml` ni dans les configs. Elle est formulée uniquement via le commentaire de module `# CRUD isolé par user_id + recommandations via LE module scoring (P3)` et par l'invariant de test `test_recommendations_match_score_endpoint`. |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — `api/projects` (endpoint `GET /recommendations` qui consomme la décision) et `api/scoring` / `api/datasets` (module `score_datasets()` qui constitue l'implémentation canonique et dont le contrat est contraint par cette décision). Une modification de `score_datasets()` doit rester compatible avec les projets, et inversement. |
| Q4 — Casse un invariant si ignoré ? | OUI — Un dev ajoutant une formule de scoring locale (ex. pour optimiser les performances) obtiendrait des recommandations de projet qui divergent silencieusement de `POST /datasets/score` à paramètres égaux. L'utilisateur verrait des classements différents selon le point d'entrée utilisé, sans avertissement. Le test `test_recommendations_match_score_endpoint` valide cet invariant mais peut être contourné si la délégation est abandonnée. |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

---

## Contexte

IBIS-X propose deux chemins pour scorer des datasets : `POST /datasets/score` (scoring direct depuis le catalogue) et `GET /projects/{id}/recommendations` (scoring piloté par les critères/pondérations d'un projet). Ces deux chemins doivent produire des résultats strictement identiques à paramètres équivalents — c'est le principe P3 du produit.

Le module de scoring (`ibis/modules/scoring/`) est le moteur canonique de calcul de pertinence multi-critères. Concentrer l'implémentation dans ce seul module évite la duplication de la logique pondérée et garantit que toute évolution de la formule (ajout d'un critère, changement de poids par défaut, normalisation) se propage automatiquement aux deux points d'entrée.

## Décision identifiée

La fonction `recommendations()` dans `projects/service.py` convertit les `criteria` et `weights` du projet en paramètres `DatasetFilters` et `[CriterionWeight]`, puis délègue intégralement à `score_datasets()` du module scoring :

```python
# projects/service.py
def recommendations(db: Session, project: Project) -> ScoreResponse:
    """Le classement du projet = LE scoring backend appliqué à ses critères/poids (P3)."""
    filters = DatasetFilters.model_validate(project.criteria)
    weights = [
        CriterionWeight(criterion_name=name, weight=weight)
        for name, weight in project.weights.items()
    ]
    return score_datasets(db, filters=filters, weights=weights)
```

Aucune logique de scoring n'est dupliquée dans le module `projects`. Le test `test_recommendations_match_score_endpoint` garantit la cohérence P3 en comparant les résultats bruts des deux endpoints.

## Conséquences observées

### Positives

- Un seul point de vérité pour le calcul de score : toute évolution de `score_datasets()` se propage aux recommandations de projet sans modification supplémentaire.
- L'utilisateur obtient les mêmes résultats qu'il passe par le catalogue ou par son projet — comportement prévisible et sans surprise.
- Le test d'intégration croisée `test_recommendations_match_score_endpoint` est un filet de sécurité sur la cohérence P3.

### Négatives / Dette

- La conversion `DatasetFilters.model_validate(project.criteria)` suppose que les critères stockés en JSONB restent valides au regard du schéma `DatasetFilters` courant. Une évolution du schéma `DatasetFilters` (ajout d'un champ obligatoire) peut rendre des projets existants non-deserializables sans migration des données JSONB.
- La délégation complète empêche d'optimiser les recommandations de projet indépendamment (ex. : pré-filtrage sur l'index `ix_projects_user_id` avant le scoring) sans modifier le contrat de `score_datasets()`.

## Recommandation

Garder. La délégation P3 est l'invariant structurant du module. Si la désérialisation de `DatasetFilters` depuis JSONB devient fragile lors d'évolutions du schéma, introduire une migration Alembic qui normalise les colonnes JSONB existantes plutôt que de contourner la délégation.
