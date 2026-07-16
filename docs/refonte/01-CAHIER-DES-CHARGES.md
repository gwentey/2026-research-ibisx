# IBIS-X v2 — Cahier des charges de la refonte complète

> **Version** : 1.0 — 16 juillet 2026
> **Statut** : Document fondateur de la refonte. Sert d'input principal à l'IA de développement (Claude Fable 5) dans le cadre du pipeline **Zelian**.
> **Documents liés** : [02-ARCHITECTURE.md](02-ARCHITECTURE.md) (architecture technique, choix de stack, BDD, auth, bibliothèques IA).
> **Codebase de référence (v1, abandonné)** : `/Applications/XAMPP/xamppfiles/htdocs/2025-research-exai`
> **Template UI cible** : `shadcn-ui-kit-dashboard-main` (Next.js 16, React 19, Tailwind 4, shadcn/ui, Recharts, TanStack Table)

---

## 0. Comment lire ce document

Ce cahier des charges est **exhaustif et auto-suffisant** : une IA de développement doit pouvoir implémenter IBIS-X v2 sans jamais consulter le code v1. Il est issu d'une rétro-ingénierie complète du code v1 (6 rapports d'analyse : service-selection, ml-pipeline, xai-engine, frontend Angular, infrastructure/auth, documentation/PRD/mémoire), croisée avec le mémoire de recherche M2 et l'audit interne de 78 constats.

Conventions :
- **[MUST]** : exigence obligatoire de la v2.
- **[SHOULD]** : fortement recommandé, négociable si coût disproportionné.
- **[V2.1]** : hors périmètre du premier livrable, prévu ensuite.
- **[NE PAS REPRODUIRE]** : défaut de la v1 explicitement interdit en v2.
- Chaque module fonctionnel (M1 à M8) est spécifié avec : objectif, parcours utilisateur, règles métier (formules exactes), écrans, API attendue, et pièges hérités de la v1.

---

## 1. Contexte et mission

### 1.1 Origine du projet

IBIS-X est né d'un **projet de recherche académique** (mémoire de Master 2 MIAGE, Université Paris 1 Panthéon-Sorbonne, soutenu le 22 septembre 2025, sous la direction de Nourhène Ben Rabah, jury Camille Salinesi). Le nom de recherche du projet est **EXAI** (*Explainable AI*), le nom produit est **IBIS-X**. Un papier de recherche (KES) prolonge ces travaux.

Le projet répond à un constat : l'explosion des données et du Machine Learning laisse de côté les **utilisateurs non-spécialistes en science des données** — chercheurs d'autres disciplines, étudiants, enseignants, professionnels de terrain. Ils font face à trois obstacles successifs et traditionnellement traités par des outils **disjoints** :

1. **Choisir un jeu de données pertinent** — non seulement selon des critères techniques (taille, qualité, documentation) mais aussi selon des critères **éthiques** (consentement, anonymisation, RGPD, équité), quasiment jamais outillés.
2. **Conduire un pipeline de Machine Learning** — prétraitement, choix de la tâche, algorithme, hyperparamètres : chaque étape est un mur de jargon et une source d'erreurs méthodologiques (confusion classification/régression, fuite de données, sur-traitement).
3. **Comprendre et faire confiance aux résultats** — les modèles sont des « boîtes noires » ; les méthodes d'explicabilité (XAI) existent (SHAP, LIME) mais exigent une expertise pour être choisies et interprétées.

### 1.2 Mission

> **IBIS-X est un pipeline intégré qui accompagne un utilisateur non-expert de bout en bout : de la sélection éthique et technique d'un jeu de données, à l'entraînement guidé d'un modèle de ML, jusqu'à l'explication adaptée à son niveau de compréhension.**

Le cadre scientifique est un framework en **3 phases** (figure 1 du papier de recherche) :

| Phase | Nom | Contenu |
|---|---|---|
| 1 | **Multi-criteria Dataset Selection** | Critères techniques + éthiques + popularité → datasets classés (ranked) |
| 2 | **User-centred ML Pipeline** | Étapes guidées (tâche, prétraitement, entraînement, évaluation) — modèles Decision Tree & Random Forest |
| 3 | **User-centred Explainability** | SHAP (+ LIME) avec **adaptation** sémantique, structurelle et interactionnelle au profil de l'utilisateur |

Le fondement académique de la phase 1 est la taxonomie de **26 critères en 3 catégories** de : *Khelifi, T., Ben Rabah, N., Le Grand, B. — "A Comprehensive Review of Educational Datasets: A Systematic Mapping Study (2022-2023)", Procedia Computer Science 246 (2024), 1780-1789*. IBIS-X en est la **première opérationnalisation technique** sous forme d'un algorithme de scoring quantitatif. L'adaptation des explications s'appuie sur la **Théorie de la Charge Cognitive** (Sweller, 1988).

### 1.3 Pourquoi une refonte à zéro

La v1 est une preuve de concept fonctionnelle mais **structurellement condamnée** :

1. **Architecture disproportionnée** : 4 microservices FastAPI + frontend Angular + PostgreSQL + Redis + MinIO orchestrés par **Kubernetes/minikube** (Skaffold, Kustomize, Terraform, 11 workloads). Minikube plafonne à ~7,5 GB de RAM sur la machine de dev, provoque des OOMKilled récurrents, et le découpage en microservices a **causé** les pires défauts du produit : contrats front/back désalignés, 3 implémentations divergentes du scoring, 4 vocabulaires de nettoyage, couplage par SQL direct entre services, code copié entre images Docker.
2. **Design périmé et incohérent** : template Angular « Spike » superposé à un design system maison (1 558 `!important`, deux langages graphiques), composants monolithiques (wizard : 4 301 lignes ; page résultats : 5 868 lignes).
3. **Dette de confiance** : l'audit interne (78 constats, 28 critiques) a révélé des données **fictives présentées comme réelles** (dashboard XAI 100 % mock, métriques de qualité simulées, faux « SHAP », assistant IA en `setTimeout`), des stratégies de nettoyage ignorées à l'entraînement, 0 % de couverture de tests, et des secrets réels versionnés dans git.

**La v2 repart de zéro** : nouveau repo, nouvelle stack (Next.js + shadcn/ui côté front ; backend modulaire unique + worker — voir 02-ARCHITECTURE.md), **Docker Compose** à la place de Kubernetes, design system unique fourni par le template `shadcn-ui-kit-dashboard`. Ce qui est conservé de la v1, c'est **le savoir fonctionnel** : les formules de scoring, la taxonomie des critères, les 9 étapes du pipeline, la logique de nettoyage, les métriques, et les leçons de l'audit.

### 1.4 Les 7 principes non négociables (hérités de l'audit v1, applicables à tout le développement)

| # | Principe | Traduction concrète |
|---|---|---|
| **P1** | **Jamais de donnée inventée non signalée** | Aucun mock, aucune valeur aléatoire, aucun fallback silencieux présenté comme une donnée réelle. Si une donnée est indisponible : état vide explicite ou erreur claire. Si une valeur est estimée : badge « estimé ». |
| **P2** | **IA honnête** | Toute sortie LLM porte `model_used` ; tout repli heuristique porte `is_fallback: true` et est affiché comme tel. Une importance de features native (Gini) ne s'appelle jamais « SHAP ». |
| **P3** | **Une seule source de vérité par donnée** | Un score est calculé à UN endroit (backend) et affiché tel quel. Un état de wizard vit dans UN store. Un vocabulaire (stratégies de nettoyage, statuts) est défini dans UN module partagé. |
| **P4** | **Reproductibilité** | `random_state=42` systématique (split, entraînement, échantillonnage SHAP/LIME), température LLM = 0 pour les explications. Deux exécutions identiques → résultats identiques. |
| **P5** | **L'utilisateur sait toujours où il est** | Fil de mission visible (Projet → Dataset → Entraînement → Explication), breadcrumbs, états de chargement/erreur/vide systématiques. |
| **P6** | **Un seul langage graphique** | Le design system du template shadcn-ui-kit, rien d'autre. Aucun style inline sauvage, aucun second système de tokens. |
| **P7** | **Maintenable par un seul développeur** | Composants courts, modules découplés, pas de fichier > 400 lignes côté front, pas de module backend fourre-tout. |

