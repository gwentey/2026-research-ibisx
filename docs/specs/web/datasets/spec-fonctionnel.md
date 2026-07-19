# Spec Fonctionnelle — web/datasets [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | web/datasets        |
| Version    | 0.1.0               |
| Date       | 2026-07-19          |
| Auteur     | retro-documenter    |
| Statut     | DRAFT               |
| Source     | Rétro-ingénierie    |

> **[DRAFT — à valider par le dev]** Cette spec a été générée par rétro-ingénierie
> à partir du code existant. Elle doit être relue et validée par un développeur
> qui connaît le contexte métier.

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [RETRO-018](../../../adr/RETRO-018.md) | Taxonomie éthique des datasets : 10 critères Khelifi 2024 | Documenté (rétro) |
| [RETRO-019](../../../adr/RETRO-019.md) | Téléchargement authentifié via API : jamais d'URL de stockage directe | Documenté (rétro) |

> *Table auto-générée par adr-linker. Ne pas éditer manuellement.*

---

## Contexte et objectif

Le module `web/datasets` est la surface frontend du catalogue de datasets de la plateforme IBIS-X. Il permet aux utilisateurs (chercheurs, étudiants, professionnels) de découvrir, filtrer, comparer et évaluer des datasets à des fins d'expérimentation ML. Il couvre également l'upload de nouveaux datasets (réservé aux contributeurs et admins) et le scoring de pertinence pondéré.

L'objectif pédagogique est central : chaque dataset est enrichi d'un score éthique visible, d'une grille de critères éthiques expliquée, et d'un guide IA généré à la demande — des éléments destinés à apprendre aux utilisateurs à évaluer la qualité et l'adéquation d'un dataset avant de l'utiliser en ML.

---

## Règles métier (déduites du code)

1. **Accès upload restreint** : seuls les utilisateurs avec le rôle `contributor` ou `admin` voient le bouton "Importer un dataset" et peuvent accéder à `/datasets/upload`.

2. **Accès modification restreint** : seuls l'admin et le créateur du dataset (`created_by === user.id`) voient le bouton "Modifier" sur la fiche détail.

3. **Score éthique obligatoirement affiché** : chaque dataset dans le catalogue et sur la fiche détail affiche son score éthique (0–100 %). La coloration suit une règle fixe : ≥ 80 % vert, ≥ 60 % lime, ≥ 40 % ambre, < 40 % rouge.

4. **Critères éthiques tristate** : chaque critère éthique parmi les 10 canoniques peut valoir `true` (présent), `false` (absent) ou `null` (inconnu). L'UI affiche les trois états de façon distincte (coche / croix / tiret).

5. **Recherche textuelle debouncée** : la recherche dans le catalogue n'est déclenchée qu'après 300 ms d'inactivité de frappe pour éviter les appels excessifs à l'API.

6. **Remise à la page 1 sur tout changement de filtre** : tout changement de filtre, de recherche, de tri ou de taille de page remet automatiquement la pagination à la page 1.

7. **Compteur de résultats en temps réel dans le panneau de filtres** : lors de l'ouverture du panneau de filtres, chaque modification de filtre déclenche un appel API debouncé (300 ms) pour afficher le nombre de résultats qu'appliquer ces filtres produirait.

8. **Guide IA avec suivi SSE et fallback** : la génération du guide IA suit la progression via Server-Sent Events. Le guide peut être en mode "fallback" (généré de façon déterministe sans LLM) ou avec un modèle LLM — les deux cas sont distingués visuellement par un badge.

9. **Analyse avant upload** : avant de pouvoir renseigner les métadonnées, l'utilisateur doit analyser les fichiers déposés. L'analyse retourne un profil de chaque fichier (nombre de lignes, colonnes, % de valeurs manquantes, détection PII, type des colonnes) et des suggestions de nom/domaine/tâche.

10. **Téléchargement toujours authentifié** : les fichiers de dataset ne sont jamais exposés via URL directe de stockage. Tout téléchargement passe par le client API généré avec le token d'accès. Le fichier téléchargé est systématiquement nommé en `.parquet` (indépendamment du format d'origine).

11. **Scoring pondéré avec profils prédéfinis** : la page de scoring permet de configurer librement les poids de chaque critère (0–1 par slider). Des profils prédéfinis (Équilibré, Haute précision, Rapide, etc.) permettent de réinitialiser les pondérations rapidement. Le re-scoring se déclenche automatiquement après 400 ms d'inactivité sur les sliders.

12. **Transmission de la sélection de filtres au scorer** : quand l'utilisateur clique "Scorer cette sélection" depuis le catalogue, les filtres actifs sont transmis via `sessionStorage` (clé `ibis:score:filters`) à la page de scoring qui les applique pour scorer uniquement les datasets correspondants.

13. **Complétion de métadonnées avec taux de remplissage** : la page `/datasets/[id]/complete` affiche un anneau de progression global et un tableau de bord par section (Général, Technique, Éthique) avec le nombre de champs remplis et les champs manquants identifiés.

---

## Cas d'usage (déduits)

### CU-001 — Parcourir le catalogue et filtrer les datasets

