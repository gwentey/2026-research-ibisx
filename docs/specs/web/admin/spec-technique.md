# Spec Technique — web/admin

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | web/admin           |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie    |

---

## Architecture du module

Le module est composé d'un layout partagé et de quatre pages React indépendantes, toutes marquées `"use client"`. Chaque page gère son propre état local (useState), effectue ses appels API via le client TypeScript généré, et affiche les données dans une table dense avec pagination ou rafraîchissement automatique.

Le layout (`admin/layout.tsx`) joue le rôle de garde UX : il lit le rôle de l'utilisateur depuis le store Zustand (`useAuthStore`) et redirige vers `/dashboard` si le rôle n'est pas `admin`. Ce contrôle est un complément UX ; la véritable barrière de sécurité est côté backend (`CurrentAdminVerified` dans `deps.py` qui re-vérifie le rôle en base à chaque requête — voir `ADR-003`).

Les quatre composants atomiques du dossier `components/ibis/admin/` sont partagés par toutes les pages admin :
- `AdminPageHeader` — en-tête de section (icône, titre, compteur)
- `AdminSearchInput` — barre de recherche avec icône
- `AdminEmptyState` — état vide tokenisé (via le primitif `Empty` du kit)
- `RowActionsMenu` — menu dropdown "…" par ligne (DropdownMenu)