### 1.5 Personas

| Persona | Profil | Besoins clés |
|---|---|---|
| **Étudiant·e** (persona primaire) | Master/doctorat hors informatique (éducation, santé, SHS). Premiers pas en ML. | Guidage pas à pas, pédagogie intégrée (chaque concept expliqué en place), jamais bloqué par un jargon ou un crash, droit à l'erreur. |
| **Chercheur·se** | Utilise le ML comme outil. Sensible aux biais et à l'éthique des données. | Scoring éthique fiable et traçable, reproductibilité stricte, export des artefacts (modèle, métriques, rapport). |
| **Enseignant·e** | Utilise la plateforme en TD devant des étudiants. | Parcours linéaire démontrable en 20 minutes, états d'erreur clairs, zéro donnée fictive, comptes multiples gérables. |
| **Administrateur** | Gère l'instance (équipe de recherche). | Gestion des utilisateurs et rôles, gestion du catalogue de datasets, configuration des templates éthiques, supervision des jobs. |

### 1.6 Le parcours « mission » (fil conducteur de toute l'UX)

Le produit s'organise autour d'un fil unique, toujours visible, avec reprise possible à tout moment :

```
① PROJET  →  ② DATASET  →  ③ ENTRAÎNEMENT (9 étapes)  →  ④ EXPLICATION
   (créer,        (recommandés         (wizard guidé,            (résultats +
   critères,       + catalogue          worker asynchrone)         XAI + chat IA)
   pondérations)   filtrable)
```

- Un **projet** capture le besoin (critères + pondérations) et sert de conteneur aux expériences → c'est lui qui permet le **benchmarking** (comparer plusieurs expériences sur plusieurs datasets pour un même besoin).
- L'entrée dans le wizard d'entraînement se fait **toujours** dans le contexte d'un projet et d'un dataset (un seul point d'entrée — [NE PAS REPRODUIRE] la v1 avait 2 parcours concurrents ml-studio/wizard).
- Les résultats d'une expérience regroupent **performance ET explicabilité** sur une seule page (pas de dashboard XAI séparé — décision D2 de l'audit).

---

## 2. Périmètre

### 2.1 Inclus dans la v2 (MVP complet)

- M1 — Authentification, comptes, RBAC, onboarding
- M2 — Catalogue de datasets : listing, filtration, détail, aperçu, import (Kaggle + upload manuel)
- M3 — Sélection multi-critères : scoring pondéré, comparaison, heatmap
- M4 — Projets & benchmarking des datasets et des expériences
- M5 — Pipeline ML guidé en 9 étapes (wizard + worker asynchrone)
- M6 — Explicabilité (XAI) : SHAP/LIME, KPI, graphes, explication textuelle LLM, chat
- M7 — Dashboard d'accueil & suivi des expériences
- M8 — Administration (utilisateurs, datasets, templates éthiques)
- i18n FR/EN complet, dark mode, design system shadcn

### 2.2 Exclus / reportés