L'utilisateur arrive sur `/datasets`. Il voit une grille ou un tableau de datasets. Il peut :
- Taper un terme dans la barre de recherche (filtre textuel debouncé 300 ms)
- Ouvrir le panneau de filtres (slide-in) pour filtrer par domaine, tâche, plages de valeurs (instances, features, année, citations), score éthique minimum, qualité (split, anonymisé, temporel, public), représentativité, valeurs manquantes, et critères éthiques individuels
- Changer le tri (nom, année, instances, features, citations, création, mise à jour) et l'ordre (asc/desc)
- Basculer entre vue grille et vue tableau
- Supprimer des filtres actifs individuellement ou tous à la fois
- Naviguer page par page avec sélection de la taille de page (12/24/48/96)

### CU-002 — Consulter la fiche d'un dataset

L'utilisateur clique sur un dataset. Il accède à `/datasets/[id]` avec :
- Un bandeau immersif (identité du domaine, stats clés, boutons télécharger / modifier / utiliser dans un projet)
- Un guide pédagogique "Comment utiliser ce dataset ?" en 3 étapes
- Onglet **Overview** : grille des 10 critères éthiques, fiche technique, métriques qualité (complétude, score éthique), datasets similaires
- Onglet **Fichiers** : liste des fichiers avec colonnes profiling (type, PII, nulls, exemples) et téléchargement authentifié
- Onglet **Aperçu** : prévisualisation des données réelles (max 32 rows sampled avec graine 42 si jeu large) et statistiques par colonne
- Onglet **Guide IA** : génération à la demande d'un guide textuel contextualisé (SSE + fallback)

### CU-003 — Importer un dataset (contributor/admin uniquement)

L'utilisateur (rôle contributor ou admin) navigue vers `/datasets/upload`. Wizard en 3 étapes :
1. **Dépôt de fichiers** : zone drag-and-drop acceptant CSV/XLSX/JSON/Parquet jusqu'à 100 Mo. Après dépôt, clic "Analyser" déclenche le profiling backend.
2. **Résultats d'analyse** : résumé (nb fichiers, nb lignes total, score indicatif), aperçu des colonnes par fichier avec badge PII, prévisualisation des données.
3. **Métadonnées** : formulaire en 3 sections (Général / Technique / Éthique) avec suggestions pré-remplies depuis l'analyse. Le nom d'affichage est obligatoire.

### CU-004 — Scorer une sélection de datasets

L'utilisateur, depuis le catalogue avec des filtres actifs, clique "Scorer cette sélection (N datasets)". Il est redirigé vers `/datasets/score` qui charge automatiquement les filtres et affiche :
- Un pupitre de pondération (profils prédéfinis + sliders par critère + barre normalisée) — re-scoring automatique à chaque changement (debouncé 400 ms)
- Une heatmap datasets × critères (tri par colonne, hover pour décomposition) ou une liste classée
- Un clic sur un dataset dans la heatmap redirige vers sa fiche

### CU-005 — Compléter les métadonnées d'un dataset (admin/créateur)

L'utilisateur autorisé navigue vers `/datasets/[id]/complete`. Il voit un anneau de progression global et peut naviguer par ancres aux sections Général/Technique/Éthique. Il complète les champs manquants et sauvegarde.

---

## Dépendances

- **API générée** (`@/lib/api/generated`) : `listDatasets`, `getDatasetFacets`, `getDataset`, `getSimilarDatasets`, `analyzeUpload`, `createDataset`, `updateDataset`, `downloadDatasetFile`, `previewDataset`, `requestAiGuide`, `getDatasetCompletion`, `getScoringProfiles`, `scoreDatasets`
- **Store auth** (`@/lib/auth/store`) : lecture du rôle utilisateur et de l'ID pour les contrôles d'accès
- **Routing Next.js** (App Router) : `useRouter`, `Link`, params de route dynamique
- **next-intl** : internationalisation FR/EN (namespaces `datasets`, `datasets.detail`, `datasets.card`, `datasets.ethics`, `datasets.filterPanel`, `datasets.uploadWizard`, `datasets.completion`, `scoring`)
- **shadcn/ui** : tous les composants UI (Card, Sheet, Slider, Badge, Progress, Table, Tabs, Select, etc.)
- **SessionStorage** : clé `ibis:score:filters` pour la transmission de filtres entre catalogue et scorer
- **EventSource (SSE)** : `/api/v1/jobs/{id}/events` pour le suivi de génération du guide IA

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Qui peut voir les datasets `access=private` ?** Le badge "Privé" est affiché mais le code frontend ne filtre pas sur l'accès — la visibilité semble gérée côté API. À confirmer.
- **Critères éthiques de la taxonomie Khelifi 2024** : les 10 clés (`ETHICAL_KEYS`) sont documentées dans `constants.ts` mais le lien avec la publication de référence n'est pas explicité dans le code frontend. Vérifier si le choix de ces 10 critères est définitif ou si des critères supplémentaires sont envisagés.
- **Taille maximale d'upload** : `MAX_SIZE = 100 Mo` est défini côté frontend dans `upload-dropzone.tsx`, mais la validation côté API peut être différente.
- **Limite du nombre de datasets dans la sélection scorer** : aucune limite visible côté frontend — à vérifier côté API.
- **Similarité des datasets** : les raisons de similarité (`reason`) sont traduites via `t("reason.${reason}")` — les valeurs possibles ne sont pas documentées dans le code frontend.