La navigation entre sections est assurée par `ADMIN_NAV` (tableau de 4 entrées dans `nav-config.ts`), rendu à la fois dans le layout admin (onglets tabulaires) et dans la sidebar principale (groupe conditionnel visible uniquement si `user.role === "admin"`).

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/web/app/(app)/admin/layout.tsx` | Garde UX + navigation à onglets + en-tête back-office | ~72 |
| `apps/web/app/(app)/admin/users/page.tsx` | Tableau utilisateurs : liste, recherche, pagination, rôle, activation, crédits, suppression | ~326 |
| `apps/web/app/(app)/admin/datasets/page.tsx` | Tableau datasets : liste, recherche, pagination, ré-analyse, suppression | ~248 |
| `apps/web/app/(app)/admin/ethical-templates/page.tsx` | CRUD templates éthiques par domaine, dialogue éditeur tristate | ~275 |
| `apps/web/app/(app)/admin/jobs/page.tsx` | Supervision jobs : filtre kind/status, santé workers, auto-refresh 5s | ~191 |
| `apps/web/components/ibis/admin/admin-page-header.tsx` | Composant partagé : en-tête de section (icône, titre, compteur, zone actions) | ~44 |
| `apps/web/components/ibis/admin/admin-empty-state.tsx` | Composant partagé : état vide avec icône et description optionnelle | ~40 |
| `apps/web/components/ibis/admin/admin-search-input.tsx` | Composant partagé : input avec icône SearchIcon | ~29 |
| `apps/web/components/ibis/admin/row-actions-menu.tsx` | Composant partagé : menu dropdown « … » par ligne de table | ~69 |
| `apps/web/components/ibis/layout/nav-config.ts` | Définition de `ADMIN_NAV` (4 entrées) et `AdminNavItem` | ~55 |
| `apps/web/components/ibis/layout/ibis-sidebar.tsx` | Sidebar : groupe admin conditionnel (visible si `isAdmin`) | (partagé) |
| `apps/web/messages/fr.json` (clé `admin.*`) | Traductions FR pour toutes les sections admin | — |
| `apps/web/messages/en.json` (clé `admin.*`) | Traductions EN pour toutes les sections admin | — |

---

## Schéma BDD (côté API, consommé via client généré)

La table `audit_events` est la seule table spécifique au module admin :

```
audit_events
├── id          UUID PK
├── user_id     UUID (l'admin acteur, indexé)
├── action      VARCHAR(50) — role_changed | active_changed | credits_granted | user_deleted | template_upserted | template_deleted | dataset_reanalyzed
├── entity      VARCHAR(30) — user | dataset | ethical_template
├── entity_id   VARCHAR(64)
├── meta        JSONB (contexte : from_, to, amount, email…)
└── ts          TIMESTAMP (server_default=now(), indexé)
```

La table `ethical_templates` est lue et écrite via les routes `/admin/ethical-templates/*` :

```
ethical_templates
├── id          UUID PK
├── domain      VARCHAR(50) UNIQUE (normalisé lowercase)
├── defaults    JSONB (dict[str, bool | None] — les 10 critères Khelifi 2024)
├── updated_by  UUID (l'admin qui a fait le dernier upsert)
└── updated_at  TIMESTAMP (auto-updated)
```

Les tables `users` et `jobs` sont lues/modifiées mais appartiennent aux modules `api/auth` et `api/jobs`.

---

## API / Endpoints (client TypeScript généré)

| Méthode | Route | Operation ID | Description | Auth |
|---------|-------|--------------|-------------|------|
| GET | `/admin/users` | `adminListUsers` | Liste paginée avec recherche (q, page, page_size) | Admin (DB re-verify) |
| PATCH | `/admin/users/{user_id}` | `adminUpdateUser` | Rôle, activation, add_credits | Admin (DB re-verify) |
| DELETE | `/admin/users/{user_id}` | `adminDeleteUser` | Suppression compte + cascade | Admin (DB re-verify) |
| GET | `/datasets` | `listDatasets` | Catalogue complet (sort_by=created, tous les datasets) | Authentifié |
| POST | `/admin/datasets/{dataset_id}/reanalyze` | `adminReanalyzeDataset` | Force recalcul qualité (bypass cache 7j) | Admin (DB re-verify) |
| DELETE | `/datasets/{dataset_id}` | `deleteDataset` | Suppression dataset + fichiers | Admin ou propriétaire |
| GET | `/admin/ethical-templates` | `adminListTemplates` | Liste tous les templates | Admin (DB re-verify) |
| PUT | `/admin/ethical-templates/{domain}` | `adminUpsertTemplate` | Créer ou mettre à jour un template | Admin (DB re-verify) |
| DELETE | `/admin/ethical-templates/{domain}` | `adminDeleteTemplate` | Supprimer un template | Admin (DB re-verify) |
| GET | `/admin/jobs` | `adminListJobs` | Jobs filtrables (kind, status, limit=100) | Admin (DB re-verify) |
| GET | `/worker/health` | `getWorkerHealth` | Noms des workers Celery actifs | Admin (DB re-verify) |
| GET | `/admin/audit` | `adminListAudit` | Événements d'audit (limit=100) | Admin (DB re-verify) — *non consommé par le front actuellement* |

---

## Patterns identifiés

- **Debounce sur la recherche** : les pages "users" et "datasets" utilisent un `setTimeout` de 250 ms avant de déclencher l'appel API, évitant une requête par frappe.
- **Reset de page à la recherche** : chaque modification de la recherche remet la pagination à la page 1.
- **Chargement optimiste non utilisé** : les mutations attendent la réponse backend avant de rafraîchir la liste (`void load()` post-mutation).
- **État de chargement différencié** : `null` = "pas encore chargé" (Skeleton), tableau vide = "aucun résultat" (EmptyState). Pas d'état de loading séparé.
- **Actions contextuelles par ligne** : toutes les pages utilisent `RowActionsMenu` avec un tableau `RowAction[]` construit dynamiquement (le label activation/désactivation change selon l'état de la ligne).
- **Confirmations destructives** : toutes les suppressions sont précédées d'une `AlertDialog` Radix UI. Les dialogues de formulaire (crédits, template éthique) utilisent `Dialog`.
- **Supervision vivante** : la page jobs est la seule à utiliser `setInterval` (5 s). Référencée dans le commentaire source comme « repli polling (CDC §10) ».
- **Chargement parallèle** : la page jobs utilise `Promise.all` pour charger simultanément les jobs et la santé des workers.
- **Tristate en frontend seulement** : `"unset"` est un état purement UI. À la sauvegarde, les clés `unset` sont filtrées ; seules les clés `true`/`false` sont envoyées au backend.
- **Gestion d'erreur structurée** : la page users extrait le code d'erreur via `errorCodeOf(error)` pour différencier `LAST_ADMIN` des autres erreurs et afficher un message adapté.

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| — | Tests unitaires Vitest pour les composants admin | Absent |
| — | Tests e2e Playwright pour le parcours admin | Absent |

> Aucun test spécifique à la surface `web/admin` n'a été identifié dans le codebase. La sécurité du back-office est couverte par les tests d'intégration côté API (pytest, matrice RBAC référencée dans ADR-003).

---

## Décisions techniques documentées en spec-technique (non promues en ADR)

### Audit trail sur toutes les mutations admin

Chaque route de mutation dans `apps/api/ibis/modules/admin/routes.py` appelle la fonction locale `audit(db, admin, action, entity, entity_id, **meta)` avant le `db.commit()`. Cette fonction insère un enregistrement dans `audit_events` transactionellement avec la mutation principale. Le scope est confiné au module `api/admin` (Q3 = NON — un seul module écrit dans `audit_events`).

### Garde du dernier administrateur actif

La fonction `_other_active_admins(db, user_id)` est appelée avant toute dégradation, désactivation ou suppression d'un compte administrateur. Elle compte les autres admins actifs en base. Si le résultat est 0, l'opération est refusée avec `ConflictError("LAST_ADMIN")`. Ce garde est implémenté dans le seul module `api/admin` (Q3 = NON).

### Supervision live par polling côté client (5 s)

La page jobs implémente un rafraîchissement par `setInterval` de 5 secondes plutôt que d'utiliser le mécanisme SSE exposé par `api/jobs`. Ce choix est cohérent avec la destination (supervision admin, pas une UI utilisateur temps réel) et avec la décision SSE documentée dans ADR-007 (SSE est réservé au suivi de progression par l'utilisateur propriétaire du job).