- Déploiement cloud managé (Azure AKS, Terraform) — la v2 vise un déploiement **Docker Compose sur une seule machine** (un VPS suffira).
- Deep learning, AutoML, counterfactuals, export PDF riche — [V2.1].
- Application mobile, API publique tierce, facturation réelle.
- Migration des données v1 : **aucune** (les datasets seront réimportés par le pipeline d'import ; les comptes seront recréés).

---

## 3. Acteurs et RBAC

### 3.1 Rôles

Système de rôles simple, stocké en base, embarqué dans le JWT (claim `role`), **sans IDP externe** :

| Rôle | Description |
|---|---|
| `user` | Rôle par défaut à l'inscription. Utilise la plateforme : projets, entraînements, explications. |
| `contributor` | Utilisateur de confiance : peut en plus enrichir le catalogue de datasets. |
| `admin` | Administrateur : gestion complète (utilisateurs, tous les datasets, templates éthiques, supervision). |

### 3.2 Matrice de permissions [MUST]

| Capacité | user | contributor | admin |
|---|:-:|:-:|:-:|
| Parcourir/filtrer le catalogue, voir détail + aperçu | ✅ | ✅ | ✅ |
| Scorer des datasets, créer/gérer **ses** projets | ✅ | ✅ | ✅ |
| Lancer des entraînements (dans la limite de ses quotas) | ✅ | ✅ | ✅ |
| Demander des explications XAI + chat | ✅ | ✅ | ✅ |
| Gérer son profil, son mot de passe, supprimer son compte | ✅ | ✅ | ✅ |
| Uploader un dataset dans le catalogue | ❌ | ✅ | ✅ |
| Modifier/supprimer un dataset | ❌ | ses datasets | tous |
| Compléter les métadonnées d'un dataset | ❌ | ses datasets | tous |
| Voir/gérer les utilisateurs, changer les rôles | ❌ | ❌ | ✅ |
| Gérer les templates éthiques par domaine | ❌ | ❌ | ✅ |
| Lancer l'import Kaggle, superviser les jobs | ❌ | ❌ | ✅ |
| Ajuster les quotas/crédits d'un utilisateur | ❌ | ❌ | ✅ |

[NE PAS REPRODUIRE] En v1, `PUT/DELETE /datasets` et des endpoints admin étaient accessibles **sans contrôle de rôle ni de propriétaire** (constats S1/S2). En v2, **chaque** endpoint d'écriture vérifie rôle + ownership ; les tests d'intégration le prouvent.

### 3.3 Quotas [MUST]

Pour protéger la machine (entraînements) et le budget (LLM) :
- Max **3 entraînements simultanés** par utilisateur (HTTP 429 au-delà, message clair).
- Max **20 entraînements/jour** par utilisateur.
- Chat XAI : max **5 questions par session** d'explication, sessions expirées après 24 h d'inactivité.
- Système de **crédits** simple : chaque utilisateur a un solde (défaut 100), 1 entraînement = 1 crédit, 1 explication LLM = 1 crédit ; l'admin peut recharger. Affichage du solde dans le header et avant chaque action payante. (Pas de paiement réel — c'est un mécanisme de gouvernance d'usage académique.)
- Valeurs configurables par variables d'environnement, pas de constantes en dur dispersées [NE PAS REPRODUIRE : quotas hardcodés v1].

---

## 4. M1 — Authentification, comptes et onboarding

### 4.1 Fonctionnalités [MUST]

- **Inscription** email + mot de passe (avec force minimale : 8 caractères, vérification côté serveur), auto-connexion après inscription.
- **Connexion** email + mot de passe → JWT access (30 min) + refresh token (7 jours, rotation). Voir 02-ARCHITECTURE.md §Auth pour le détail technique.
- **Déconnexion** (révocation du refresh token).
- **Mot de passe oublié** : flux par email avec token à durée limitée (SMTP configurable ; en dev, le lien est loggé). [SHOULD — si SMTP absent, l'admin peut réinitialiser un mot de passe.]
- **Connexion Google** [MUST] : bouton « Continuer avec Google » sur les pages login et register. Implémentation **OAuth 2.0 / OIDC directe avec Google** (identifiants créés gratuitement dans Google Cloud Console) — **aucun IDP tiers** (pas d'Auth0/Clerk/Firebase/Supabase, rien de payant ni de facturable). Le backend échange le code, vérifie l'`id_token` Google, crée le compte ou le **lie par email vérifié** à un compte existant, puis émet **nos propres JWT** (exactement les mêmes sessions access/refresh que l'auth email + mot de passe). Un compte « Google uniquement » n'a pas de mot de passe (il peut en définir un ensuite depuis le profil). Le premier login Google passe aussi par l'onboarding obligatoire.
- **Profil** : pseudo, avatar (upload image), prénom/nom, langue préférée ; changement de mot de passe (avec mot de passe actuel) ; suppression de compte (confirmation par saisie de l'email, suppression en cascade de ses projets/expériences/explications).
- **Onboarding obligatoire** au premier login (3 questions, wizard plein écran) :
  - `education_level` (select : lycée / licence / master / doctorat / autre) — requis
  - `age` (13–120) — requis
  - `ai_familiarity` (échelle 1–5) — requis
  Tant que non complété, l'utilisateur est redirigé vers `/onboarding`. Ces champs pilotent **l'adaptation des explications XAI** (M6) : `ai_familiarity` 1–2 → profil `novice`, 3 → `intermediate`, 4–5 → `expert` (modifiable ensuite dans le profil).

### 4.2 Écrans (mapping template shadcn)

- `login`, `register`, `forgot-password` : reprendre les pages `(guest)` du template, avec le bouton « Continuer avec Google » au-dessus du formulaire (séparateur « ou »).
- Onboarding : s'inspirer de `pages/onboarding-flow` du template (stepper plein écran, barre de progression).
- Profil : base `pages/profile` + `pages/settings` du template (onglets : Profil, Sécurité, Préférences, Crédits).

---

## 5. M2 — Catalogue de datasets et filtration

### 5.1 Objectif

Offrir un catalogue de jeux de données **richement décrits** (métadonnées techniques + éthiques) que l'utilisateur peut explorer, filtrer finement, prévisualiser et comprendre avant de s'engager.

### 5.2 Modèle de métadonnées d'un dataset [MUST]

Chaque dataset porte (issu de la taxonomie Khelifi 2024, schéma v1 conservé et assaini) :

**Identification & documentation**
- `dataset_name` (slug technique), `display_name` (nom d'affichage), `year`, `objective` (description de l'objectif), `sources` (provenance), `storage_uri` (lien externe, ex. page Kaggle), `documentation_link`, `citation_link`, `num_citations` (défaut 0), `access` (`public`/`private`), `availability`.
- `metadata_provided_with_dataset` (bool), `external_documentation_available` (bool).

**Caractéristiques techniques**
- `instances_number`, `features_number`, `features_description`
- `domain` : **liste** de domaines (education, healthcare, finance, social, biology, business, environment, technology, research…)
- `task` : **liste** de tâches ML (classification, regression, clustering, nlp, time_series…)
- `split` (bool : fourni pré-divisé train/test), `temporal_factors` (bool)
- `has_missing_values` (bool), `global_missing_percentage` (float), `missing_values_description`, `missing_values_handling_method`
- `representativity_level` (`high`/`medium`/`low`/`unknown`) + description
- `sample_balance_level` (`balanced`/`moderate`/`imbalanced`/`severely_imbalanced`) + description

**Les 10 critères éthiques** — booléens **tristate** (`null` = non évalué, `false` = évalué absent, `true` = présent) :

| # | Champ | Signification |
|---|---|---|
| 1 | `informed_consent` | Consentement éclairé des personnes concernées |
| 2 | `transparency` | Transparence sur la collecte et l'usage |
| 3 | `user_control` | Contrôle des personnes sur leurs données |
| 4 | `equity_non_discrimination` | Équité / non-discrimination |
| 5 | `security_measures_in_place` | Mesures de sécurité en place |
| 6 | `data_quality_documented` | Qualité/erreurs des données documentées |
| 7 | `anonymization_applied` | Anonymisation appliquée |
| 8 | `record_keeping_policy_exists` | Politique de conservation des enregistrements |
| 9 | `purpose_limitation_respected` | Limitation des finalités / collecte minimale |
| 10 | `accountability_defined` | Responsabilité définie / gestion du cycle de vie |

**Structure physique** : un dataset possède 1..n **fichiers** (`original_filename`, nom de stockage UUID, `format` — toujours convertis en **Parquet** —, `size_bytes`, `row_count`, `logical_role` : `data_file`/`training_data`/`test_data`), et chaque fichier 1..n **colonnes** (`column_name`, `data_type_original` pandas, `data_type_interpreted` : `numerical`/`categorical`/`text`/`datetime`/`boolean`, `is_nullable`, `is_pii`, `example_values` (3–5), `position`, `stats` JSON : `null_count`, `null_percentage`, `unique_count`, `min`, `max`, `mean`, `std`).

`created_by` : propriétaire (null = import système, gérable admin uniquement).

### 5.3 Listing & filtration [MUST]

**Page catalogue** (`/datasets`) :
- **Vue grille de cartes** (défaut) + bascule **vue table** (TanStack Table du template). Carte : nom, année, badges (accès, score éthique %, représentativité), stats (instances, features, % manquants), indicateurs (split/anonymisé/temporel), chips domaines & tâches (+N), actions **Voir** / **Utiliser dans un projet**.
- **Recherche** plein texte (debounce 300 ms) sur nom + objectif.
- **Tri** : nom, année, instances, features, citations, date d'ajout, date de MAJ (asc/desc).
- **Pagination serveur** : 12/24/48/96 par page (défaut 24).
- **Filtres actifs affichés en chips supprimables** + « Tout effacer ». Compteur de résultats **en temps réel** dans le panneau de filtres.
- États : chargement (skeletons), erreur (retry), vide, vide-avec-filtres.

**Panneau de filtres** (Sheet/Drawer shadcn), liste exhaustive des filtres, tous appliqués **côté backend** :

| Filtre | Contrôle UI | Sémantique backend |
|---|---|---|
| Domaines | grille de cartes cliquables multi-sélection | le dataset contient TOUS les domaines cochés |
| Tâches ML | multi-select | idem (containment) |
| Instances min/max | double slider + inputs | plage sur `instances_number` |
| Features min/max | inputs numériques | plage |
| Année min/max | inputs numériques | plage |
| Citations min/max | inputs numériques | plage |
| Score éthique minimum | slider 0–100 % | score éthique calculé ≥ seuil |
| Pré-divisé (split) | toggle | si activé : `split = true` |
| Anonymisé | toggle | si activé : `anonymization_applied = true` |
| Facteurs temporels | toggle | si activé : `temporal_factors = true` |
| Accès public | toggle | si activé : `access = 'public'` |
| Représentativité | select (high/medium/low) | égalité |
| Présence de valeurs manquantes | tristate (peu importe / avec / sans) | `has_missing_values` |
| Les 10 critères éthiques | section « Éthique avancée » repliée : un toggle par critère | si activé : critère `= true` |

[NE PAS REPRODUIRE] La v1 avait **deux** implémentations concurrentes du panneau de filtres. Une seule en v2 (P3).

### 5.4 Page détail d'un dataset [MUST]

`/datasets/[id]` — header (nom, badges, métriques inline, actions : Utiliser dans un projet / Télécharger / Modifier si owner-admin) + **4 onglets** :

1. **Vue d'ensemble** : informations générales ; grille de **conformité éthique** (10 critères, icône ✓/✗/— pour true/false/null — le tristate est VISIBLE) ; métriques de qualité **réelles uniquement** (complétude = 100 − % manquants ; score éthique ; score technique — voir M3) ; datasets similaires (même domaine+tâche > domaine > tâche > taille ±50 %).
2. **Fichiers & structure** : liste des fichiers (format, taille, lignes) ; table des colonnes (nom, type interprété, badge PII, nullable, % nulls, exemples).
3. **Aperçu des données** : échantillon **réel** de 50 lignes (échantillonnage `random_state=42` pour la stabilité), max 20 colonnes affichées avec sélecteur ; statistiques par colonne calculées sur le fichier complet (non-null, unique, mean/std/min/max, top 3 valeurs). Si le fichier est inaccessible : **état d'erreur explicite** — [NE PAS REPRODUIRE] jamais d'aperçu simulé.
4. **Guide IA** : analyse LLM du dataset à la demande (asynchrone) : à quoi sert ce dataset, colonnes cibles plausibles, tâches adaptées, précautions. Sortie balisée `model_used`, fallback heuristique marqué `is_fallback` (P2).

[NE PAS REPRODUIRE] Les métriques v1 « consistency/accuracy/outliers/pii_risk » générées **aléatoirement** sont supprimées. On n'affiche que ce qu'on calcule vraiment.

### 5.5 Ingestion de datasets

**a) Import Kaggle (seed du catalogue)** [MUST]
- CLI d'administration (`ibis import-kaggle`) pilotée par un fichier de config YAML listant ~30 datasets de référence (majorité éducation : student_performance, student_stress, student_depression, oulad, riiid, asap_essay… ; santé : pima_diabetes, breast_cancer, heart_disease ; classiques : iris, mushroom, titanic, penguins, wine_quality, bank_marketing).
- Pipeline : téléchargement API Kaggle → analyse des CSV (types, stats, détection PII par heuristique nom de colonne + regex, **persistée** dans `is_pii`) → conversion **Parquet (Snappy)** → stockage objet → écriture des métadonnées **via la couche service interne** (pas de bypass SQL direct [NE PAS REPRODUIRE]).
- Métadonnées enrichies par dataset dans des JSON versionnés (10 critères éthiques renseignés à la main, validés par JSON Schema) ; fallback : template éthique du domaine (M8), sinon tristate `null`.
- Idempotent (cache/skip si déjà importé), relançable, exécutable dans le conteneur worker.

**b) Upload manuel (contributor/admin)** [MUST]
- Assistant en 3 étapes : ① dépôt de fichiers (drag & drop, formats CSV/XLSX/JSON/Parquet, max 100 MB/fichier) → ② **analyse automatique sans persistance** (aperçu 10 lignes, colonnes détectées, % manquants, suggestions : domaines par mots-clés de colonnes, tâches plausibles, nom proposé, score de qualité indicatif) → ③ formulaire de métadonnées pré-rempli (généra les + techniques + éthiques, tristate par défaut `null`).
- À la validation : conversion Parquet, upload storage, création dataset+fichiers+colonnes, calculs agrégés (`instances_number` = max lignes, `features_number`, `global_missing_percentage` pondérée par lignes).
- **Complétion de métadonnées** : page dédiée affichant le taux de complétude (% de champs remplis, les critères éthiques sensibles étant marqués « à valider par un humain »), avec formulaire par sections.

### 5.6 API attendue (contrat indicatif)

```
GET    /api/v1/datasets                      (filtres + tri + pagination)
GET    /api/v1/datasets/facets               (domaines, tâches, bornes numériques — pour construire les filtres)
GET    /api/v1/datasets/stats                (totaux catalogue pour dashboard)
GET    /api/v1/datasets/{id}
GET    /api/v1/datasets/{id}/preview
GET    /api/v1/datasets/{id}/similar
GET    /api/v1/datasets/{id}/files, /files/{fileId}/download
POST   /api/v1/datasets/preview              (analyse pré-upload, multipart)
POST   /api/v1/datasets                      (création, multipart)         [contributor+]
PUT    /api/v1/datasets/{id}                 [owner|admin]
DELETE /api/v1/datasets/{id}                 [owner|admin]
POST   /api/v1/datasets/{id}/ai-guide        (job LLM asynchrone → job_id)
```

---

## 6. M3 — Sélection de datasets par critères (scoring multi-critères)

### 6.1 Objectif

Transformer le choix d'un dataset en une décision **assistée et transparente** : l'utilisateur exprime ses priorités (poids), le système calcule un score par dataset et **explique la décomposition** de chaque score. C'est le cœur scientifique de la Phase 1.

### 6.2 Les scores élémentaires [MUST] — formules exactes (héritées v1, validées par le mémoire)

Tous les scores sont dans **[0, 1]**. Le backend est l'**unique** endroit où ils sont calculés (P3) ; le frontend ne recalcule jamais.

**Score éthique**
```
score_ethique = (nombre de critères éthiques à TRUE) / 10
```
(`null` et `false` comptent 0 — granularité de 10 % par critère.)

**Score technique** — somme pondérée **normalisée dynamiquement** sur les seuls critères renseignés (un champ `null` est exclu du numérateur ET du dénominateur) :

| Composante | Poids | Score élémentaire |
|---|---|---|
| `metadata_provided_with_dataset` | 0.15 | 1 si true |
| `external_documentation_available` | 0.15 | 1 si true |
| Valeurs manquantes | 0.20 | 1 si aucune ; sinon `(100 − global_missing_percentage)/100` |
| `split` | 0.20 | 1 si pré-divisé |
| `instances_number` | 0.15 | `clamp((log10(n) − 2) / 3, 0, 1)` → 0 sous 100 lignes, 1 dès 100 000 |
| `features_number` | 0.15 | optimal 10–100 → 1 ; `< 10` → `f/10` ; `> 100` → `max(0.5, 1 − (f−100)/1000)` |

```
score_technique = Σ(score_i × poids_i) / Σ(poids_i applicables)
```

**Score de popularité**
```
score_popularite = clamp(log10(num_citations) / 3, 0, 1)     (0 si citations ≤ 0 ; 1 dès 1000)
```

### 6.3 Le score de pertinence pondéré [MUST]

L'utilisateur pondère parmi **12 critères scorables** :

| `criterion_name` | Score élémentaire |
|---|---|
| `ethical_score` | score éthique (ci-dessus) |
| `technical_score` | score technique |
| `popularity_score` | score popularité |
| `anonymization` | 1 si `anonymization_applied` |
| `transparency` | 1 si `transparency` |
| `informed_consent` | 1 si `informed_consent` |
| `documentation` | 1 si métadonnées OU doc externe |
| `data_quality` | 1 si aucun manquant ; sinon `(100−pct)/100` ; 0.5 si inconnu |
| `instances_count` | `min(1, log10(max(1, n)) / 5)` |
| `features_count` | `min(1, f / 100)` |
| `year` | `clamp((year − 2000) / 25, 0, 1)` (fraîcheur) |
| `sample_balance` [SHOULD, nouveau v2] | balanced=1, moderate=0.66, imbalanced=0.33, severely=0 |

```
score_final(dataset, W) = Σ( score_critère_i × poids_i ) / Σ( poids_i )
```
Poids par défaut si aucun fourni : **éthique 0.4, technique 0.4, popularité 0.2**.
Profils de pondération prédéfinis proposés en un clic : `Recherche académique`, `Application industrielle`, `Prototypage rapide` (+ « Personnalisé »).

**Décomposition** : chaque réponse de scoring inclut `criterion_scores` (les 12 sous-scores) pour affichage (tooltip de décomposition, heatmap). [NE PAS REPRODUIRE] la v1 avait 3 implémentations divergentes (P2 de l'audit).

### 6.4 UX du scoring [MUST]

- **Panneau de pondération** : un slider (0→1, pas 0.05) par critère activé, avec affichage du **% effectif normalisé** (poids/Σpoids) ; bouton « Réinitialiser » ; profils prédéfinis.
- **Résultats** : liste classée (rang, score % coloré : ≥80 vert, ≥60 lime, ≥40 ambre, <40 rouge), tooltip de décomposition par critère.
- **Heatmap de comparaison** [MUST] : datasets (lignes) × critères (colonnes), cellules colorées par sous-score, rendu **Recharts/DOM natif** (pas d'ECharts), interactive (tri par colonne, clic → détail dataset). C'est un marqueur différenciant du produit.
- Le scoring est accessible : ① dans le **formulaire de projet** (aperçu temps réel, debounce 500 ms) ; ② dans la **page projet** (recommandations persistées) ; ③ en exploration libre depuis le catalogue (« Scorer cette sélection »).

### 6.5 API attendue

```
POST /api/v1/datasets/score            { filters?, weights: [{criterion_name, weight}] }
                                       → [ { dataset, score, rank, criterion_scores } ]
GET  /api/v1/score/profiles            (profils de pondération prédéfinis)
```

---

## 7. M4 — Projets et benchmarking

### 7.1 Objectif

Le **projet** est le conteneur de travail : il capture un besoin (critères de filtrage + pondérations), produit des **recommandations de datasets**, et regroupe les **expériences ML** lancées dans son cadre — permettant de **benchmarker** les datasets entre eux et les modèles entre eux.

### 7.2 Fonctionnalités [MUST]

**CRUD projets** (isolation stricte par `user_id`) :
- Liste paginée avec recherche (nom + description), cartes (nom, description, date, nb critères, nb expériences, meilleur score).
- **Création/édition** en 3 étapes (stepper) :
  1. **Informations** : nom (requis, ≤255), description.
  2. **Critères de sélection** : mêmes filtres que le catalogue (domaines, tâches, plages, score éthique min, toggles) — stockés en JSON au format des filtres.
  3. **Pondérations** : le panneau de pondération de M6.4 — stockées en JSON ; normalisation automatique si Σ > 1.
- Aperçu **temps réel** des recommandations pendant l'édition (top 3 + compteur).

**Page projet** (`/projects/[id]`) — 3 onglets :
1. **Recommandations** : le classement complet des datasets selon les critères/poids du projet (liste + **heatmap**) ; actions par dataset : Voir / **Lancer un entraînement** (→ wizard M5 avec `projectId` + `datasetId`).
2. **Expériences** (le cœur du benchmarking) : table de TOUTES les expériences du projet — colonnes : dataset, algorithme, statut (badge), score principal (F1-macro ou MAE selon la tâche), durée, date, actions (voir résultats / relancer / supprimer). **Sélection multi-lignes → vue comparative** : tableau côte à côte des métriques + graphe en barres groupées (Recharts) comparant accuracy/F1/precision/recall (ou MAE/RMSE/R²) entre expériences. C'est LA fonctionnalité de benchmarking : *quel dataset et quel algorithme répondent le mieux à mon besoin ?*
3. **Configuration** : critères et pondérations lisibles + bouton modifier.

Fil de mission (P5) toujours visible : Projet → Dataset → Entraînement → Explication.

### 7.3 API attendue

```
GET/POST       /api/v1/projects              (liste paginée + recherche / création)
GET/PUT/DELETE /api/v1/projects/{id}
GET            /api/v1/projects/{id}/recommendations
GET            /api/v1/projects/{id}/experiments
POST           /api/v1/experiments/compare   { experiment_ids: [] } → métriques alignées
```

---

## 8. M5 — Le pipeline ML guidé en 9 étapes

### 8.1 Objectif et principe

Le wizard d'entraînement est **l'artefact central** du projet de recherche (QR2) : il doit permettre à un non-expert de conduire un entraînement complet **sans erreur méthodologique**, avec une **pédagogie intégrée** à chaque étape (encarts « Comprendre », recommandations IA argumentées, alertes préventives).

**Décision de nomenclature** [MUST] : la v1 avait 3 référentiels contradictoires (9 étapes « marketing », 9 étapes wizard dont 2 masquées, 6 étapes refondues). La v2 fixe **LES 9 étapes canoniques** ci-dessous (celles validées par les scénarios du mémoire), qui sont les 9 écrans du wizard — ni étapes cachées, ni doublon :

| # | Étape | Nom UI (FR) |
|---|---|---|
| 1 | Dataset Overview | **Aperçu du dataset** |
| 2 | Prediction Target | **Objectif de prédiction** |
| 3 | Data Cleaning | **Nettoyage des données** |
| 4 | Data Split | **Division des données** |
| 5 | Final Preparation | **Préparation finale** |
| 6 | Algorithm | **Choix de l'algorithme** |
| 7 | Hyperparameters | **Hyperparamètres** |
| 8 | Training | **Entraînement** |
| 9 | Results | **Résultats** |

Wizard **plein écran** (hors layout dashboard), stepper horizontal persistant, navigation avant/arrière libre sur les étapes déjà validées, état sauvegardé dans **un store unique** (P3) qui projette vers le payload API final. Un brouillon d'expérience est **persisté côté serveur** à chaque étape validée → l'utilisateur peut fermer et reprendre (P5).

### 8.2 Spécification étape par étape [MUST]

**Étape 1 — Aperçu du dataset**
- Contexte d'entrée : `projectId` + `datasetId` (query params obligatoires).
- Affiche : nom, objectif, n lignes × n colonnes, **score de qualité** (issu de l'analyse M5-É3, calculé en tâche de fond dès l'ouverture), aperçu 10 lignes.
- Pédagogie : encart « Qu'est-ce qu'un dataset ? » (lignes/colonnes, analogie tableur) + « Comprendre les métriques ».
- Validation : simple confirmation.

**Étape 2 — Objectif de prédiction**
- Choix de la **colonne cible** (select recherchable listant les colonnes avec type + aperçu de valeurs ; heuristique de pré-suggestion : colonnes nommées target/label/class/score…).
- Choix du **type de tâche** : `classification` ou `regression`.
- **Assistance IA** [MUST] : à la sélection d'une cible, analyse automatique (type, cardinalité, sémantique du nom) → recommandation argumentée « Classification vs Régression » avec exemples concrets (« Classification : prédire si une fleur est setosa/versicolor/virginica ») et bouton **« Appliquer la recommandation »**. Implémentation : heuristique déterministe locale (types/cardinalité) + enrichissement LLM optionnel asynchrone ; toute sortie marquée P2.
- Garde-fou : si la cible est catégorielle (dtype objet ou cardinalité faible) et que l'utilisateur choisit « régression », alerte bloquante expliquant l'incohérence (l'auto-correction silencieuse de la v1 devient un dialogue explicite).
- Validation : cible + tâche choisies.

**Étape 3 — Nettoyage des données** (étape la plus riche — cœur métier)
- **Analyse de qualité** serveur (mise en cache 7 jours par dataset, invalidable) :
  - par colonne : nb/% manquants, type, distribution (test de normalité + skewness : normal / symétrique / asymétrique droite/gauche), nb valeurs uniques, outliers (IQR : bornes Q1−1.5·IQR / Q3+1.5·IQR ; Z-score seuil 3) ;
  - normalisation des « faux manquants » : `''`, espaces, `null`, `NaN`, `None`, `undefined`, `N/A`, `#N/A`, `missing`… traités comme NaN — implémentée à UN seul endroit (P3) ;
  - **score de qualité global 0–100** : 100 − pénalité manquants (max −50) − pénalité outliers >10 % (max −20/colonne).
- **Tableau interactif par colonne à traiter** : colonne, type, % manquants (barre), distribution, **stratégie recommandée** + sélecteur de stratégie.
- **Vocabulaire canonique unique des stratégies** (P3) : `mean` · `median` · `most_frequent` · `constant` (avec valeur) · `knn` · `iterative` · `drop_rows` · `drop_column`. Aucun alias, aucune interpolation temporelle fantôme [NE PAS REPRODUIRE : la v1 proposait linear/spline/ffill silencieusement remplacées par median].
- **Recommandation automatique par colonne** :

| % manquants | Numérique | Catégorielle |
|---|---|---|
| > 70 % | `drop_column` | `drop_column` |
| 40–70 % | `knn` (alt. `iterative`) | `most_frequent` (alt. `constant`) |
| 15–40 % | `mean` si distribution normale, sinon `median` | `most_frequent` |
| < 15 % | `mean`/`median` (alt. `drop_rows`) | `most_frequent` |

- Bouton **« Appliquer les recommandations »** (remplit tout), puis ajustement libre.
- **Validation bloquante** : toute colonne > 30 % de manquants doit avoir une stratégie explicite ; la colonne cible ne peut pas rester avec des manquants non traités (ses lignes manquantes seront supprimées — affiché).
- Cas dataset propre : message positif « 0 colonne à nettoyer — vos données sont excellentes, aucun traitement inutile ne sera appliqué » (anti sur-traitement, pédagogie).
- **Contrat d'honnêteté** [MUST] : la configuration de nettoyage établie ici est **réellement appliquée** par le worker (T1 v1 : elle était ignorée !) et le récapitulatif post-entraînement montre `applied: true` + le détail des transformations effectuées.

**Étape 4 — Division des données**
- `test_size` : slider 10–50 %, défaut **20 %** ; visualisation proportionnelle (n_train / n_test).
- **Stratification automatique** en classification (si classe minoritaire ≥ 2 ; les classes à 1 exemplaire sont supprimées avec avertissement listant les classes retirées).
- `random_state = 42` fixé (affiché, non modifiable en mode guidé — P4).
- Pédagogie : encart « Pourquoi séparer train/test ? ».
- Auto-validée (défauts sains).

**Étape 5 — Préparation finale**
- **Normalisation** : toggle + méthode `standard` (recommandé, μ=0 σ=1) / `minmax` / `robust` — avec explication comparative et exemple visuel ([10,20,30] → [−1,0,+1]). Recommandation `robust` si outliers détectés à l'étape 3.
- **Encodage catégoriel** : `onehot` (recommandé) / `ordinal` — avec explication.
- La config choisie est **réellement transmise et appliquée** ([NE PAS REPRODUIRE] T3 v1 : scaling toujours appliqué, méthode ignorée).
- Auto-validée.

**Étape 6 — Choix de l'algorithme**
- **Cartes d'algorithmes** servies par `GET /algorithms` — la v2 démarre avec exactement **2 algorithmes** (périmètre scientifique assumé, décision D5) :
  - `decision_tree` — Decision Tree (classification & régression) : interprétable, rapide, badge « Explicabilité maximale ».
  - `random_forest` — Random Forest (classification & régression) : robuste, performant, OOB score, badge « Recommandé ».
- Chaque carte : forces/faiblesses, cas d'usage, temps indicatif.
- **Recommandation IA** argumentée selon le dataset (taille, dimensionnalité, tâche) — heuristique + LLM optionnel, P2 ; toute recommandation hors catalogue est impossible ([NE PAS REPRODUIRE] T8 : l'IA v1 recommandait XGBoost/SVM non entraînables).
- L'architecture des wrappers doit permettre d'**ajouter un algorithme en < 1 jour** (registre d'algos : classe wrapper + schéma d'hyperparamètres + carte UI auto-générée) [V2.1 : gradient boosting, régression logistique/linéaire].

**Étape 7 — Hyperparamètres**
- **3 presets** : `Équilibré` (défaut) / `Haute précision` / `Rapide` + mode « Personnalisé ».
- Formulaire **généré dynamiquement** depuis le schéma d'hyperparamètres retourné par l'API :
  - Decision Tree : `criterion` (gini/entropy — auto `squared_error` en régression), `max_depth` (1–50, déf. 5), `min_samples_split` (2–100, déf. 2), `min_samples_leaf` (1–50, déf. 1).
  - Random Forest : `n_estimators` (10–500, déf. 100), `max_depth` (1–50, déf. 10), `min_samples_split` (2–100, déf. 2), `bootstrap` (bool, déf. true). Imposés : `random_state=42`, `n_jobs=-1`, `oob_score=true` en classification.
- Chaque champ : description accessible + alerte de trade-off (« augmenter améliore la précision mais ralentit », « valeurs élevées ⇒ risque de surapprentissage »).

**Étape 8 — Entraînement**
- **Récapitulatif complet** (dataset, cible, tâche, nettoyage, split, préparation, algo, hyperparamètres) + coût (1 crédit) + case de confirmation obligatoire.
- Lancement : `POST /experiments` → statut `pending`, job en file (worker). Si la file est occupée : position dans la file affichée.
- **Console de progression en temps réel** : progression 0–100 % par jalons (10 chargement → 30 données prêtes → 50 préprocessing appliqué → 70 modèle entraîné → 90 évaluation & artefacts → 100 terminé) + logs horodatés lisibles (« Chargement du dataset… », « 3 colonnes imputées (median) », « Entraînement Random Forest (100 arbres)… »). Transport : **SSE** (Server-Sent Events) avec repli polling 2 s.
- Annulation possible (bouton → statut `cancelled`, révocation du job, nettoyage des artefacts partiels).
- Échecs : statut `failed` + `error_code` lisible (`DATASET_UNAVAILABLE`, `CLEANING_CONFIG_INVALID`, `WORKER_LOST`, `TIMEOUT`…) + message actionnable. **Jamais** d'entraînement de secours sur données synthétiques ([NE PAS REPRODUIRE] T6).

**Étape 9 — Résultats**
- Transition automatique à `completed` → page de résultats de l'expérience (voir M6, la page est commune performance + XAI).
- **Métriques calculées** [MUST] :
  - Classification : `accuracy`, `precision`, `recall`, `f1_score` (weighted), `precision_macro`, `recall_macro`, **`f1_macro` (métrique principale)**, `roc_auc` (binaire, ou OvR macro en multiclasse), `pr_auc` (binaire), matrice de confusion, rapport par classe ; Random Forest : `oob_score`.
  - Régression : **`mae` (métrique principale)**, `mse`, `rmse`, `r2`.
- **Visualisations : données JSON rendues côté client (Recharts)** [MUST — rupture v1] : matrice de confusion (heatmap), courbe ROC (points + AUC + seuil optimal), courbe précision-rappel, importance des features (top 20, barres), arbre de décision interactif (structure JSON ; pour RF : premier arbre, profondeur ≤ 4, avec mention « 1 arbre sur N »), et en régression : prédictions vs réelles, résidus vs prédictions, histogramme des résidus. [NE PAS REPRODUIRE] les PNG matplotlib en base64 stockés en BDD.
- Score global composite affiché en anneau + qualification (« Excellent ≥ 90 », « Bon ≥ 75 », « Correct ≥ 60 », « À améliorer < 60 ») avec tooltip de méthode de calcul.
- Explication pédagogique de chaque métrique en place (« F1-Macro : moyenne non pondérée entre classes, plus représentative en multiclasse »).
- Actions : **Télécharger le modèle** (.joblib), Relancer avec ajustements (pré-remplit le wizard), Nouvelle expérience, Aller à l'explicabilité.
- Validation croisée [V2.1] : k-fold optionnelle (la v1 l'affichait sans l'exécuter — interdit en v2 : on ne montre que ce qui tourne).

### 8.3 Exécution backend (contrat du worker) [MUST]

Séquence exacte appliquée par le worker (voir 02-ARCHITECTURE.md pour la techno) :
1. Charger le Parquet depuis le stockage (échec explicite si indisponible).
2. Nettoyage des tokens de manquants → application des `column_strategies` (drop_column → drop_rows → imputations par groupe de stratégie) → suppression des lignes à cible manquante → exclusion des colonnes identifiantes (id, index, row_id…).
3. Encodage de la cible (LabelEncoder si classification).
4. Split stratifié (cf. É4).
5. Pipeline sklearn `ColumnTransformer` : imputer + scaler (numériques), imputer + encoder (catégorielles) — **fit sur train uniquement** (aucune fuite de données).
6. Entraînement (wrapper d'algo, `random_state=42`).
7. Évaluation (métriques ci-dessus) + extraction feature importance (top 20) + structure d'arbre JSON.
8. Sérialisation de l'artefact : `{model, preprocessing_pipeline, feature_names, training_config}` en joblib versionné.
9. Écriture des résultats (métriques JSON, données de visualisation JSON, chemin artefact) + statut `completed`.
- Timeout dur 2 h, retries techniques (connexion) ×3, progression persistée, annulation propre.

---

## 9. M6 — Explicabilité (XAI) : méthodes, KPI et graphes

### 9.1 Objectif

Répondre à QR3 : fournir des explications **fiables, reproductibles et adaptées au profil** de l'utilisateur, avec des indicateurs de qualité honnêtes. La page de résultats d'une expérience contient un onglet **Explicabilité** (pas de dashboard XAI séparé).

### 9.2 Méthodes XAI [MUST]

| Méthode | Bibliothèque | Usage |
|---|---|---|
| **SHAP TreeExplainer** | `shap` | Méthode par défaut pour Decision Tree / Random Forest (exacte et rapide sur les arbres) |
| **SHAP KernelExplainer** | `shap` | Repli pour modèles non-arbres (futur) — background `shap.sample(X_train, 100, random_state=42)` |
| **LIME Tabular** | `lime` | Alternative locale (approximation linéaire locale) — `discretize_continuous=true`, `random_state=42`, 10 features |
| **Importance native (Gini)** | sklearn | Toujours disponible instantanément — TOUJOURS étiquetée « Importance du modèle », jamais « SHAP » (P2) |

**Sélection de méthode** : `auto` (arbre → SHAP Tree ; sinon LIME) ou choix explicite de l'utilisateur. La justification de la sélection est affichée (« SHAP TreeExplainer : exact pour les forêts, 30–300× plus rapide que l'approche générique »).

**Types d'explication** :
- **Globale** : importance moyenne |SHAP| par feature sur un échantillon (n=100, `random_state=42` — P4) ; multiclasse : moyenne des |SHAP| sur les classes (politique `mean_abs`, tracée dans les métadonnées).
- **Locale** (par instance) : contributions par feature pour UNE prédiction ; l'utilisateur choisit l'instance dans un tableau des données de test (avec prédiction vs réalité, tri par erreur) — [rupture v1 : la sélection d'instance devient un vrai parcours serveur, pas un JSON envoyé par le front].
- LIME globale = agrégation de 50 explications locales (moyenne des |poids|), étiquetée comme telle.

### 9.3 KPI de qualité d'explication [MUST — nouveauté v2, la v1 n'en calculait AUCUN]

Affichés dans un bandeau « Fiabilité de l'explication » avec pédagogie :

| KPI | Définition / formule | Interprétation affichée |
|---|---|---|
| **Fidélité locale (LIME)** | R² du modèle linéaire local (le `score` LIME) | « À quel point l'approximation locale reflète le vrai modèle » — vert ≥ 0.8, ambre ≥ 0.5, rouge < 0.5 |
| **Complétude (SHAP)** | Vérification de l'axiome d'efficience : `|Σφᵢ + E[f(X)] − f(x)| / |f(x)| < 1 %` | « Les contributions expliquent-elles 100 % de la prédiction ? » badge ✓/✗ |
| **Stabilité** | Corrélation de Spearman moyenne des rangs d'importance sur 5 ré-échantillonnages (seeds documentés) | « L'explication change-t-elle si on ré-échantillonne ? » ≥ 0.9 très stable / ≥ 0.7 stable / < 0.7 instable |
| **Accord inter-méthodes** [SHOULD] | Corrélation de Spearman entre classement SHAP et classement LIME (top 10) | « Deux méthodes indépendantes racontent-elles la même histoire ? » |
| **Parcimonie** | Nb de features concentrant 80 % de l'importance totale | « L'explication est-elle simple ? » (pénalité pédagogique si > 10 pour un novice) |
| **Temps de calcul** | Durée réelle du job (mesurée, pas hardcodée) | informatif |

Chaque KPI est **réellement calculé** ; si un KPI n'est pas calculable, il est absent (pas de valeur par défaut) — P1.

### 9.4 Graphes XAI [MUST] — données JSON, rendu Recharts

1. **Importance globale** : barres horizontales top 15 (valeur moyenne |SHAP|), tri décroissant, annotations.
2. **Beeswarm/summary simplifié** [SHOULD] : par feature, nuage de points (valeur SHAP en x, couleur = valeur de la feature) — rendu scatter Recharts.
3. **Explication locale « waterfall »** : barres signées (rouge négatif / vert positif) partant de la valeur de base vers la prédiction, top 10 |contributions|, valeur d'instance annotée (`age = 34`).
4. **Comparaison SHAP vs LIME** [SHOULD] : barres groupées des rangs top 10.
5. **Historique des explications** de l'expérience (liste avec méthode, type, date, statut).

### 9.5 Explication textuelle adaptative (LLM) [MUST]

- Génération d'une **explication en langage naturel** des résultats (globale ou locale), adaptée au profil dérivé de l'onboarding :
  - `novice` : analogies du quotidien, zéro jargon, ~180 mots, max 5 features citées ;
  - `intermediate` : structuré décisionnel, ~250 mots ;
  - `expert` : terminologie exacte (axiomes SHAP, OOB, macro-métriques), ~320 mots.
- Langue = langue de l'interface (FR/EN). Température 0 (P4). Le prompt inclut **exclusivement** les vraies métriques/valeurs SHAP (le LLM ne doit jamais inventer un chiffre : instructions + post-validation que les nombres cités existent dans le contexte).
- Sortie : texte + `model_used` + `tokens_used`. Panne LLM → fallback **template déterministe** construit sur les vraies données, badge « généré sans IA » (P2).

### 9.6 Chat XAI [MUST]

- Chat contextuel sur une explication : l'utilisateur pose des questions (« Pourquoi cette variable domine-t-elle ? », « Que se passerait-il si… »), max **5 questions/session**, 500 caractères/question.
- Contexte du prompt : métriques réelles, matrice de confusion, top features, profil utilisateur, historique (10 derniers messages).
- **Totalement asynchrone** (job + SSE/polling — [NE PAS REPRODUIRE] X9 : blocage HTTP 60 s).
- Questions suggérées contextuelles (générées selon la tâche et les résultats) affichées en chips cliquables.

### 9.7 API attendue

```
POST /api/v1/experiments/{id}/explanations      { type: global|local, method: auto|shap|lime, instance_ref? } → job
GET  /api/v1/explanations/{id}                  (statut + progression)
GET  /api/v1/explanations/{id}/results          (valeurs, KPI qualité, données graphes, texte)
GET  /api/v1/experiments/{id}/test-instances    (tableau paginé des instances de test avec préd/réel, pour la sélection locale)
POST /api/v1/explanations/{id}/chat             (créer session) · POST .../chat/{sid}/messages · GET .../chat/{sid}/messages
```

---

## 10. M7 — Dashboard, suivi et annexes

- **Dashboard d'accueil** (`/dashboard`) [MUST] : salutation, 4 tuiles KPI **réelles** (expériences totales, projets actifs, taux de succès des entraînements, durée moyenne), activités récentes (dernières expériences/explications avec statut), actions rapides (Nouveau projet / Explorer les datasets / Reprendre le wizard en cours), projets récents. [NE PAS REPRODUIRE] tuiles mockées.
- **Liste globale des expériences** (`/experiments`) : table TanStack (filtres statut/projet/algo, tri, pagination), badge de statut vivant (les `running` se mettent à jour).
- **Landing publique** (`/`) [SHOULD] : présentation du produit (mission, 3 phases, capture), CTA Connexion/Inscription. Sobre, sans liens morts.
- **Pages d'état** : 404, erreur serveur, maintenance (templates `empty-states`/`error` du kit).
- **Documentation intégrée** [SHOULD] : guide utilisateur (parcours type illustré) et FAQ, en MDX statique.

---

## 11. M8 — Administration

- **Gestion des utilisateurs** [MUST] : table (recherche, tri), détail, changement de rôle, activation/désactivation, recharge de crédits, suppression. Impossible de se rétrograder soi-même si dernier admin.
- **Gestion des datasets** [MUST] : vue de tous les datasets (y compris privés/système), édition, suppression, relance d'analyse de colonnes, statut de complétude des métadonnées.
- **Templates éthiques par domaine** [MUST] : pour chaque domaine (default, education, healthcare, finance, social-media, business, technology…), valeurs par défaut des 10 critères éthiques + niveaux (représentativité, équilibre) appliquées à l'import quand les métadonnées enrichies manquent. CRUD + validation + reset défauts. Stockage en base (pas en YAML sur le filesystem [NE PAS REPRODUIRE]).
- **Supervision des jobs** [SHOULD] : liste des jobs (entraînements, explications, imports) avec statut, durée, file d'attente ; santé du worker et de la file.
- Création du **premier admin** : commande CLI (`ibis create-admin email`) ou variables d'env au premier démarrage — pas d'endpoint public de promotion [NE PAS REPRODUIRE : `/admin/temporary-grant`].

---

## 12. Exigences non fonctionnelles

### 12.1 UX / UI
- **Design system unique** : template `shadcn-ui-kit-dashboard` (Next.js 16, Tailwind 4, shadcn/ui, Radix, lucide-react, Recharts, TanStack Table, react-hook-form + zod). Composants du kit à réutiliser en priorité : `sidebar`, `card`, `table`, `tabs`, `dialog`, `sheet`, `slider`, `select`, `combobox`, `badge`, `progress`, `skeleton`, `sonner` (toasts), `chart` (wrapper Recharts), `timeline`, `empty`.
- **Dark mode** [MUST] (next-themes, déjà dans le template) ; thème clair par défaut.
- **i18n FR/EN** [MUST] : `next-intl`, ZÉRO texte en dur dans les composants ; FR = langue par défaut.
- **Responsive** : desktop d'abord (outil de travail), utilisable en tablette ; le wizard reste lisible à 1280 px.
- **Accessibilité** : composants Radix (focus, ARIA), contrastes AA, navigation clavier du wizard.
- États systématiques : skeleton / erreur avec retry / vide avec action (P5).

### 12.2 Performance
- Catalogue (60 datasets, pagination 24) : < 300 ms côté API.
- Scoring de 100 datasets avec décomposition : < 1 s.
- Aperçu dataset (Parquet ≤ 500 MB) : < 3 s.
- Entraînement des datasets seed : < 2 min typique (worker asynchrone, jamais dans la requête HTTP).
- SHAP TreeExplainer global (100 instances) : < 30 s.

### 12.3 Sécurité
- JWT signé (secret ≥ 256 bits via env), refresh rotation, hash **Argon2id**.
- Contrôle rôle + ownership sur chaque écriture ; rate limiting sur /auth.
- Validation stricte des uploads (extension + contenu, taille max), noms de stockage UUID.
- **Aucun secret dans le repo** ([NE PAS REPRODUIRE] S7 : clé OpenAI committée en v1 — les clés v1 doivent être considérées compromises et régénérées). `.env` non versionné + `.env.example` complet.
- Le backend n'expose que l'API ; les fichiers ne sont servis que via endpoints authentifiés.

### 12.4 Qualité & tests [MUST]
- [NE PAS REPRODUIRE] S9 : 0 % de tests en v1. Cibles v2 :
  - **Unitaires** : formules de scoring (les 12 critères, cas tristate), recommandations de nettoyage, préprocessing (chaque stratégie appliquée réellement), métriques.
  - **Intégration API** : auth/RBAC (matrice §3.2 testée), CRUD, cycle complet expérience (avec petit dataset embarqué), cycle explication.
  - **E2E déterminisme** : deux exécutions du même entraînement + SHAP → résultats **strictement identiques** (P4).
  - **E2E front** (Playwright) : parcours mission complet (inscription → onboarding → projet → scoring → wizard 9 étapes → résultats → explication → chat).
- CI GitHub Actions : lint + typecheck + tests + build images sur chaque PR.

### 12.5 Données seed & démo
- L'instance fraîche doit être **démontrable en 20 min** : `docker compose up` → migrations auto → compte admin seedé → import de 5 datasets prioritaires (iris, student_performance, titanic, pima_diabetes, wine_quality) sans clé Kaggle (fichiers embarqués ou miroir), l'import complet Kaggle (~30) restant une commande admin.

---

## 13. Développement avec le framework Zelian

La v2 sera développée selon le pipeline **Zelian** :
- Ce cahier des charges = matière de la **Phase 1** (vision, personas, périmètre, specs fonctionnelles par module).
- [02-ARCHITECTURE.md](02-ARCHITECTURE.md) = matière de la **Phase 2** — les décisions y sont numérotées pour être formalisées en **ADR** (ADR-001 stack, ADR-002 BDD, ADR-003 auth, ADR-004 worker/jobs, ADR-005 stockage fichiers, ADR-006 bibliothèques IA/XAI, ADR-007 communication temps réel).
- Chaque module M1–M8 donnera une **spec fonctionnelle Zelian** (`docs/specs/<module>/spec-fonctionnel.md`) dérivée des sections 4 à 11, puis sera implémenté module par module (Phase 4) dans l'ordre : M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8.
- Le design s'appuie sur le catalogue de composants du template (`/zelian:design-index` sur le kit shadcn une fois le projet initialisé).

---

## 14. Glossaire

| Terme | Définition |
|---|---|
| **Dataset** | Jeu de données catalogué : métadonnées + 1..n fichiers Parquet + colonnes décrites |
| **Critère éthique** | L'un des 10 booléens tristate issus de la taxonomie Khelifi 2024 |
| **Scoring** | Calcul du score de pertinence pondéré d'un dataset selon les poids utilisateur |
| **Projet** | Conteneur : critères + pondérations + expériences ; support du benchmarking |
| **Expérience** | Un entraînement : config complète + statut + métriques + artefacts |
| **Wizard** | Le parcours guidé en 9 étapes menant à une expérience |
| **Explication** | Résultat XAI (globale ou locale) : valeurs, KPI de qualité, graphes, texte adaptatif |
| **XAI** | Explainable AI — SHAP, LIME, importance native |
| **Tristate** | Booléen à 3 états : `null` (non évalué) / `false` / `true` |
| **P1…P7** | Les 7 principes non négociables (§1.4) |
| **Worker** | Processus asynchrone exécutant entraînements, explications et imports |
