# RETRO-api-scoring-01 — Scores de pertinence calculés à la demande (raw + compute-on-read) — non matérialisés en base

| Champ      | Valeur                     |
|------------|----------------------------|
| Statut     | Documenté (rétro)          |
| Date       | 2026-07-19                 |
| Source     | Rétro-ingénierie           |
| Features   | api/scoring, api/datasets  |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DB-STRATEGY |
| Q1 — Coût de revert > 1j ? | OUI — Matérialiser les 12 scores critères en base nécessiterait : une migration Alembic ajoutant des colonnes sur la table `datasets`, une logique de recalcul déclenchée à chaque mise à jour de champ source (dans le service `api/datasets`), une invalidation de ces colonnes lors des imports, et la mise à jour des fixtures de seeds. Cette modification touche au moins 3 modules distincts (`scoring`, `datasets`, `importer`). |
| Q2 — Non-déductible du code ? | OUI — Le code montre que les scores sont recalculés à chaque appel, mais l'intention architecturale (pourquoi ne pas stocker) n'est pas dans `pyproject.toml` ni dans les configs. Le commentaire `[NE PAS REPRODUIRE] P2 v1 : 3 implémentations divergentes` dans `formulas.py` révèle une décision prise après une expérience douloureuse, pas lisible sans cet ADR. |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — Trois specs dépendent de cette décision : `api/scoring` (calcul à la demande), `api/datasets` (le filtre SQL `ethical_score_expression()` est une réimplémentation SQL de la même formule, admise car utilisée uniquement pour le WHERE), `web/datasets` (consomme l'endpoint de scoring pour la heatmap du catalogue). |
| Q4 — Casse un invariant si ignoré ? | OUI — Si un développeur matérialise les scores dans la table `datasets` sans mettre en place une invalidation correcte, les scores stockés deviendraient silencieusement obsolètes dès qu'un champ source est modifié (ex : `transparency` mis à True après une mise à jour). L'utilisateur verrait un classement incohérent avec les données affichées sur la fiche détail. |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

---

## Contexte

Le module de scoring calcule un score composite sur 12 critères pour chaque dataset, à partir de champs déjà présents dans le catalogue. Lors d'une version antérieure (P2 v1), trois implémentations divergentes coexistaient — une côté front, une dans un service intermédiaire, et une dans le backend — produisant des classements inconsistants selon le point d'entrée utilisé. La décision de concentrer toutes les formules dans un module Python pur (`formulas.py`) et de ne jamais les reproduire en dehors a été prise pour éliminer cette divergence.

Corollaire de cette décision : les scores ne sont pas stockés en base de données. Chaque appel `POST /datasets/score` relit les champs bruts du `Dataset` et recalcule la totalité des 12 critères. Les scores retournés sont toujours cohérents avec l'état courant des données.

---

## Décision identifiée

Les scores de pertinence (les 12 critères et le score final pondéré) sont calculés à la demande à chaque requête HTTP, à partir des champs bruts de la table `datasets`. Ils ne sont jamais matérialisés ni cachés dans la base de données. Le module `formulas.py` est l'unique source de vérité pour ces calculs (invariant P3 documenté dans le code source).

---

## Conséquences observées

### Positives

- Les scores sont toujours à jour avec l'état courant des données — aucun risque de staleness.
- L'ajout d'un nouveau critère ou la modification d'une formule ne nécessite pas de migration de données.
- `formulas.py` est un module pur (aucun I/O) testable avec des golden tests sans base de données.
- La duplication SQL dans `filters.py` (`ethical_score_expression()`) est la seule exception admise, confinée au filtre WHERE et explicitement documentée.

### Négatives / Dette

- La performance est O(n) sur le nombre de datasets récupérés : pour de larges catalogues (> quelques milliers de datasets), le calcul peut devenir coûteux sans pagination ou pré-filtrage.
- Le test de performance CDC §12.2 valide < 1 s pour 100 datasets ; ce seuil n'est pas garanti sur un catalogue plus volumineux.
- Si un critère de scoring doit dépendre de données agrégées (ex : score calculé sur l'historique d'usage), le modèle compute-on-read nécessiterait une révision architecturale.

---

## Recommandation

Garder. Le catalogue IBIS-X ne devrait pas dépasser quelques centaines de datasets dans sa phase actuelle. Si le volume croît significativement, envisager un cache Redis avec invalidation sur mise à jour du dataset (clé `scoring:{dataset_id}`) plutôt qu'une matérialisation en base.
