# Spec Technique — api/scoring

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | api/scoring         |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie    |

---

## Architecture du module

Le module `scoring` est composé de quatre fichiers aux responsabilités strictement séparées :

- **`formulas.py`** — module pur (aucun I/O), contient toutes les formules mathématiques, les constantes `CRITERIA`, `DEFAULT_WEIGHTS`, `PROFILES`, et le dataclass `DatasetFacts` servant d'interface de découplage avec SQLAlchemy. Identifié comme source unique de vérité pour les calculs (commentaire `[NE PAS REPRODUIRE]`).
- **`service.py`** — orchestre la récupération des datasets (via `apply_filters`), invoque `formulas.py`, trie les résultats et construit la réponse.
- **`schemas.py`** — définit les contrats Pydantic (`ScoreRequest`, `ScoreResponse`, `ScoredDataset`, `CriterionWeight`, `ScoringProfile`, `ProfilesResponse`) avec validation stricte (`extra="forbid"`) et contrainte de valeur sur les poids (`ge=0, le=1`).
- **`routes.py`** — expose deux endpoints FastAPI avec dépendance `CurrentClaims` (auth JWT) et `get_db` (session SQLAlchemy).

Le flux pour `POST /datasets/score` :
1. Validation Pydantic du payload (`ScoreRequest`).
2. Résolution des poids : si tous nuls ou liste vide → `DEFAULT_WEIGHTS`.
3. Requête SQL avec filtres optionnels (`apply_filters`) → liste d'objets `Dataset`.
4. Pour chaque dataset : extraction `DatasetFacts.from_dataset()` → `criterion_scores()` → `weighted_score()`.
5. Tri décroissant stable (score desc, nom asc, id asc).
6. Construction `ScoreResponse` avec poids normalisés.

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/api/ibis/modules/scoring/formulas.py` | Formules pures, constantes, DatasetFacts | ~226 |
| `apps/api/ibis/modules/scoring/service.py` | Orchestration scoring + tri | ~52 |
| `apps/api/ibis/modules/scoring/schemas.py` | Contrats Pydantic entrée/sortie | ~52 |
| `apps/api/ibis/modules/scoring/routes.py` | Endpoints FastAPI (`/datasets/score`, `/score/profiles`) | ~43 |
| `apps/api/ibis/modules/datasets/ethics.py` | `ETHICAL_CRITERIA` + `ethical_score()` (importé par formulas) | ~28 |
| `apps/api/ibis/modules/datasets/filters.py` | `apply_filters()` + `ethical_score_expression()` SQL (importé par service) | ~89 |
| `apps/api/ibis/modules/datasets/models.py` | `Dataset.ethical_values()` (utilisée dans `DatasetFacts.from_dataset`) | — |
| `apps/api/ibis/modules/datasets/service.py` | `to_card()` (utilisée dans `service.score_datasets`) | — |
| `apps/api/tests/unit/test_scoring_formulas.py` | Golden tests des formules (valeurs calculées à la main) | ~201 |
| `apps/api/tests/integration/test_scoring_api.py` | Tests d'intégration HTTP + test de performance 100 datasets | ~132 |

---

## Schéma BDD

Le module scoring ne possède aucune table propre. Il lit exclusivement la table `datasets` via le modèle `Dataset`. Les champs utilisés par `DatasetFacts.from_dataset()` :

| Champ Dataset | Type | Rôle dans le scoring |
|---------------|------|----------------------|
| `ethical_values()` (méthode) | `dict[str, bool \| None]` | Alimente `ethical_score` |
| `metadata_provided_with_dataset` | `bool \| None` | Composante documentation du score technique |
| `external_documentation_available` | `bool \| None` | Composante documentation du score technique |
| `has_missing_values` | `bool \| None` | Composante qualité des données du score technique |
| `global_missing_percentage` | `float \| None` | Composante qualité des données (si `has_missing_values=True`) |
| `split` | `bool \| None` | Composante split du score technique |
| `instances_number` | `int \| None` | Volume du jeu de données |
| `features_number` | `int \| None` | Dimensionnalité du jeu de données |
| `num_citations` | `int` | Score de popularité |
| `year` | `int \| None` | Fraîcheur du dataset |
| `sample_balance_level` | `str \| None` | Équilibre de l'échantillon (`balanced`/`moderate`/`imbalanced`/`severely_imbalanced`) |
| `anonymization_applied` | `bool \| None` | Critère individuel anonymisation |
| `transparency` | `bool \| None` | Critère individuel transparence |
| `informed_consent` | `bool \| None` | Critère individuel consentement éclairé |

---

## API / Endpoints

| Méthode | Route | Operation ID | Description | Auth |
|---------|-------|-------------|-------------|------|
| `POST` | `/api/v1/datasets/score` | `scoreDatasets` | Score pondéré + décomposition des 12 critères sur une sélection filtrée de datasets | JWT requis |
| `GET` | `/api/v1/score/profiles` | `getScoringProfiles` | Profils de pondération prédéfinis + poids par défaut + liste des critères | JWT requis |

### Payload `POST /datasets/score`

```json
{
  "filters": { /* DatasetFilters optionnel */ },
  "weights": [
    { "criterion_name": "ethical_score", "weight": 0.6 },
    { "criterion_name": "technical_score", "weight": 0.4 }
  ]
}
```

Contraintes de validation (Pydantic, `extra="forbid"`) :
- `criterion_name` doit appartenir à la liste `CRITERIA` (12 valeurs) — erreur 422 sinon.
- `weight` est dans `[0, 1]`.

### Réponse `POST /datasets/score`

```json
{
  "results": [
    {
      "dataset": { /* DatasetCard */ },
      "score": 0.7234,
      "rank": 1,
      "criterion_scores": {
        "ethical_score": 0.7, "technical_score": 0.85, ...
      }
    }
  ],
  "effective_weights": { "ethical_score": 0.6, "technical_score": 0.4 },
  "criteria": ["ethical_score", "technical_score", ...]
}
```

---

## Formules élémentaires

### Score éthique

```
ethical_score = (nb critères True parmi 10) / 10
```

`None` et `False` comptent 0. Granularité de 10 % par critère (taxonomie Khelifi 2024).

### Score technique

Somme pondérée sur les seuls champs `!= None`, normalisée dynamiquement :

```
technical_score = Σ(score_composante_i × poids_i) / Σ(poids_i des composantes connues)
```

| Composante | Poids interne | Formule |
|------------|---------------|---------|
| Métadonnées dataset | 0.15 | `1.0 / 0.0` (booléen) |
| Documentation externe | 0.15 | `1.0 / 0.0` (booléen) |
| Valeurs manquantes | 0.20 | `1.0` si propre ; `(100 - pct) / 100` si % connu ; exclu si `has_missing=True` et `%=None` |
| Split train/test | 0.20 | `1.0 / 0.0` (booléen) |
| Nombre d'instances | 0.15 | `clamp((log10(n) - 2) / 3)` — 0 sous 100, 1 dès 100 000 |
| Nombre de features | 0.15 | Optimal 10–100 → 1 ; < 10 → `f/10` ; > 100 → `max(0.5, 1 - (f-100)/1000)` |

### Score de popularité

```
popularity_score = clamp(log10(citations) / 3)
```
0 si ≤ 0 citation, 1 dès 1 000 citations.

### Score final pondéré

```
score_final = Σ(score_i × poids_i) / Σ(poids_i)
```

Poids libres, non contraints à 1. Si `Σ poids = 0` ou liste vide → `DEFAULT_WEIGHTS` appliqués.

---

## Conventions pour valeurs inconnues

| Critère | Valeur par défaut | Justification |
|---------|------------------|---------------|
| `data_quality` | 0.5 | Évite de pénaliser les datasets sans information sur les valeurs manquantes (CDC §6.3) |
| `sample_balance` | 0.5 | Même convention — neutre en l'absence d'information |
| `year` | 0.0 (via `year or 2000`) | L'année 2000 donne un score 0 (oldest floor) |
| `instances_count` | 0.0 (via `or 0`) | Absence = 0 instance = score minimal |

---

## Patterns identifiés

- **Module pur (pure module pattern)** : `formulas.py` ne réalise aucun I/O ; il est appelable directement dans les tests unitaires sans mock.
- **Dataclass de découplage (DatasetFacts)** : le dataclass `frozen=True` isole les formules du modèle SQLAlchemy. Cela rend les formules testables indépendamment de la base.
- **Compute-on-read** : les scores ne sont jamais stockés en base. Chaque appel `POST /datasets/score` recalcule l'intégralité depuis les champs bruts du `Dataset`. Décision documentée dans RETRO-api-scoring-01.
- **Normalisation dynamique** : le score technique s'adapte automatiquement aux datasets partiellement renseignés sans nécessiter de règle de gestion supplémentaire.
- **Duplication contrôlée** : `ethical_score_expression()` dans `filters.py` est une réimplémentation SQL de la même formule, utilisée uniquement pour le filtrage en base (ne produit pas une valeur JSON). C'est la seule duplication admise — le commentaire dans `filters.py` l'explicite.

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/api/tests/unit/test_scoring_formulas.py` | Golden tests des 5 formules élémentaires + décomposition 12 critères + weighted_score + normalize_weights + intégrité des profils | Existant |
| `apps/api/tests/integration/test_scoring_api.py` | Classement et décomposition via HTTP, cohérence score carte = décomposition (P3), poids par défaut, rejet critère inconnu (422), profils endpoint, performance 100 datasets < 1 s (CDC §12.2) | Existant |

---

## Exigences de performance

CDC §12.2 : le scoring de 100 datasets avec décomposition complète doit s'exécuter en moins de 1 seconde (test `test_scoring_100_datasets_under_one_second`). La complexité est O(n) sur le nombre de datasets.
