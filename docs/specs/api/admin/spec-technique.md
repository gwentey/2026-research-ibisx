# Spec Technique — api/admin

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | api/admin           |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Retro-ingenierie    |

---

## Architecture du module

Le module ne contient pas de service dedie : toute la logique metier est inline dans
`routes.py`, avec un helper `audit()` local. Ce choix correspond a un module de faible
complexite algorithmique (principalement des lectures/ecritures SQL directes).

La dependance cle est `CurrentAdminVerified` (definie dans `auth/deps.py`), qui combine
deux verifications en cascade :

1. Decodage du JWT et controle du claim `role` (via `ROLE_ORDER` — rejette si < admin)
2. Chargement de la ligne `User` en base et controle que `user.role == admin`
   ET `user.is_active == True` (rejet `403 FORBIDDEN` sinon)

La dualite JWT + base est documentee dans RETRO-014 et dans ADR-003.

---

## Fichiers impactes

| Fichier | Role | Lignes |
|---------|------|--------|
| `apps/api/ibis/modules/admin/routes.py` | Router FastAPI — toutes les routes + helper audit() | ~286 |
| `apps/api/ibis/modules/admin/models.py` | Modele SQLAlchemy `AuditEvent` | ~23 |
| `apps/api/ibis/modules/auth/deps.py` | `CurrentAdminVerified` (dependance critique partagee) | ~88 |
| `apps/api/ibis/modules/datasets/models.py` | `EthicalTemplate` (gere par admin, lu par datasets) | ~142 |
| `apps/api/ibis/modules/datasets/ethics.py` | `ETHICAL_CRITERIA` (whitelist des 10 cles valides) | ~28 |
| `apps/api/ibis/modules/jobs/models.py` | `Job` (lecture seule par admin) | ~58 |

---

## Schema BDD

### Table `audit_events`

| Colonne     | Type              | Contrainte          | Description |
|-------------|-------------------|---------------------|-------------|
| `id`        | UUID (PK)         | NOT NULL            | Herite de `UUIDPk` |
| `user_id`   | UUID              | NOT NULL, INDEX     | ID de l'admin acteur |
| `action`    | VARCHAR(50)       | NOT NULL            | `role_changed`, `active_changed`, `credits_granted`, `user_deleted`, `template_upserted`, `template_deleted`, `dataset_reanalyzed` |
| `entity`    | VARCHAR(30)       | NOT NULL            | `user`, `ethical_template`, `dataset` |
| `entity_id` | VARCHAR(64)       | NOT NULL            | UUID ou slug de l'entite ciblee |
| `meta`      | JSONB             | default `{}`        | Parametres contextuels (from_, to, amount, email, etc.) |
| `ts`        | TIMESTAMP         | server_default NOW(), INDEX | Horodatage serveur |

Note : pas de FK sur `user_id` — le journal reste meme si l'admin est supprime.

### Table `ethical_templates`

| Colonne      | Type      | Contrainte          | Description |
|--------------|-----------|---------------------|-------------|
| `id`         | UUID (PK) | NOT NULL            | Herite de `UUIDPk` |
| `domain`     | VARCHAR(50) | UNIQUE, NOT NULL  | Cle de domaine (normalise minuscules) |
| `defaults`   | JSONB     | default `{}`        | Dictionnaire `{critere: bool\|null}` |
| `updated_by` | UUID      | NULLABLE            | ID de l'admin ayant fait le dernier upsert |
| `created_at` | TIMESTAMP | server_default      | Herite de `Timestamped` |
| `updated_at` | TIMESTAMP | auto-update         | Herite de `Timestamped` |

---

## API / Endpoints

