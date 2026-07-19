# Spec Fonctionnelle — api/admin [DRAFT — a valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | api/admin           |
| Version    | 0.1.0               |
| Date       | 2026-07-19          |
| Auteur     | retro-documenter    |
| Statut     | DRAFT               |
| Source     | Retro-ingenierie    |

> **[DRAFT — a valider par le dev]** Cette spec a ete generee par retro-ingenierie
> a partir du code existant. Elle doit etre relue et validee par un developpeur
> qui connait le contexte metier.

---

## ADRs

| ADR | Titre | Categorie | Statut |
|-----|-------|-----------|--------|
| [RETRO-014](../../../adr/RETRO-014.md) | Role admin reverifiee en base sur chaque route | SECURITY | Documente (retro) |
| [RETRO-015](../../../adr/RETRO-015.md) | Templates ethiques stockes en base (pas en YAML) | DB-STRATEGY | Documente (retro) |

---

## Contexte et objectif

Le module admin expose une interface de supervision et de gouvernance destinee exclusivement
aux utilisateurs de role `admin`. Il centralise quatre domaines : la gestion des comptes
utilisateurs (roles, activation, credits), la gestion des templates ethiques par domaine
applicatif, la relance des analyses qualite de datasets, et la supervision des jobs
asynchrones. Un journal d'audit immutable retrace toutes les actions de mutation.

La contrainte architecturale principale (ARCH §7.2) est que chaque route reverifiee
le role `admin` directement en base de donnees — le claim JWT ne suffit pas pour les
actions privilegiees (voir RETRO-014).

---

## Regles metier (deduites du code)

1. **Reverification du role en base** : chaque route admin verifie en base que l'appelant
   a bien le role `admin` et un compte actif, independamment du claim JWT.

2. **Garde du dernier admin actif** : il est interdit de retrograder, desactiver ou
   supprimer un compte dont le role est `admin` si aucun autre admin actif n'existe en base.
   Le code leve `ConflictError / LAST_ADMIN` dans ce cas.

3. **Traçabilite obligatoire** : toute action de mutation (changement de role, changement
   d'activation, recharge de credits, suppression d'utilisateur, upsert/suppression de
   template, reanalyse de dataset) est enregistree dans `audit_events` dans la meme
   transaction que l'action elle-meme.

4. **Recharge de credits encadree** : le montant ajoute doit etre compris entre 1 et 1000
   inclus par operation. La valeur est ajoutee au solde existant (non remplacement).

5. **Cles de template validees** : les cles du dictionnaire `defaults` d'un template ethique
   doivent appartenir exclusivement aux 10 criteres de la taxonomie Khelifi 2024
   (`ETHICAL_CRITERIA`). Toute cle inconnue provoque une erreur de validation Pydantic.

6. **Normalisation du domaine** : le domaine d'un template est normalise en minuscules,
   debarrasse des espaces de bordure, et tronque a 50 caracteres avant upsert.

7. **Upsert de template** : si le domaine n'existe pas en base, un nouveau template est cree ;
   sinon il est mis a jour. La table suit le modele `UUIDPk + Timestamped` (dates auto).

8. **Pagination de la liste utilisateurs** : `page_size` accepte 5 a 100 (defaut 20),
   `page` commence a 1. La recherche textuelle (`q`) porte sur l'email et le pseudo
   (ILIKE insensible a la casse, max 200 caracteres).

9. **Suppression d'utilisateur** : la suppression d'un compte dont `created_by` reference
   des datasets rend ces datasets « systeme » (`created_by = NULL`) grace a la contrainte
   `ondelete="SET NULL"` sur la FK de la table `datasets`.

10. **Supervision des jobs** : la lecture des jobs est filtrable par `kind` et `status`,
    limitee a 200 entrees maximum, triee par date de creation descendante.

---

## Cas d'usage (deduits)

### CU-001 — Retrograder ou desactiver un utilisateur

L'admin recherche un utilisateur par email ou pseudo, selectionne l'action
(changement de role ou desactivation), valide. Le systeme verifie qu'il reste
au moins un autre admin actif si l'utilisateur cible est admin, applique la modification
et enregistre un evenement d'audit.

### CU-002 — Recharger les credits d'un compte

L'admin saisit un montant entre 1 et 1000, soumet le formulaire. Le solde du compte
est incremante (pas remplace). Un evenement `credits_granted` est trace.

### CU-003 — Creer ou mettre a jour un template ethique par domaine

L'admin selectionne un domaine (ex. `sante`, `finance`), coche les criteres ethiques
souhaites par defaut, soumet. Le template est cree ou mis a jour en base.
Les prochains imports de datasets avec ce domaine partageront ces valeurs par defaut.

### CU-004 — Relancer l'analyse qualite d'un dataset

L'admin selectionne un dataset et demande la reanalyse. Le cache existant est invalide
(`force=True`) et l'analyse est recalculee. Le score qualite mis a jour est retourne
immediatement (la reanalyse est synchrone dans cette route, code HTTP 202).

### CU-005 — Superviser les jobs asynchrones

L'admin filtre la liste des jobs par type (`training`, `explanation`, etc.) et/ou
statut (`pending`, `running`, `failed`, etc.) pour diagnostiquer des anomalies.
La vue est en lecture seule.

### CU-006 — Consulter le journal d'audit

L'admin lit les 100 derniers evenements traces (triee par date desc) :
qui a fait quoi, sur quelle entite, avec quels parametres.

---

## Dependencies

- `ibis.modules.auth.deps` : `CurrentAdminVerified` (reverification en base)
- `ibis.modules.auth.models` : `User`, `UserRole`, `ROLE_ORDER`
- `ibis.modules.auth.schemas` : `UserRead`
- `ibis.modules.admin.models` : `AuditEvent`
- `ibis.modules.datasets.models` : `Dataset`, `EthicalTemplate`
- `ibis.modules.datasets.ethics` : `ETHICAL_CRITERIA` (liste des 10 criteres)
- `ibis.modules.ml.quality` : `get_or_compute_quality` (import local dans la route reanalyze)
- `ibis.modules.jobs.models` : `Job`

---

## Zones d'incertitude

> Les points suivants n'ont pas pu etre determines par le code seul :

- **Reanalyse synchrone vs asynchrone** : la route `/datasets/{id}/reanalyze` retourne
  HTTP 202 (Accepted) mais l'appel a `get_or_compute_quality` semble synchrone dans le code.
  Il n'est pas clair si l'analyse est lancee en tache de fond ou executee dans le cycle de
  la requete. Necessite validation.

- **Commentaire `[NE PAS REPRODUIRE] S1/S2`** : le fichier routes.py mentionne des
  endpoints passes « S1/S2 » sans controle de role. La nature exacte de ces endpoints
  et le contexte de cette dette n'est pas reconstructible sans historique git.

- **Interface web admin** : le catalogue `web/admin` (feature 24 du discovery) affiche
  les memes entites. Il n'a pas ete analyse dans cette session — les flux exacts (pagination
  web, gestion des erreurs LAST_ADMIN en UI, etc.) sont a documenter separement.

- **Application des templates a l'import** : le service `datasets.service.create_dataset()`
  lit `EthicalTemplate` par domaine lors de l'import. La logique precise de selection du
  domaine (un dataset peut avoir plusieurs domaines en ARRAY) n'est pas documentee ici.
