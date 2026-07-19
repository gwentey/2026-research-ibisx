# RETRO-018 — Taxonomie éthique des datasets : 10 critères Khelifi 2024

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documenté (rétro)   |
| Date       | 2026-07-19          |
| Source     | Rétro-ingénierie    |
| Features   | web/datasets, api/datasets |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DATA-MODEL |
| Q1 — Coût de revert > 1j ? | OUI — modifier la liste des critères impose une migration de schéma BDD (colonne `ethical_criteria` JSON + recalcul des scores), une mise à jour de l'API (`ethics.py`, schémas Pydantic), la mise à jour de `ETHICAL_KEYS` dans `constants.ts`, et la mise à jour des labels i18n FR/EN dans les deux apps. Estimation : plusieurs jours de travail transverse. |
| Q2 — Non-déductible du code ? | OUI — la liste exacte des 10 clés (`informed_consent`, `transparency`, `user_control`, `equity_non_discrimination`, `security_measures_in_place`, `data_quality_documented`, `anonymization_applied`, `record_keeping_policy_exists`, `purpose_limitation_respected`, `accountability_defined`) découle d'un choix de taxonomie académique (Khelifi 2024) qui ne se voit ni dans `package.json` ni dans aucune config. |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — impacte `api/datasets` (profiling, calcul du score éthique, modèles SQLAlchemy, schémas Pydantic) et `web/datasets` (grille d'affichage, filtres, formulaire de métadonnées). |
| Q4 — Casse un invariant si ignoré ? | OUI — un dev ajoutant un critère côté backend sans mettre à jour `ETHICAL_KEYS` produirait une grille UI incomplète (critère absent) et un score éthique calculé sur un périmètre différent de ce qu'affiche l'interface, sans avertissement. |

> ✅ Validé contre la politique `.claude/rules/06-adr-policy.md`.

---

## Contexte

La plateforme IBIS-X a une vocation pédagogique sur l'IA responsable. Il était nécessaire de choisir un référentiel éthique pour qualifier les datasets. La taxonomie Khelifi 2024 (documentée dans `apps/api/ibis/modules/datasets/ethics.py`) a été retenue comme référence académique reconnue, couvrant les dimensions clés de l'éthique des données : consentement, transparence, contrôle, équité, sécurité, qualité, anonymisation, conservation, limitation des finalités et responsabilité.

## Décision identifiée

10 critères éthiques canoniques (et uniquement ces 10) sont définis comme la liste normative de qualification éthique des datasets :

```
informed_consent
transparency
user_control
equity_non_discrimination
security_measures_in_place
data_quality_documented
anonymization_applied
record_keeping_policy_exists
purpose_limitation_respected
accountability_defined
```

Ces critères sont déclarés dans deux endroits synchronisés :
- **Backend** : `apps/api/ibis/modules/datasets/ethics.py` (source de vérité des valeurs et du calcul)
- **Frontend** : `apps/web/lib/datasets/constants.ts` (`ETHICAL_KEYS` — miroir pour l'itération UI)

Chaque critère a une valeur tristate : `true` (présent et vérifié), `false` (absent ou non conforme), `null` (information non disponible).

Le score éthique global est calculé exclusivement côté backend (nombre de critères `true` / nombre total de critères ayant une valeur non-null, normalisé sur 100).

## Conséquences observées

### Positives
- Cohérence affichage/calcul garantie : `ETHICAL_KEYS` itère exactement les mêmes clés que celles calculées par le backend
- Filtrage précis : chaque critère individuel est filtrable dans le panneau de filtres du catalogue
- Pédagogie explicite : la grille affiche les 10 critères avec leur état, éducant l'utilisateur à ce que signifie un dataset "éthique"
- Score comparable entre datasets : même base de calcul pour tous

### Négatives / Dette
- **Couplage fort backend/frontend** : toute évolution de la liste nécessite une synchronisation manuelle de `ETHICAL_KEYS`. Il n'existe pas de mécanisme de validation automatique (la CI vérifie le contrat OpenAPI mais pas la liste des critères éthiques).
- **Taxonomie figée** : l'adoption de Khelifi 2024 rend difficile l'ajout ad hoc d'un critère hors taxonomie sans casser la cohérence de l'affichage.

## Recommandation

**Garder** cette décision. La taxonomie Khelifi 2024 est académiquement fondée et les 10 critères couvrent bien les dimensions clés.

Si la liste évolue un jour, il est recommandé d'ajouter un test de cohérence en CI qui compare `ETHICAL_KEYS` (frontend) aux critères retournés par l'API (`GET /datasets/facets` ou un endpoint dédié) pour détecter toute désynchronisation.
