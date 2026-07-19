# RETRO-004 — Score éthique compute-on-read : jamais persisté en colonne dédiée

| Champ      | Valeur                          |
|------------|---------------------------------|
| Statut     | Documenté (rétro)               |
| Date       | 2026-07-19                      |
| Source     | Rétro-ingénierie                |
| Features   | api/datasets, api/scoring       |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DB-STRATEGY |
| Q1 — Coût de revert > 1j ? | OUI — matérialiser le score en colonne exigerait une migration de schéma (ajout colonne `ethical_score`), un recalcul de cohérence sur tous les datasets existants, un mécanisme de mise à jour automatique à chaque changement de critère (`service.update_dataset`, `importer`), et une resynchronisation du filtre SQL qui aujourd'hui recalcule à la volée dans `filters.py`. Touche service, routes, schemas, filters, importer. |
| Q2 — Non-déductible du code ? | OUI — `to_card()` et `to_detail()` calculent systématiquement `ethical_score(dataset.ethical_values())` à chaque appel, mais la décision de ne pas stocker est une intention architecturale. Ni `pyproject.toml` ni les migrations Alembic ne révèlent qu'il s'agit d'un choix délibéré (absence de colonne plutôt qu'oubli). |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — `api/datasets` (to_card, to_detail, filters), `api/scoring` (module qui agrège le score éthique dans son score composite de pertinence), `api/admin` (affichage et filtrage admin des datasets par score). |
| Q4 — Casse un invariant si ignoré ? | OUI — si un dev matérialise le score en colonne sans recalcul automatique sur `UPDATE datasets SET <critère>`, le score affiché dans le catalogue se désynchronise silencieusement des critères réels. Le filtre `ethical_score_min` retournerait des datasets incorrectement scorés. |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

---

## Contexte

Le score éthique d'un dataset est une fonction pure de ses 10 critères booléens. Ces critères sont mis à jour manuellement (éditeur, import YAML) et via les templates par domaine. Persister le score en colonne dérivée imposerait un mécanisme de recalcul sur chaque mise à jour d'un critère — trigger PostgreSQL, hook SQLAlchemy, ou obligation d'appel dans tous les points d'écriture.

Le module a opté pour le calcul à la lecture : simple, toujours synchronisé, sans infrastructure supplémentaire. La performance est acceptable car le calcul est O(10) par dataset.

Pour le filtre SQL `ethical_score_min` (qui ne peut pas appeler la fonction Python), `filters.py` réexprime le même calcul en SQL pur via `ethical_score_expression()` en important `ETHICAL_CRITERIA` depuis la même source unique.

## Décision identifiée

Le score éthique n'est pas stocké en base. Il est calculé à chaque appel de `to_card()` et `to_detail()` par `ethics.ethical_score()`. Le filtre `ethical_score_min` dans `GET /datasets` est implémenté par une expression SQL équivalente construite dynamiquement dans `filters.py` à partir de la même `ETHICAL_CRITERIA`.

```python
# service.py
def to_card(dataset: Dataset) -> DatasetCard:
    return DatasetCard(
        ...,
        ethical_score=ethical_score(dataset.ethical_values()),  # compute-on-read
    )

# filters.py — même formule, réexprimée en SQL
def ethical_score_expression():
    true_count = sum(
        cast(case((getattr(Dataset, name).is_(True), 1), else_=0), Integer)
        for name in ETHICAL_CRITERIA
    )
    return true_count * 100 / len(ETHICAL_CRITERIA)
```

## Conséquences observées

### Positives
- Score toujours synchronisé avec les critères réels, sans risque de désynchronisation.
- Pas de colonne dérivée à maintenir, pas de trigger ni de hook d'événement.
- La source unique `ETHICAL_CRITERIA` garantit que la formule Python et la formule SQL sont identiques.

### Négatives / Dette
- Chaque appel de liste ou de détail recalcule le score pour chaque dataset retourné. À grande échelle (catalogue de plusieurs milliers de datasets), une matérialisation partielle (vue matérialisée PostgreSQL ou colonne mise à jour par trigger) pourrait devenir nécessaire.
- La duplication fonctionnelle Python/SQL (deux implémentations du même calcul) peut diverger si `ETHICAL_CRITERIA` est modifiée sans mettre à jour les tests.

## Recommandation

Garder pour la taille actuelle du catalogue. Surveiller les performances de `GET /datasets` si le nombre de datasets dépasse ~10 000. Si besoin, introduire une vue matérialisée PostgreSQL plutôt qu'une colonne — cela préserve la source unique sans code d'application supplémentaire.
