# IBIS-X — Cahier des charges : **« Défis »** (missions guidées gamifiées)

> **Version** : 1.0 — 19 juillet 2026
> **Statut** : Document fondateur d'une nouvelle fonctionnalité. Input principal pour le développement (pipeline Zelian + Superpowers).
> **Documents liés** : [refonte/01-CAHIER-DES-CHARGES.md](../refonte/01-CAHIER-DES-CHARGES.md) (CDC produit v2), [demo-20min.md](../demo-20min.md) (parcours de démo enseignant).
> **Périmètre** : `apps/web` uniquement pour le v1 (feature d'orchestration front). Aucune modification backend obligatoire au v1.

---

## 0. Comment lire ce document

Mêmes conventions que le CDC de la refonte :

- **[MUST]** — exigence obligatoire du premier livrable.
- **[SHOULD]** — fortement recommandé, négociable si coût disproportionné.
- **[V1.1]** — hors périmètre du premier livrable, prévu ensuite.
- **[NE PAS FAIRE]** — piège explicitement interdit.
- Les **7 principes non négociables** du CDC v2 s'appliquent intégralement. Deux sont ici structurants :
  - **P1 — Jamais de données fictives présentées comme réelles.** Une mission produit un **vrai** modèle entraîné sur un **vrai** dataset. Interdit de simuler un résultat.
  - **P5 — Zéro lien mort, zéro promesse non tenue.** Une mission ne guide que vers des routes vivantes du produit.

---

## 1. Contexte, problème, objectif

### 1.1 Le constat (mot d'Anthony)

> « Notre application est censée être utilisée par des étudiants **mais aussi des chercheurs** pour avoir des résultats pour leur papier. Je ne sais pas si mon outil permet de faire ça. J'ai l'impression que ce que j'ai fait ne sert à rien. »

Ce n'est pas un problème de fonctionnalités : le pipeline complet **existe et fonctionne** (catalogue éthique → projet → wizard 9 étapes → entraînement réel → explication XAI adaptative). C'est un problème de **valeur démontrée**.

### 1.2 La vraie cause : le « cold-start » et la valeur enfouie

Un nouvel utilisateur (étudiant **ou** chercheur) arrive sur un **tableau de bord vide**. La valeur du produit — « obtenir un vrai résultat de ML explicable » — est enfouie derrière un wizard de 9 étapes qu'il ne sait pas amorcer. Il ne reste dans le doute :

- l'**étudiant** ne sait pas *par où commencer* ni *à quoi ça sert* ;
- le **chercheur** ne sait pas *si l'outil est assez sérieux* pour produire un résultat citable.

Aucune de ces deux personnes n'a besoin d'une fonctionnalité de plus. Elles ont besoin d'une **première réussite guidée, concrète et réelle**, qui rende la valeur du produit **évidente en quelques minutes**.

### 1.3 Objectif de la feature

> **Offrir une bibliothèque de missions guidées, gamifiées mais crédibles, où l'utilisateur mène une enquête de données réelle de bout en bout — de la question à l'explication — en traversant le vrai pipeline IBIS-X, et repart avec un résultat authentique.**

La feature transforme « je ne sais pas si ça sert à quelque chose » en « **je viens de prédire X avec un vrai modèle et j'ai compris pourquoi** ». C'est la preuve, par la pratique, que l'application **fait des choses réelles**.

### 1.4 Ce que ce n'est PAS (garde-fous)

- **[NE PAS FAIRE]** Un mini-jeu simulé avec de fausses données ou de faux graphiques (viole P1). Chaque mission passe par le **vrai** wizard, le **vrai** worker, la **vraie** XAI.
- **[NE PAS FAIRE]** Un didacticiel-vidéo ou une visite guidée passive (tooltips « suivant, suivant »). L'utilisateur **agit** dans le produit ; il ne regarde pas une démo.
- **[NE PAS FAIRE]** De la gamification enfantine (points, pièces, classements, confettis omniprésents). Le public inclut des chercheurs : la « ludification » se limite à un **objectif clair, une progression lisible et un débrief satisfaisant**.

### 1.5 Deux publics, un même dispositif

| Public | Ce qu'il vient chercher | Comment les Défis le servent |
|---|---|---|
| **Étudiant / novice** | Comprendre le ML sans jargon, réussir une première fois | Missions **niveau 1** ultra-guidées : réussite en < 5 min, narration pédagogique à chaque étape |
| **Chercheur / confirmé** | Vérifier que l'outil produit un résultat sérieux et reproductible | Missions **niveau 3** en autonomie : critères de succès chiffrés, modèle téléchargeable (`.joblib`), explication exportable → « le même geste que pour un papier » |

---

## 2. Nom et vocabulaire

Le mot **« mission »** et le mot **« parcours »** sont **déjà pris** dans le produit : ils désignent le fil narratif du pipeline (*Projet → Dataset → Entraînement → Explication*, cf. `mission-stepper.tsx`, landing « Le parcours, en quatre temps »). Réutiliser ces mots pour la nouvelle page créerait une ambiguïté de navigation.

**Nom retenu (recommandé) :** ★ **« Défis »** (libellé de navigation).
Chaque défi se présente sous forme d'une **enquête** datée et réelle (« Nous sommes le 20 juillet 2026… »).

| Candidat | Pour | Contre |
|---|---|---|
| ★ **Défis** | Court, lisible en nav, gamifié mais mature, distinct de mission/parcours, parle aux 2 publics | Léger accent « compétition » |
| Enquêtes | Colle parfaitement au ton investigatif daté qu'Anthony décrit ; crédible recherche | Moins explicite comme libellé de menu isolé |
| Parcours | Proposé par Anthony ; sens pédagogique (« parcours d'apprentissage ») | Collision avec le fil de mission existant |

> Décision facile à changer : c'est une simple clé i18n (`nav.challenges`). Le reste du document utilise **« Défi »** = une mission ; **« objectif »** = une étape cochable d'un défi.

---

## 3. Concept : le Défi

### 3.1 Anatomie d'un Défi

Chaque défi est structuré en **4 temps** — qui épousent volontairement le fil de mission existant :

1. **Le briefing (l'enquête).** Une mise en situation **datée et à enjeu réel**, dans le ton demandé :
   > *« Nous sommes le 20 juillet 2026. Après deux étés brûlants, un service statistique veut anticiper le décrochage scolaire du trimestre. À partir des données réelles de 395 élèves, peux-tu identifier qui risque d'échouer — et surtout, pourquoi ? »*
   Le briefing annonce : la question, le dataset réel mobilisé, l'enjeu, la récompense (« à la clé : un vrai modèle + une explication »).

2. **Les objectifs.** 3 à 5 objectifs cochables qui **se valident tout seuls** quand l'utilisateur accomplit les **vraies** actions du produit (créer le projet, lancer l'entraînement, générer l'explication…). Jamais de fausse coche.

3. **Le flux réel (guidé selon le niveau).** L'utilisateur est déposé dans le **vrai** produit (catalogue / création de projet / wizard) via des liens profonds, avec un **traceur de quête** persistant qui l'accompagne (cf. §5.3).

4. **Le débrief.** À l'arrivée sur les résultats réels : un encart qui **nomme la réussite** et **fait le pont** :
   > *« Tu viens d'entraîner un vrai arbre de décision sur 395 élèves réels et d'atteindre un F1 de 0,82. Ce résultat est authentique : tu pourrais le citer. La variable la plus décisive est le nombre d'absences — c'est exactement le type de conclusion qu'un chercheur publie. »*

### 3.2 Les 3 niveaux = **degré de guidage** (le mécanisme central)

L'insight clé : **les 3 niveaux ne changent pas le dataset, ils changent la quantité d'aide.** Et ce mécanisme **réutilise l'infrastructure existante** (recommandations déterministes du wizard, motif `AiAssist`, `XaiAudience`).

| Niveau (UI) | Surnom | Guidage | XAI (`XaiAudience`) | Public cible |
|---|---|---|---|---|
| **1 — Novice** | *« Sur les rails »* | Le traceur dicte chaque geste. Les panneaux `AiAssist` sont **ouverts par défaut** ; l'utilisateur clique « Appliquer la recommandation IA » à chaque étape et **voit** un pipeline réussir. | `novice` | Étudiant qui découvre |
| **2 — Débutant** | *« Copilote »* | Le dataset est imposé et la question posée, mais l'utilisateur fait **les choix-clés lui-même** (choisir la cible, trancher entre 2 algos suggérés). `AiAssist` disponible mais **fermé**. | `intermediate` | Étudiant qui progresse |
| **3 — Confirmé** | *« En autonomie »* | Seuls le briefing et un **critère de succès chiffré** sont donnés (« atteins F1 ≥ 0,80, puis explique la variable dominante »). L'utilisateur mène tout seul. Le défi ne fait que **vérifier le résultat**. | `expert` | Chercheur / avancé |

> Mapping technique : *Novice→novice*, *Débutant→intermediate*, *Confirmé→expert* (enum `XaiAudience` déjà présent, `auth/models.py`). Le niveau du défi **suggère** l'audience XAI au moment de générer l'explication, sans écraser la préférence de profil de l'utilisateur.

**[MUST]** Le niveau **1** ne pré-remplit PAS le brouillon par une charge utile construite à la main (fragile). Il s'appuie sur les **recommandations déterministes déjà correctes** du wizard : le traceur invite à cliquer « Appliquer la recommandation IA », panneaux ouverts par défaut. Le pré-remplissage automatique du brouillon (`upsertDraft`) est un **[V1.1]** optionnel.

### 3.3 Ancrage narratif daté & honnêteté des données (le cas « canicule »)

Anthony veut le ton : *« Nous sommes le 20 juillet 2026, les Français veulent savoir s'ils subiront une 3ᵉ canicule… »*. **Ce ton est conservé intégralement.** Mais un point de vérité :

> **Il n'existe aucun dataset météo/climat dans le seed** (`seed_data/datasets.yaml` : iris, student_performance, titanic, pima_diabetes, wine_quality_red, penguins). Prédire une canicule **exigerait** un vrai jeu de données climatique. Fabriquer un faux dataset « canicule » violerait P1.

Deux réponses, **cumulables** :

- **[MUST] v1** — On garde **l'énergie narrative datée et à enjeu national/humain**, mais branchée sur les **6 datasets réels** qui fonctionnent de bout en bout (§4). Un briefing peut tout à fait s'ouvrir sur l'actualité (« Été 2026, on parle santé publique… ») puis enchaîner sur le dataset Pima Diabetes, réel et jouable.
- **[V1.1]** — Ajouter **un** vrai dataset climat/météo public et vérifiable (ex. jeu tabulaire « pluie demain » ou séries de températures d'une source ouverte type Météo-France / UCI), avec une cible que le pipeline sait traiter (classification ou régression). Cela **débloquerait une enquête météo authentique**. Documenté comme extension seed (`datasets.yaml` + `enriched/*.json`), hors périmètre v1.

---

## 4. Le catalogue de missions v1 (6 datasets réels → 6 enquêtes)

**[MUST]** Chaque défi est adossé à un dataset **réellement seedé** et à une tâche que le pipeline **sait exécuter**. Aucune invention.

| # | Dataset (slug) | Domaine | Tâche | Enquête (titre & pitch daté) | Niveau | Objectifs (cochables sur vraies actions) | Débrief / pont |
|---|---|---|---|---|---|---|---|
| 1 | `titanic` | social | classification | **« 1912 : qui a survécu, et pourquoi ? »** — Rejoue le naufrage le plus étudié de la data science : classe, sexe, âge décidaient-ils du sort ? | **Novice** | Ouvrir la fiche → créer le projet → lancer l'entraînement → lire le résultat | « Ton modèle a appris un **biais social réel** de 1912. La XAI le montre : c'est le cœur de l'IA explicable. » |
| 2 | `penguins` | biology / environment | classification | **« Terrain en Antarctique : quelle espèce ? »** — Un biologiste n'a qu'un mètre-ruban et une balance. Peux-tu identifier l'espèce sans la voir ? | **Novice** | idem + observer la matrice de confusion 3 classes | « 3 espèces, une matrice de confusion lisible : tu vois **où** le modèle se trompe. » |
| 3 | `student_performance` | education | classification | **« Été 2026 : qui risque de décrocher ? »** — 395 élèves réels. Aide un enseignant à repérer tôt les élèves fragiles. | **Débutant** | Choisir la cible soi-même + trancher l'algo + entraîner + expliquer | « La variable dominante (absences ?) est **actionnable** — exactement ce qu'un chercheur publie. » |
| 4 | `pima_diabetes` | healthcare | classification | **« Dépister le diabète avant qu'il ne parle »** — Une clinique veut un signal d'alerte précoce. Où se cache le risque ? | **Débutant** | idem + générer une explication **locale** sur un cas patient | « Explication **locale** = pourquoi CE patient ? L'enjeu médical rend la XAI indispensable. » |
| 5 | `wine_quality_red` | business | **régression** | **« Noter un vin sans le goûter »** — Une cave veut prédire la qualité à partir de la seule chimie. Fiable ou pas ? | **Confirmé** | Autonomie totale : atteindre R² ≥ seuil, puis expliquer | « Un problème de **régression** réel, métriques R²/MAE authentiques, modèle téléchargeable. » |
| 6 | `iris` | biology | classification | **« Le hello-world de la data science »** — Le jeu de 1936 de Fisher : trois iris, quatre mesures. Bac à sable / speed-run. | **Confirmé** (rapide) | Reproduire un classifieur quasi parfait en autonomie | « La référence historique : idéal pour comparer deux algos (fonction *comparer* du produit). » |

> **[SHOULD]** Regrouper la bibliothèque **par niveau** (Novice → Débutant → Confirmé), teintée par la **couleur de domaine** de chaque dataset (`domain-visuals.ts`, motif `DomainPattern`).
> **[V1.1]** Enquête météo/canicule (cf. §3.3) une fois un dataset climat seedé ; variante **régression** de `student_performance` (prédire la note G3) pour un défi confirmé supplémentaire.

---

## 5. Parcours utilisateur & écrans

### 5.1 `/challenges` — la bibliothèque (**[MUST]**)

- Route : `app/(app)/challenges/page.tsx`, dans le groupe `(app)` (sidebar + header IbisX). Nouvelle entrée de nav `nav.challenges` dans `MAIN_NAV` (`nav-config.ts`), icône dédiée (ex. `SwordsIcon` / `FlagIcon` / `CompassIcon`).
- Contenu : en-tête pédagogique (« Entraîne-toi sur des cas réels ») + **grille de cartes de défi**, groupées par niveau, chaque carte affichant : titre de l'enquête, dataset, domaine (couleur/motif), tâche, badge de niveau, **état de progression** (à faire / en cours / terminé), estimation de durée.
- Bandeau de progression global (« 2 / 6 défis relevés », anneau `ProgressRing` réutilisé), sobre.
- **[MUST]** Zéro carte morte : une carte = un défi réellement jouable.

### 5.2 `/challenges/[slug]` — le briefing (hub de quête) (**[MUST]**)

- Route : `app/(app)/challenges/[slug]/page.tsx`.
- Contenu : le **briefing narratif daté**, la liste des **objectifs**, le **dataset mobilisé** (mini-fiche + lien vers `/datasets/[id]`), le **niveau** et ce qu'il implique (guidage), et le bouton **« Démarrer l'enquête »**.
- Au clic « Démarrer » → active le traceur de quête (§5.3) et **dépose l'utilisateur au bon endroit du vrai produit** selon le niveau (§6.3).

### 5.3 Le traceur de quête (overlay persistant) (**[MUST]**)

Le cœur de l'orchestration. Quand un défi est **actif**, un **bandeau/traceur discret et persistant** chevauche les vraies pages du parcours (fiche dataset, création de projet, wizard, résultats), réutilisant le **langage visuel du `MissionStepper`** :

- Affiche : le **titre du défi**, l'**objectif courant** (« Étape 2 : choisis la colonne à prédire »), la progression des objectifs, et un contrôle **« Quitter le défi »**.
- Pour le **niveau 1**, il porte une **micro-consigne de coach** par étape (« clique *Appliquer la recommandation IA* »).
- Il **coche les objectifs automatiquement** en observant les vraies transitions (projet créé, expérience lancée, expérience *succeeded*, explication générée — cf. §6.4).
- Implémentation : composant monté dans le layout `(app)` **et** dans le wizard plein écran, piloté par un store léger + le paramètre d'URL `?challenge=<slug>` (§6.2). Masqué si aucun défi actif. `prefers-reduced-motion` respecté.

### 5.4 Le débrief (**[MUST]**)

- Déclenché quand le **dernier objectif** est atteint (typiquement : arrivée sur `/experiments/[id]` avec expérience *succeeded*, + explication pour les niveaux ≥ 2).
- Rendu **dans la page de résultats réelle** (encart), pas dans une fenêtre à part : le débrief commente les **vraies métriques** affichées. Réutilise le motif « pédagogie visuelle » / `AiAssist`.
- Contient : la phrase de réussite, le **pont recherche/réel**, et 2 actions : **« Défi suivant »** et (niveau 3) **« Télécharger le modèle »** (bouton `.joblib` déjà présent) + rappel de l'export d'explication.

---

## 6. Architecture technique

Principe directeur : **une feature d'orchestration, pas un nouveau sous-système.** Les Défis *pilotent* des flux backend qui existent déjà. Isolation nette, aucune donnée mockée.

### 6.1 Contenu des défis — catalogue typé côté front + i18n (**[MUST]**)

- Définitions statiques et typées dans `lib/challenges/catalog.ts` : `Challenge = { slug, level, datasetSlug, taskType, domain, objectives: ObjectiveKey[], entryMode }`.
- Tout le **texte** (briefing, objectifs, débrief) vit dans les fichiers i18n (`messages/fr.json`, `messages/en.json`) sous un namespace `challenges` — **jamais** de chaîne en dur (le produit est bilingue FR/EN).
- **[NE PAS FAIRE]** Table backend pour les définitions de défis au v1 : c'est du contenu éditorial front, versionné avec le code.

### 6.2 Store de quête + paramètre d'URL (**[MUST]**)

- Store Zustand `lib/challenges/store.ts` (même patron que `lib/wizard/store.ts`) : `{ activeSlug, completedObjectives, start(slug), completeObjective(id), quit() }`.
- Le paramètre d'URL `?challenge=<slug>` **porte l'état à travers les navigations** (y compris vers le wizard plein écran, hors `(app)`), pour que le traceur sache quel défi est actif après un rechargement.

### 6.3 Le wiring (liens profonds — déjà supportés par le produit) (**[MUST]**)

Aucune nouvelle API. On réutilise les points d'entrée existants :

| Niveau | « Démarrer » dépose sur… | Mécanisme réel réutilisé |
|---|---|---|
| **1 Novice** | `/datasets/[id]?challenge=slug` puis coaching pas-à-pas via le traceur ; les recos du wizard font le pré-remplissage | Fiche dataset + « Utiliser dans un projet » |
| **2 Débutant** | `/projects/new?datasetId=…&datasetName=…&challenge=slug` (mode **DIRECT** existant : saute critères + pondérations) | `projects/new` mode direct (commit récent) |
| **3 Confirmé** | `/datasets` ou `/datasets/[id]?challenge=slug`, l'utilisateur conduit tout | Catalogue |

- **[V1.1]** Niveau 1 « zéro clic » : pré-seed du brouillon via `upsertDraft` (cible/algo/preset) puis `/wizard?...` directement. Nécessite de construire un `draft_state` valide (`serializeDraft`) — reporté car plus fragile.

### 6.4 Détection de progression (événements réels) (**[MUST]**)

Les objectifs se cochent sur des **signaux réels**, pas sur des clics factices :

- *Projet créé* → détecté à la redirection post-`createProject`.
- *Entraînement lancé / terminé* → statut d'expérience (SSE / polling déjà en place sur la page résultats).
- *Explication générée* → présence d'un résultat XAI (`listExplanations` / `getExplanationResults`).
- **Complétion du défi** = arrivée sur `/experiments/[id]` avec expérience `succeeded` (+ explication pour niveaux ≥ 2). Robuste et vérifiable.

### 6.5 Persistance de la progression (**[MUST]** v1 : local ; **[V1.1]** : backend)

- **v1 — `localStorage`** (`ibis:challenges:progress`) : défis terminés + objectifs. Zéro migration, zéro endpoint, on livre vite. Conforme P1 (c'est la **vraie** progression de l'utilisateur ; la preuve ultime reste l'expérience réelle visible dans `/experiments`).
- **[V1.1] — table `challenge_progress`** (durable, multi-appareils) : permet d'exposer « piste Confirmé complétée » comme quasi-certification pour un chercheur. Reporté.

### 6.6 Réutilisation du design system (« template intouchable ») (**[MUST]**)

Composer **uniquement** avec les tokens et composants existants (jamais de primitive nue, cf. mémoire *design riche*) :

- `MissionStepper` (langage visuel du traceur), `ProgressRing` (progression), `AiAssist` (coaching niveau 1 et débrief — motif IA unifié), `DomainPattern` + `domain-visuals.ts` (teinte par domaine), `StatTile`, `Card`, `Badge`.
- Motif « pédagogie visuelle » (EducIA) partout dans le briefing/débrief, comme demandé.
- Aucune couleur hors tokens ; `--ai` réservé aux blocs IA ; charts monochromes `chart-N`.

---

## 7. Internationalisation (**[MUST]**)

- Nouveau namespace `challenges` dans `messages/fr.json` **et** `messages/en.json` (le produit est strictement bilingue, tests e2e mission FR/EN existants).
- Clé de nav `nav.challenges`.
- Aucune régression sur les namespaces existants.

---

## 8. Hors périmètre v1 (YAGNI) & extensions

**Hors v1 :**
- **[V1.1]** Dataset + enquête météo/canicule (§3.3).
- **[V1.1]** Persistance backend de la progression + certification de piste (§6.5).
- **[V1.1]** Pré-seed automatique du brouillon niveau 1 (§6.3).
- **[V1.1]** Export « rapport de mission » (méthodologie + métriques + explication) en PDF/Markdown — vrai livrable recherche.
- **[V1.1]** Badges/récompenses (crédits offerts à la complétion) — évité au v1 pour ne pas coupler à la facturation ni glisser vers le « grind ».

**[NE PAS FAIRE]** — Classements/leaderboards, avatars, mécaniques de streak quotidien : hors ton produit.

---

## 9. Découpage en lots (implémentation)

1. **Lot A — Fondations** : namespace i18n `challenges`, catalogue typé `lib/challenges/catalog.ts` (6 défis), store Zustand, entrée de nav. *Livrable : la bibliothèque `/challenges` s'affiche avec 6 cartes réelles.*
2. **Lot B — Briefing & lancement** : page `/challenges/[slug]`, wiring des liens profonds par niveau (§6.3). *Livrable : « Démarrer » dépose au bon endroit du vrai produit.*
3. **Lot C — Traceur de quête** : overlay persistant (layout `(app)` + wizard), détection de progression réelle (§6.4), coaching niveau 1. *Livrable : les objectifs se cochent sur vraies actions.*
4. **Lot D — Débrief & progression** : encart débrief dans la page résultats, persistance `localStorage`, écran « Défi suivant ». *Livrable : boucle complète d'un défi.*
5. **Lot E — Finition** : les 6 enquêtes rédigées (FR/EN), polish visuel (domaines, motifs, `AiAssist`), état vide, `prefers-reduced-motion`, responsive.

Chaque lot suit le TDD Superpowers là où la logique le justifie (store, détection de progression, catalogue).

---

## 10. Critères d'acceptation (definition of done)

- **[MUST]** Depuis un compte neuf, un utilisateur ouvre `/challenges`, choisit **« 1912 : qui a survécu ? »** (niveau 1), et arrive sur une page de résultats avec un **vrai modèle entraîné** et une **explication réelle**, guidé de bout en bout — sans jamais quitter le vrai produit.
- **[MUST]** Les objectifs ne se cochent que sur de **vraies** actions (P1). Aucune coche factice.
- **[MUST]** Un défi **niveau 3** peut être relevé **en autonomie** par un utilisateur avancé, avec un critère de succès chiffré, et se conclut par un modèle **téléchargeable**.
- **[MUST]** FR **et** EN complets ; aucune chaîne en dur ; aucun lien mort.
- **[MUST]** Le design n'introduit **aucune** primitive nue ni couleur hors tokens ; le template reste intouché.
- **[SHOULD]** La bibliothèque groupe par niveau et teinte par domaine ; la progression persiste entre deux visites.

---

## 11. Options considérées (traçabilité de la décision)

| Approche | Description | Verdict |
|---|---|---|
| **A — Orchestration du vrai pipeline** (retenue) | Les défis pilotent les flux existants via liens profonds + traceur ; résultats 100 % réels. | ★ **Retenue.** Seule option qui prouve « ça fait des choses réelles » (P1) et réutilise l'infra. |
| B — Mini-jeu simulé autonome | Une sandbox gamifiée avec datasets/résultats simulés, découplée du produit. | Rejetée : viole P1, ne prouve rien, dette de contenu. |
| C — Simple visite guidée (tooltips) | Un overlay « suivant/suivant » par-dessus l'UI actuelle. | Rejetée : passif, ne crée pas de réussite réelle, pas de valeur recherche. |

**Recommandation** : livrer **A** par les lots A→E, `localStorage` au v1, puis prioriser les extensions **[V1.1]** selon retours (météo, export rapport, persistance backend).
