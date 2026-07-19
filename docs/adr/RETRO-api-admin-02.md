# RETRO-api-admin-02 — Templates ethiques stockes en base (source autoritaire)

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documente (retro)   |
| Date       | 2026-07-19          |
| Source     | Retro-ingenierie    |
| Features   | api/admin, api/datasets |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Categorie | DB-STRATEGY |
| Q1 — Cout de revert > 1j ? | OUI — Migrer vers YAML necessite : supprimer la table `ethical_templates` (migration Alembic), modifier `datasets/service.py` (lecture du fichier YAML au lieu de la requete BDD), supprimer les routes CRUD admin (`PUT/DELETE /ethical-templates/{domain}`), modifier `web/admin` (UI de gestion des templates), et mettre a jour les seeds. C'est un changement transverse sur au moins 3 modules. |
| Q2 — Non-deductible du code ? | OUI — `pyproject.toml` ne revele pas le choix de stocker les templates en base plutot qu'en YAML ou dans un enum Python. Le commentaire dans `models.py` (`en base, PAS en YAML (v1)`) indique que l'alternative YAML a ete explicitement consideree et ecartee. |
| Q3 — Impact transverse (>= 2 specs) ? | OUI — `api/admin` gere les templates (CRUD complet). `api/datasets` les consomme dans `service.create_dataset(apply_ethical_template=True)` — la fonction charge le template par domaine en base a chaque import. `web/admin` expose l'interface de gestion. |
| Q4 — Casse un invariant si ignore ? | OUI — Si un developpeur ajoute des valeurs ethiques par defaut dans un fichier YAML (au lieu de la base), ces valeurs ne seraient pas appliquees lors des imports (l'importer interroge uniquement la BDD). Le catalogue serait en desaccord avec les defaults actifs, sans message d'erreur. |

> Valide contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

Le systeme supporte des valeurs ethiques par defaut par domaine applicatif
(sante, finance, education, etc.), issues de la taxonomie Khelifi 2024 (10 criteres).
Ces defaults sont appliques automatiquement lors de l'import de nouveaux datasets
dont le domaine correspond.

Deux alternatives principales existaient :
- **YAML statique** : fichier versionne dans le depot, modifiable uniquement par deploy.
- **Base de donnees** : editable en production via l'interface admin, sans redeploy.

Le commentaire dans `datasets/models.py` (`en base, PAS en YAML (v1)`) documente
explicitement le choix retenu.

## Decision identifiee

La table `ethical_templates` (PostgreSQL) est la source autoritaire unique pour les
valeurs ethiques par domaine :

- **Ecriture** : exclusivement via les routes admin (`PUT /admin/ethical-templates/{domain}`,
  `DELETE /admin/ethical-templates/{domain}`), tracee dans `audit_events`.
- **Lecture** : `datasets/service.py` charge le template en base lors de chaque creation
  de dataset avec `apply_ethical_template=True`.
- **Validation** : les cles du dictionnaire `defaults` sont validees contre `ETHICAL_CRITERIA`
  par un `@field_validator` Pydantic — impossible de stocker des criteres inconnus.
- **Format** : `JSONB` — flexible, sans migration si les criteres evoluent dans les limites
  de la whitelist Python.

## Consequences observees

### Positives

- Les templates sont modifiables en production sans redeploy ni intervention technique.
- L'historique des modifications est trace dans `audit_events`.
- La validation Pydantic garantit que seuls les 10 criteres connus peuvent etre stockes.
- Le JSONB permet d'ajouter de nouveaux criteres sans ALTER TABLE (seul `ETHICAL_CRITERIA`
  et le validator doivent etre mis a jour).

### Negatives / Dette

- Les templates ne sont pas versiones dans git — un changement de valeur par defaut en
  production est invisible dans le code source.
- Les seeds (`datasets.yaml`) importent avec `apply_ethical_template=True` mais les
  templates doivent exister en base avant l'import pour etre appliques. L'ordre d'insertion
  (seed templates puis seed datasets) est une contrainte operationnelle non documentee
  explicitement dans les fichiers de configuration.
- Aucun mecanisme de fallback si aucun template ne correspond au domaine du dataset importe.

## Recommandation

**Garder.** La flexibilite operationnelle justifie le choix. Documenter l'ordre des seeds
et envisager un fallback explicite (template `default` en base) pour les domaines non
couverts.