| Methode  | Route                                    | Description                              | Auth              |
|----------|------------------------------------------|------------------------------------------|-------------------|
| `GET`    | `/admin/users`                           | Liste paginee des utilisateurs           | CurrentAdminVerified |
| `PATCH`  | `/admin/users/{user_id}`                 | Modifier role / activation / credits     | CurrentAdminVerified |
| `DELETE` | `/admin/users/{user_id}`                 | Supprimer un compte                      | CurrentAdminVerified |
| `GET`    | `/admin/ethical-templates`               | Lister tous les templates                | CurrentAdminVerified |
| `PUT`    | `/admin/ethical-templates/{domain}`      | Creer ou remplacer un template           | CurrentAdminVerified |
| `DELETE` | `/admin/ethical-templates/{domain}`      | Supprimer un template                    | CurrentAdminVerified |
| `POST`   | `/admin/datasets/{dataset_id}/reanalyze` | Relancer l'analyse qualite (cache force) | CurrentAdminVerified |
| `GET`    | `/admin/jobs`                            | Lister les jobs (filtres kind/status)    | CurrentAdminVerified |
| `GET`    | `/admin/audit`                           | Lister les 100 derniers evenements audit | CurrentAdminVerified |

Tous les payloads d'ecriture utilisent `model_config = ConfigDict(extra="forbid")` —
toute cle inconnue provoque une erreur 422.

---

## Patterns identifies

### Garde du dernier admin actif

```python
def _other_active_admins(db, user_id) -> int:
    # COUNT(User) WHERE role=admin AND is_active=True AND id != user_id
```

Appelee avant toute operation de demotion, desactivation ou suppression d'un admin.
Leve `ConflictError / LAST_ADMIN` si le compte cible est le seul admin restant.

### Helper audit() — transaction-bound

```python
def audit(db, admin, action, entity, entity_id, **meta) -> None:
    db.add(AuditEvent(...))
    # PAS de db.commit() ici — commite avec la transaction de la route appelante
```

L'evenement d'audit est ajoute a la session SQLAlchemy dans la meme transaction
que la modification. Si la transaction echoue (rollback), l'evenement est aussi annule.

### Schemas Pydantic locaux (pas de service)

Les schemas `AdminUserUpdate`, `UserPage`, `TemplateUpsert`, `TemplateRead`, `JobRow`,
`AuditRow` sont tous definis en ligne dans `routes.py`. Il n'y a pas de fichier
`schemas.py` dedie au module admin.

### Validation des cles de template

```python
@field_validator("defaults")
@classmethod
def only_known_criteria(cls, value):
    unknown = set(value) - set(ETHICAL_CRITERIA)
    if unknown:
        raise ValueError(f"Criteres inconnus : {sorted(unknown)}")
    return value
```

La whitelist est importee depuis `datasets.ethics.ETHICAL_CRITERIA` — source unique.

---

## Decisions techniques non-ADR

### Pas de service dedie (architecture plate)

Contrairement aux modules `datasets` ou `experiments`, le module admin n'a pas de
fichier `service.py`. La logique SQL est directement dans les fonctions de route.
Justification probable : faible complexite (CRUD direct), pas de logique metier partagee
entre routes. A reevaluer si le module grandit.

### Audit sans FK sur user_id

La colonne `audit_events.user_id` n'a pas de cle etrangere sur `users.id`.
Cela garantit que le journal est immutable meme si l'admin acteur est supprime.
Contrepartie : aucune integrite referentielle — un `user_id` orphelin est valide en base.

### Garde du dernier admin : vérification a la lecture, pas par contrainte BDD

Le garde est implemente par une requete COUNT dans le code Python, pas par une
contrainte `CHECK` ou un trigger PostgreSQL. Cela signifie que des operations directes
en base (hors API) pourraient laisser le systeme sans admin.

### Reanalyse de dataset synchrone avec HTTP 202

La route `POST /datasets/{id}/reanalyze` retourne HTTP 202 (Accepted, semantique
asynchrone) mais appelle `get_or_compute_quality(force=True)` de facon synchrone dans
le cycle de la requete. Le code HTTP 202 suggere que cette route etait peut-etre
prevue pour devenir asynchrone (lancement de job Celery).

### Templates ethiques — DB-STRATEGY documente dans RETRO-015

Voir [RETRO-015](../../../adr/RETRO-015.md) : les templates ethiques
sont l'autorite en base, pas dans un fichier YAML de configuration.

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|----------------|--------|
| Aucun trouve pour `modules/admin/` | — | Absent |

> Note : Les tests de la feature admin n'ont pas ete identifies lors de la retro.
> La couverture des routes admin (garde LAST_ADMIN, audit events, validation templates)
> est a creer.
