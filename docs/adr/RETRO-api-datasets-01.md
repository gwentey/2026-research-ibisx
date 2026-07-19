# RETRO-api-datasets-01 — Taxonomie Khelifi 2024 : 10 critères éthiques tristate

| Champ      | Valeur                  |
|------------|-------------------------|
| Statut     | Documenté (rétro)       |
| Date       | 2026-07-19              |
| Source     | Rétro-ingénierie        |
| Features   | api/datasets, api/admin |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DATA-MODEL |
| Q1 — Coût de revert > 1j ? | OUI — changer de taxonomie (ex. passer à 12 critères ou remplacer un critère) impose une migration de schéma (10 colonnes Boolean sur `datasets`), une mise à jour du dénominateur dans `ethics.ethical_score()`, du filtre SQL `ethical_score_expression()` dans `filters.py`, des schémas Pydantic `DatasetMetadataInput`/`DatasetDetail`, de l'affichage front (grille 10 cases), et des templates `ethical_templates`. Au minimum 4 modules touchés. |
| Q2 — Non-déductible du code ? | OUI — la taxonomie Khelifi 2024 et la granularité de 10 % par critère n'apparaissent pas dans `pyproject.toml` ni dans les configs Docker. Le choix tristate (`None` = non évalué ≠ `False` = évalué absent) est une décision sémantique qui ne se voit qu'en lisant le commentaire source `ethics.py`. |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — `api/datasets` (modèle, service, filtres, schemas), `api/scoring` (score composite utilise aussi les critères éthiques comme dimension), `api/admin` (validation, templates éthiques par domaine), `web/datasets` (grille affichage 10 cases). |
| Q4 — Casse un invariant si ignoré ? | OUI — si un dev ajoute un 11ème critère en colonne sans mettre à jour `ETHICAL_CRITERIA` dans `ethics.py`, le dénominateur reste 10 et le score dépasse 1.0 silencieusement. Si un dev normalise les `None` en `False` pour "simplifier", les datasets non évalués apparaissent comme non-conformes dans les filtres éthiques. |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

---

## Contexte

La plateforme IBIS-X a pour but de sensibiliser à l'éthique des données en ML. Le choix d'une taxonomie académique reconnue (Khelifi 2024, mentionné dans le commentaire `ethics.py`) pour structurer l'évaluation éthique des datasets a probablement été motivé par la volonté de crédibilité scientifique et de comparabilité avec d'autres travaux de recherche.

Le tristate (`None` / `False` / `True`) a été retenu pour distinguer un critère non encore évalué (information manquante) d'un critère explicitement absent (information connue, défavorable). Cette distinction est perdue si on réduit à un booléen.

## Décision identifiée

Dix critères éthiques fixes (liste dans `ethics.ETHICAL_CRITERIA`) sont définis comme source unique de vérité. Chaque critère est stocké comme colonne `BOOLEAN` nullable sur la table `datasets`. La valeur `NULL` signifie "non évalué", `False` "évalué absent", `True` "présent". Le score éthique est le ratio `(critères True) / 10`, calculé à la lecture. Le filtre SQL `ethical_score_min` réexprime le même calcul côté PostgreSQL.

```python
# ethics.py — source unique
ETHICAL_CRITERIA: tuple[str, ...] = (
    "informed_consent", "transparency", "user_control",
    "equity_non_discrimination", "security_measures_in_place",
    "data_quality_documented", "anonymization_applied",
    "record_keeping_policy_exists", "purpose_limitation_respected",
    "accountability_defined",
)

def ethical_score(values: dict[str, bool | None]) -> float:
    return sum(1 for name in ETHICAL_CRITERIA if values.get(name) is True) / len(ETHICAL_CRITERIA)
```

## Conséquences observées

### Positives
- Source unique : `ETHICAL_CRITERIA` est importé dans `models.py`, `filters.py`, `service.py` et `schemas.py` — une seule modification propage partout.
- Granularité de 10 % par critère : le score est interprétable et discutable.
- Le tristate visible dans la réponse API (`ethical_criteria` dans `DatasetDetail`) permet au front d'afficher l'état précis de chaque critère.

### Négatives / Dette
- Le dénominateur `10` est implicitement encodé dans la longueur de `ETHICAL_CRITERIA` — risque si la liste grandit sans mise à jour des tests.
- L'absence de tests unitaires sur `ethics.py` laisse le comportement tristate non-couvert.
- La référence bibliographique exacte (Khelifi 2024) n'est pas documentée dans le code — impossible de vérifier si les 10 critères correspondent fidèlement à la source.

## Recommandation

Garder. La taxonomie est cohérente et la source unique `ethics.ETHICAL_CRITERIA` est bien appliquée. Ajouter des tests unitaires pour `ethical_score()` couvrant les 3 états (None, False, True) et le cas de liste vide.
