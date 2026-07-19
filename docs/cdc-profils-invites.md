# Cahier des charges — Personnalisation d'IBIS-X pour les invité·e·s de la démo

**Contexte.** Démonstration d'IBIS-X devant quatre profils identifiés de l'Université Paris 1 Panthéon-Sorbonne / IMT Mines Albi. Objectif : que **chacune se dise « cette plateforme est faite pour moi »**. Ce document présente (1) la lecture de leurs profils publics, (2) ce qu'elles testeront vraisemblablement en premier, (3) les datasets réels ajoutés pour elles, (4) les fonctionnalités mobilisées (existantes) et créées, (5) la feuille de route.

> **Méthode.** Analyse des pages personnelles / profils publics fournis (publications, projets IA, domaines d'expertise). Aucune donnée personnelle privée n'a été utilisée : uniquement les axes de recherche déclarés publiquement. Tous les datasets ajoutés sont **réels** (OpenML / UCI), conformes au principe non négociable d'IBIS-X : *jamais de donnée inventée présentée comme réelle*.

---

## 1. Livré et vérifié (session du 19/07/2026)

| Élément | Détail | Vérification |
|---|---|---|
| **4 datasets réels** ajoutés au seed | CPS 1985, MAGIC gamma, Efficacité énergétique, Décrochage étudiant | Schéma Pydantic `DatasetMetadataInput` ✔ · profilage CSV ✔ (0 PII) |
| **4 missions dédiées** (Défis) | Une par invité·e, adossée à son dataset | i18n FR/EN paritaire ✔ · `catalog.test` ✔ |
| **Parcours de formation** (cursus) | 3 cursus regroupant les 12 missions (AI Sorb) | `curriculum.test` ✔ |
| **Fiches compétences** par mission | 8 compétences, approche par compétences | test compétences ✔ |
| **Comparateur d'équité** par attribut sensible | Onglet « Équité » : métriques par groupe (parité, égalité des chances, règle des 80 %) | `test_fairness` (unit + intégration) ✔ · build ✔ |
| Suite de tests | Backend + web | **192 pytest + 60 vitest verts** |

Fichiers touchés : `apps/api/seed_data/*`, `apps/api/ibis/modules/{ml/preprocessing.py, xai/*}`, `apps/web/lib/challenges/{catalog,curriculum,progress,types}.ts`, `apps/web/components/ibis/{challenges,fairness}/*`, `apps/web/app/(app)/{challenges,experiments}/…`, `apps/web/messages/{fr,en}.json`, `apps/web/lib/api/` (client régénéré).
Activation en démo : `docker compose exec api ibis seed` (idempotent) → catalogue à **28 datasets**, **12 missions**, **3 cursus** ; l'onglet **Équité** apparaît sur toute page de résultats de classification.

---

## 2. Anne-Sophie Bruno — Maître de conférences en histoire (CHS)

**Preuve de recherche (public).** Historienne quantitative du travail, des migrations et des **inégalités femmes-hommes**. Article fondateur : *« Analyser les écarts de salaires à l'aide des modèles de régression »* (Histoire & Mesure, 2010). Base **CAGE** (évaluer la lutte contre les inégalités F-H en entreprise, 2024). Projets IA : reconnaissance de caractères manuscrits, **catégorisation**, et **analyse de données textuelles** (normes de genre dans les accords d'entreprise et les offres d'emploi).

**Ce qu'elle testera en premier.** Elle cherchera un jeu lié au **travail / salaires / genre**. En historienne des sources, elle scrutera d'abord **provenance, représentativité et valeurs manquantes**. Elle voudra faire une **régression** et voir si le **sexe** pèse à caractéristiques comparables — et sera attentive au piège **corrélation ≠ causalité**.

**Dataset ajouté → « Salaires et genre — CPS 1985 »** (`cps_wages_1985`, 534 individus). Régression du salaire horaire sur diplôme, expérience, secteur, syndicat, **sexe**. C'est **littéralement l'exercice de son article de 2010**. Déjà présents et pertinents : Adult Census Income, Contraception, Titanic (inégalités sociales).

**Fonctionnalités qui la font « wow ».**
- **Régression + explicabilité SHAP** : chiffrer le poids réel du sexe, toutes choses égales par ailleurs — son geste de recherche, sans code.
- **Garde-fou « association ≠ causalité »** sous l'importance des variables : la rigueur qu'elle exige.
- **Regards métier → l'Historien·ne** (+ Sociologue, Économiste) : relire les mêmes chiffres selon la discipline.
- **Scoring éthique** : le CPS est signalé sur `equity_non_discrimination` (attributs sensibles) → ouvre la discussion sur le biais.
- **Fiche dataset honnête (tristate)** : représentativité, équilibre F/H (289/245), valeurs manquantes — le langage d'une historienne des sources.
- ✚ **Mission créée : « 1985 : à travail égal, salaire égal ? »**.

---

## 3. Axelle Gottafray — Ingénieure de recherche informaticienne (IMT Mines Albi)

**Preuve de recherche (public).** Ex-CNRS sur la mission **JUICE** (JUpiter Icy Moons Explorer) : pipeline de commande du **spectromètre imageur MAJIS** (Python, Apache Airflow, Docker). Exigence forte de **qualité logicielle** : git, tests, intégration continue, documentation. Ex-*online programmer* chez Ubisoft. Data engineering, FastAPI, SQL.

**Ce qu'elle testera en premier.** La **robustesse technique** : reproductibilité (`random_state=42`), le **contrat OpenAPI / client TypeScript généré**, l'**upload CSV + profilage**, le worker Celery, le **modèle téléchargeable** (`.joblib`). Elle appréciera un jeu d'**astrophysique** et testera les limites (volume, multi-classe).

**Dataset ajouté → « MAGIC — Télescope à rayons gamma »** (`gamma_telescope`, 10 000 événements). Séparer un **signal gamma** cosmique du bruit hadronique à partir de paramètres d'images Cherenkov : **clin d'œil direct à JUICE/MAJIS** (détection de signal en astrophysique instrumentale). Déjà présents : Handwritten Digits, Ionosphere (écho radar).

**Fonctionnalités qui la font « wow ».**
- **Reproductibilité affichée** (seed=42) + **KPI de fiabilité mesurés** (complétude, **stabilité inter-seeds**, parcimonie) : du concret, pas du vernis.
- **Modèle exportable `.joblib`** : elle rejoue le résultat hors plateforme.
- **Import CSV + profilage + détection PII** : elle testera son propre fichier.
- **Architecture honnête / repli déterministe explicite** (sans clé LLM → fallback marqué) : l'ingénieure respecte.
- **Page `/status` (SSE temps réel)** + **docs OpenAPI** `/api/v1/docs` : elle ira voir la santé système.
- ✚ **Mission créée : « Un rayon gamma, ou juste du bruit ? »**.

---

## 4. Margaux Cognard — Responsable formations & communication, projet AI Sorb (Paris 1)

**Preuve de recherche (public).** EU Affairs, **IA & Éducation**, communication stratégique. Porte les **formations du projet AI Sorb / Collège de l'IA** (former aux humanités numériques). Thèmes : **égalité de genre**, **durabilité / économie circulaire** (thèse sur le textile), éducation, innovation. Profil **non technique** ; productrice du podcast *Euroïnes*.

**Ce qu'elle testera en premier.** L'**accessibilité pour non-codeur** : peut-elle obtenir un vrai résultat **sans écrire de code** ? La **clarté pédagogique**, le storytelling, l'onboarding. Sensible au **design**, à l'**inclusion** et à la **durabilité**. Elle jugera si l'outil peut nourrir une **formation** (AI Sorb).

**Dataset ajouté → « Efficacité énergétique des bâtiments »** (`energy_efficiency`, 768 configurations). Prédire les besoins de chauffage/climatisation d'un bâtiment selon sa forme et son enveloppe : **durabilité et conception sobre**, concret et parlant. Déjà présents : Student Performance (éducation), Auto MPG (consommation).

**Fonctionnalités qui la font « wow ».**
- **Wizard guidé en 8 étapes + recommandations IA** : elle réussit un modèle **sans expertise**.
- **Défis / missions guidées** : un format **pédagogique clé-en-main** directement réutilisable pour AI Sorb.
- **Onboarding / calibration par profil** : accueil adapté au niveau novice.
- **Copilote d'explication (chat XAI)** : l'IA explique en **langage clair**.
- **Guide éducatif du dataset** (« Comment utiliser ce jeu ? »).
- **i18n FR/EN complet** : dimension européenne / diffusion.
- ✚ **Mission créée : « Concevoir un bâtiment sobre en énergie »**.

---

## 5. Éléonore Mavraki — Professeur agrégé, Service usages numériques (DSIUN)

**Preuve de recherche (public).** Domaines déclarés : **pédagogie numérique**, **intelligence artificielle**, **biais cognitifs**, **pédagogie et inclusion**, **approche par compétences**, méthodologie du travail universitaire. Travaux sur l'accompagnement pédagogique des enseignant·e·s-chercheur·se·s.

**Ce qu'elle testera en premier.** La **valeur pédagogique** : l'outil **enseigne-t-il** ? Met-il en évidence les **biais** (cognitifs et algorithmiques) ? Respecte-t-il l'**inclusion** (accessibilité, non-stigmatisation) et une **progression par compétences** ? Elle éprouvera l'explicabilité comme **support de cours**.

**Dataset ajouté → « Décrochage et réussite étudiante »** (`student_dropout`, 4 424 étudiant·e·s). Prédire décrochage / persévérance / diplôme à partir du parcours et de variables **sensibles** (genre, nationalité, bourse, besoins particuliers) : **cas d'école du biais** et de l'**inclusion**. Déjà présents : Adult Income, German Credit (audit de biais).

**Fonctionnalités qui la font « wow ».**
- **Défis à 3 niveaux (novice → confirmé)** : une **approche par compétences** littérale.
- **Copilote XAI + explication adaptée au profil** (SHAP/LIME, global + local) : un **support pédagogique** vivant.
- **Missions « équité »** (revenus, crédit, décrochage) : enseigner le **biais algorithmique** sur de **vrais** modèles.
- **Garde-fou « association ≠ causalité »** : un anti-biais cognitif intégré au produit.
- **Honnêteté tristate** (jamais de donnée inventée, repli marqué) : une leçon de **littératie des données**.
- ✚ **Mission créée : « Décrochage à l'université : repérer sans stigmatiser »** (inclusion).

---

## 6. Tableau de synthèse

| Invité·e | Axe de recherche | Testera d'abord | Dataset ajouté | Effet « wow » |
|---|---|---|---|---|
| **A.-S. Bruno** | Inégalités salariales F-H, histoire quantitative | Provenance, régression, poids du sexe | **Salaires & genre — CPS 1985** | Réplique son article de 2010, sans code |
| **A. Gottafray** | Astrophysique instrumentale, data engineering | Repro, OpenAPI, upload, `.joblib` | **MAGIC — Télescope gamma** | Détection de signal, écho de JUICE/MAJIS |
| **M. Cognard** | IA & éducation, durabilité (AI Sorb) | Résultat sans code, pédagogie, design | **Efficacité énergétique bâtiments** | Un cursus clé-en-main pour AI Sorb |
| **É. Mavraki** | Pédagogie, biais cognitifs, inclusion | Valeur pédago, mise en évidence des biais | **Décrochage & réussite étudiante** | Enseigner le biais sur de vrais modèles |

---

## 7. Feuille de route

### 7.1 Livré dans cette session (exécution du CdC)
- ✅ **Comparateur de métriques d'équité** par attribut sensible (parité démographique, taux de vrais positifs, règle des 80 %) — onglet « Équité » sur la page de résultats, calcul backend reproductible (`random_state=42`), sans toucher au worker d'entraînement. **Bruno + Mavraki.**
- ✅ **Parcours de formation** (3 cursus enchaînant les missions) — **Cognard / AI Sorb.**
- ✅ **Fiches compétences** par mission (approche par compétences, 8 compétences) — **Mavraki.**

### 7.2 Reste à faire (non codé — pour aller plus loin)
- **Transverse** — **export d'un rapport** partageable (PDF) à la fin d'une mission.
- **Bruno** — Mode **corpus textuel / NLP** (normes de genre dans les accords/offres d'emploi : hors périmètre tabulaire actuel) ; dataset **migrations / immigration** (à construire, éthiquement propre).
- **Gottafray** — **SDK/API Python** pour piloter le pipeline depuis un notebook ; badge de **reproductibilité** exposé sur `/status`.
- **Cognard** — davantage de datasets **durabilité / indicateurs UE**.
- **Mavraki** — module pédagogique **« biais cognitifs »** (faire deviner le biais avant de le révéler).

---

## 8. Annexe — comment le montrer en démo

1. `docker compose exec api ibis seed` → les 4 nouveaux jeux apparaissent dans `/datasets`.
2. Filtrer le catalogue par domaine (*social*, *technology*, *environment*, *education*) pour retrouver chaque dataset devant son invité·e.
3. Ouvrir `/challenges` : les 4 missions dédiées sont dans les niveaux *débutant* et *confirmé*.
4. Dérouler une mission de bout en bout (dataset → projet → entraînement → **explication XAI**) pour l'invité·e concerné·e.
