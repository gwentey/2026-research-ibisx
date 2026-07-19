# IBIS-X — Cahier des charges : **« Apprendre »** (l'Académie IA)

> **Version** : 1.0 — 19 juillet 2026
> **Statut** : Document fondateur d'une nouvelle fonctionnalité. Input principal pour le développement (pipeline Zelian + Superpowers).
> **Auteur** : cahier des charges rédigé à la demande d'Anthony (« une page formation / apprendre pour enfin comprendre et se servir de l'IA, avec de vrais cours du novice au confirmé et un système de niveaux »).
> **Documents liés** : [parcours/CAHIER-DES-CHARGES.md](../parcours/CAHIER-DES-CHARGES.md) (CDC « Défis »), [audit-valeur-recherche.md](../audit-valeur-recherche.md) (les 60 idées pour servir un chercheur), [refonte/01-CAHIER-DES-CHARGES.md](../refonte/01-CAHIER-DES-CHARGES.md) (CDC produit v2), [refonte/02-ARCHITECTURE.md](../refonte/02-ARCHITECTURE.md).
> **Périmètre** : `apps/web` en priorité (feature d'orchestration front, comme les Défis). Un module backend `formation` est **optionnel** et repoussé en [V1.1] (progression serveur, comptes classe). Aucun changement backend obligatoire au v1.

---

## 0. Comment lire ce document

Mêmes conventions que les CDC « refonte » et « Défis » :

- **[MUST]** — exigence obligatoire du premier livrable.
- **[SHOULD]** — fortement recommandé, négociable si coût disproportionné.
- **[V1.1]** — hors périmètre du premier livrable, prévu ensuite.
- **[V2]** — vision long terme, notée pour ne pas être oubliée.
- **[NE PAS FAIRE]** — piège explicitement interdit.
- Les **7 principes non négociables** du CDC v2 s'appliquent intégralement. Trois sont ici structurants :
  - **P1 — Jamais de données fictives présentées comme réelles.** Un playground pédagogique est **toujours étiqueté « illustration »** ; la seule « vraie » pratique passe par le pipeline réel (Défis + wizard). Voir [§13](#13-ce-quil-ne-faut-pas-faire-garde-fous).
  - **P5 — Zéro lien mort, zéro promesse non tenue.** Une leçon ne renvoie « en pratique » que vers une route **vivante** du produit. Enseigner un concept que l'outil ne sait pas encore exécuter est permis — le **prétendre exécutable** ne l'est pas.
  - **P6 — Un seul langage graphique.** Aucune couleur inventée : uniquement les tokens (`--primary`, `--muted`, `chart-N`, `--score-N` réservé aux scores, `--ai` réservé à l'IA). Aucune primitive nue : on compose avec le kit `ibis/*`.

> **Ce document décrit une plateforme complète.** Tout n'est pas à livrer en bloc. La [§11 feuille de route](#11-priorisation--feuille-de-route) trie en 4 vagues. Le [§4 curriculum](#4-le-curriculum-complet-tous-les-cours) est écrit en entier pour fixer la cible pédagogique, même si les vagues 3–4 arrivent plus tard.

---

## 1. Contexte, problème, objectif

### 1.1 Le constat (mot d'Anthony)

> « Pour les novices, l'IA c'est ChatGPT — alors que non ! Il faut une vraie plateforme de formation pour comprendre et enfin se servir de l'IA, entraîner nos modèles, et surtout savoir à quoi ça sert. Des vrais cours, tout un système de niveaux. »

### 1.2 La vraie cause : deux fossés

IBIS-X sait déjà faire des choses réelles (catalogue éthique → wizard 9 étapes → entraînement reproductible → XAI adaptative → Défis guidés). Mais deux fossés empêchent le novice d'en tirer parti :

1. **Le fossé de représentation.** Le novice croit que « IA = ChatGPT = une IA qui parle ». Il ne soupçonne pas qu'il existe une **IA prédictive**, qu'on **entraîne un modèle sur des données**, ni **à quoi ça sert**. Tant que cette confusion tient, IBIS-X lui paraît étrange : « pourquoi je choisis un dataset ? où est la zone de discussion ? ».
2. **Le fossé théorie ↔ pratique.** Les Défis font *agir* l'utilisateur (« clique ici, applique la reco IA »), mais ne lui apprennent pas *le pourquoi*. Il réussit une mission sans comprendre ce qu'est un F1, un sur-apprentissage, une matrice de confusion. La compréhension reste enfouie.

### 1.3 Objectif de la feature

> **Offrir une académie intégrée où l'on apprend l'IA — la vraie, pas seulement ChatGPT — par des cours clairs, visuels et interactifs, organisés en niveaux du novice absolu au confirmé, chaque notion se soldant par une mise en pratique réelle dans le pipeline IBIS-X.**

La promesse de bout en bout, tenue littéralement :

> *« Tu arrives en pensant que l'IA, c'est ChatGPT. Tu repars en ayant entraîné, évalué et expliqué **ton propre modèle** — et en sachant dire pourquoi il décide, et où il se trompe. »*

### 1.4 La place de « Apprendre » dans le produit : le triptyque

La Formation n'est pas une île. Elle referme le triangle du produit :

| Surface | Verbe | Rôle | Existe ? |
|---|---|---|---|
| **Apprendre** (cette feature) | *Comprendre* | Les concepts, en visuel et interactif, du novice au confirmé | À construire |
| **Défis** (`/challenges`) | *Pratiquer* | Appliquer sur de vrais datasets, via le vrai pipeline | ✅ Livré |
| **Audit-recherche** ([doc](../audit-valeur-recherche.md)) | *Approfondir / publier* | La feuille de route qui rend l'outil citable (CV, IC, fairness, causalité) | 📋 Roadmap |

**Le fil est bidirectionnel** : une leçon envoie « passe à la pratique » vers un Défi ; un Défi qui bute renvoie « tu ne sais pas ce qu'est un F1 ? » vers la leçon. Chaque module de l'audit-recherche livré (ex. B1 validation croisée) débloque une leçon *pleinement praticable* (voir [§4.4](#44-cursus-3--analyste--rigueur-éthique-et-recherche) et [§11](#11-priorisation--feuille-de-route)).

### 1.5 Ce que ce n'est PAS (garde-fous d'intention)

- **[NE PAS FAIRE]** Un empilement de vidéos ou de longs pavés de texte à lire passivement. On **comprend en manipulant** (playgrounds, quiz, pont vers le vrai produit).
- **[NE PAS FAIRE]** Un cours de maths. Zéro dérivée, zéro somme grecque en page d'accueil d'une leçon novice. L'intuition d'abord ; la formule est un [SHOULD] optionnel replié (« pour aller plus loin »).
- **[NE PAS FAIRE]** Un MOOC déconnecté du produit. Chaque cursus **atterrit dans IBIS-X** : le labo de la formation, c'est le vrai pipeline.
- **[NE PAS FAIRE]** De la gamification enfantine (pièces, confettis, classements de compétition). Le public inclut des chercheurs : la ludification reste **mature** — grades, badges de compétence, passeport, progression lisible (voir [§8](#8-progression-grades--gamification-mature)).
- **[NE PAS FAIRE]** Simuler une capacité que l'outil n'a pas (P1). On peut *enseigner* la causalité ; on ne prétend pas qu'IBIS-X l'exécute tant que C1 de l'audit n'est pas livré.

### 1.6 Deux publics, un même dispositif

| Public | Ce qu'il vient chercher | Comment « Apprendre » le sert |
|---|---|---|
| **Étudiant / novice** | Comprendre l'IA sans jargon, savoir *à quoi ça sert* | Cursus 0–1 : casse « IA = ChatGPT », intuition visuelle, première réussite guidée |
| **Enseignant-chercheur / confirmé** | Vérifier la rigueur, réviser un concept précis, **enseigner à sa classe** | Cursus 2–3 : évaluation honnête, équité, incertitude, causalité, + [Mode classe](#9-mode-enseignant--classe-v11) |

---

## 2. Nom et vocabulaire

**Contrainte** : « mission » et « parcours » désignent déjà le fil du pipeline ; « Défi » est pris par les missions guidées. Il faut un vocabulaire **distinct et non ambigu**.

**Libellé de navigation retenu (recommandé) : ★ « Apprendre »** (verbe d'action, court, lisible en sidebar, cohérent avec « Défis »). Le dispositif complet se **nomme « l'Académie »** dans les titres de page.

| Candidat (nav) | Pour | Contre |
|---|---|---|
| ★ **Apprendre** | Verbe clair, parle au novice, distinct de mission/parcours/défi | Générique seul (compensé par le titre « Académie ») |
| Formation | Sérieux, adulte | Un peu institutionnel/scolaire |
| Académie | Marquant, mémorable | Moins explicite comme libellé isolé → gardé comme **nom du dispositif** |
| Comprendre l'IA | Explicite sur la promesse | Trop long pour une entrée de menu |

> Décision facile à changer : une clé i18n `nav.formation`. Le reste du document fixe le **lexique** ci-dessous.

### 2.1 Lexique (à respecter dans le code et l'i18n)

| Terme | Définition | Analogue Défis |
|---|---|---|
| **Cursus** | Un niveau complet (Éveil, Fondations, Praticien, Analyste). L'unité de progression majeure. | ~ « niveau » |
| **Module** | Un chapitre d'un cursus (ex. « Évaluer un modèle »). Regroupe des leçons. | ~ un Défi |
| **Leçon** | L'unité atomique d'apprentissage (5–10 min). A un ou plusieurs blocs (voir [§3.5](#35-lanatomie-dune-leçon-les-blocs)). | ~ un objectif |
| **Notion** | Un concept-clé, matérialisé par une **carte** collectionnable (F1, overfitting…). | — |
| **Grade** | Le rang atteint par l'apprenant (Curieux → Éveillé → Apprenti → Praticien → Analyste). | — |
| **Passeport IA** | Le récapitulatif certifiable de tout ce qui est validé. | — |
| **Mise en pratique** | Le pont d'une leçon/module vers une **vraie** action du produit (Défi, wizard). | le lancement d'un Défi |

---

## 3. Le système d'apprentissage (le cœur)

### 3.1 Architecture pédagogique en 4 niveaux

```
ACADÉMIE
├── Cursus 0 — ÉVEIL         « C'est quoi l'IA, vraiment ? »        grade → Éveillé
├── Cursus 1 — FONDATIONS    « Les bases du Machine Learning »       grade → Apprenti
├── Cursus 2 — PRATICIEN     « Construire et évaluer un modèle »     grade → Praticien
└── Cursus 3 — ANALYSTE      « Rigueur, éthique et recherche »       grade → Analyste
        │
        └── Chaque cursus = N modules ; chaque module = N leçons ; chaque leçon = 1..N blocs.
```

**Alignement avec l'échelle existante.** Les cursus se raccordent aux 3 niveaux de guidage des Défis et à l'enum `XaiAudience` du backend (déjà `novice | intermediate | expert`) :

| Cursus | Niveau de guidage (Défis) | `XaiAudience` suggérée | Mise en pratique cible |
|---|---|---|---|
| 0 Éveil + 1 Fondations | `novice` (« sur les rails ») | `novice` | Défis niveau *novice* (titanic, penguins) |
| 2 Praticien | `debutant` (« copilote ») | `intermediate` | Défis niveau *débutant* (élèves, diabète) |
| 3 Analyste | `confirme` (« autonomie ») | `expert` | Défis niveau *confirmé* (vin, équité) |

> Cohérence maximale : la Formation **réutilise** l'échelle de niveaux, pas une échelle parallèle. Un apprenant « Praticien » est prêt pour les Défis « débutant ».

### 3.2 Le parcours adaptatif (ne pas infantiliser le confirmé)

**[SHOULD]** Au premier accès, un **quiz de placement** (5–7 questions) propose un grade de départ : le chercheur qui sait déjà lire une matrice de confusion n'est pas forcé de repartir de « c'est quoi l'IA ». Il peut :
- **Commencer au début** (recommandé au novice) ;
- **Se faire placer** par le quiz (déverrouille les cursus jusqu'au niveau estimé, en lecture) ;
- **Tout déverrouiller** (mode libre — le confirmé navigue à sa guise).

**[MUST]** Rien n'est jamais *bloquant dur* : un cursus non atteint est signalé « recommandé après X » mais reste ouvrable. On **oriente** (P : orientation permanente), on n'interdit pas.

### 3.3 Le fil rouge narratif

**[SHOULD]** Un **projet-fil** traverse toute l'académie : *« Peut-on prédire la réussite d'un élève, et surtout pourquoi ? »* (dataset réel `student_performance`, déjà seedé). Le même problème est repris à chaque cursus avec un cran de profondeur :
- Éveil : « une machine peut-elle deviner ça ? de quoi aurait-elle besoin ? »
- Fondations : features / cible / entraîner un premier arbre.
- Praticien : préparer les données, évaluer honnêtement, lire pourquoi.
- Analyste : est-ce robuste ? est-ce équitable ? est-ce *causal* ? est-ce citable ?

Le fil rouge donne une **continuité** rare dans les cours d'IA (souvent une collection d'exemples jetables) et se **branche directement** sur le Défi `eleves-decrochage`.

### 3.4 Le pont formation ↔ pratique (la signature)

La règle d'or, **la différence** avec un MOOC : **on ne valide pas un cursus sans avoir fait pour de vrai.**

- Chaque **module** se clôt par une **mise en pratique** : un encart `AiAssist`-teinté « Passe à la pratique » qui lance le Défi correspondant (lien profond `?challenge=<slug>`, exactement le mécanisme existant).
- L'**examen-diplôme** d'un cursus = **réussir un vrai Défi** du niveau correspondant (détection réelle via le store de quête `completed`, aucun faux succès — P1).
- Réciproquement : le **débrief d'un Défi** ([challenge-debrief.tsx](../../apps/web/components/ibis/challenges/challenge-debrief.tsx)) gagne un lien « comprendre ce résultat » vers la leçon qui explique la métrique affichée.

> **Insight central** : la Formation *n'a pas besoin de son propre moteur d'exécution*. Son « labo », c'est le pipeline réel déjà là. Elle **orchestre la compréhension** autour de lui — exactement comme les Défis orchestrent la pratique. C'est ce qui la rend livrable sans backend.

### 3.5 L'anatomie d'une leçon (les blocs)

Une leçon est une **séquence de blocs typés** (pas un pavé). Les 10 types de blocs — la boîte à outils pédagogique :

| # | Bloc | Ce qu'il fait | Réutilise |
|---|---|---|---|
| B1 | **Le mythe** | Ouvre en démontant une idée reçue (« IA = ChatGPT », « plus de données = mieux », « l'IA est objective »). Format *Mythe → Réalité*. | Card + token `--destructive`/`--score` |
| B2 | **Explication visuelle** | Un schéma animé en tokens (flux de données, arbre qui se construit, train/test). Zéro couleur inventée. | `chart-N`, `DomainPattern`, animations `rise-in` |
| B3 | **Le bac à sable** (playground) | Manipuler un paramètre → voir le résultat bouger, sur des **données d'illustration étiquetées**. Ex : bouger le seuil → la matrice de confusion change. | SVG/React purs + tokens `--score-N` |
| B4 | **Carte-notion** | Une flashcard concept, ajoutée au **deck** de l'apprenant. Recto (terme) / verso (définition + exemple). | Card + `LevelBadge` |
| B5 | **Quiz éclair** | 2–3 questions, **chaque réponse expliquée** (pas juste faux/vrai). | Radix radio-group, `--score` |
| B6 | **Le traducteur** | Le même concept en 3 registres (novice / intermédiaire / expert), bascule à la volée. | mapping `XaiAudience`, `Tabs` |
| B7 | **Étude de cas réelle** | « Anatomie d'un fail » : COMPAS, Amazon recrutement, Titanic 1912 — des cas vrais et sourcés. | Card, timeline |
| B8 | **Mise en pratique** | Le pont vers un vrai Défi / le wizard. | `AiAssist`, deep-link `?challenge=` |
| B9 | **Le tuteur** | Assistant de leçon : Q/R ancrées (pré-écrites) + [SHOULD] LLM honnête (`is_fallback`). | `xai-chat`, token `--ai` |
| B10 | **IA vs Toi** | Mini-jeu : l'apprenant prédit, le modèle prédit, on compare. Rend tangible « ce que le modèle voit ». | SVG + tokens |

**[MUST]** Toute leçon comporte au moins B2 (visuel) **et** B5 (quiz). Un module comporte au moins un B8 (mise en pratique). Le reste est modulable selon la leçon.

---

## 4. Le curriculum complet (TOUS les cours)

> Écrit **en entier** pour fixer la cible. Chaque module liste : **objectif**, **leçons** (avec le mythe démonté), **mise en pratique réelle**, et l'**état de praticabilité** (le pont existe-t-il déjà, ou dépend-il d'une feature de l'audit-recherche ?). La priorisation en vagues est en [§11](#11-priorisation--feuille-de-route).
>
> **Légende praticabilité** : 🟢 pont vers une capacité **déjà livrée** — · 🟡 concept enseigné, pratique **partielle** (existe mais manuelle) — · 🔴 concept enseigné, pratique **[V1.1] dépendante de l'audit** (on l'annonce honnêtement : « bientôt praticable dans IBIS-X »).

### 4.1 Cursus 0 — ÉVEIL — « C'est quoi l'IA, vraiment ? »

**Grade visé** : Curieux → **Éveillé**. **Public** : novice absolu. **But** : détruire « IA = ChatGPT », donner le vocabulaire et l'intuition, montrer *à quoi ça sert*. **Sans jamais ouvrir le pipeline** (on n'agit pas encore — on comprend).

#### Module 0.1 — L'IA n'est pas (que) ChatGPT
- **Leçon 0.1.1 — Le grand malentendu.** *Mythe : « l'IA, c'est ChatGPT ».* On situe ChatGPT comme **un** type d'IA parmi d'autres. Carte-notion : « IA générative vs IA prédictive ».
- **Leçon 0.1.2 — ChatGPT démystifié.** Un LLM = une machine qui **prédit le mot suivant**, entraînée sur du texte. Il ne « sait » ni ne « pense » rien. *Mythe : « l'IA comprend / a une conscience ».*
- **Leçon 0.1.3 — L'IA prédictive : celle qu'on va faire ici.** Prédire une catégorie ou un nombre à partir de données (spam ? malade ? prix ?). **C'est le cœur d'IBIS-X.** B10 *IA vs Toi* : devine si un e-mail est un spam, compare à un modèle.
- **Leçon 0.1.4 — La grande carte des IA.** Générative, prédictive, symbolique, apprentissage par renforcement — une carte mentale visuelle (B2). Situe chaque objet connu (ChatGPT, reco Netflix, filtre anti-spam, AlphaGo).

#### Module 0.2 — Comment une machine « apprend »
- **Leçon 0.2.1 — Apprendre par l'exemple.** L'intuition de l'apprentissage supervisé sans le mot : montrer 1000 photos étiquetées « chat/chien », la machine dégage une règle. B3 *bac à sable* « Devine la règle » : l'apprenant joue le rôle du modèle.
- **Leçon 0.2.2 — Les données, le carburant.** Sans données, pas d'IA. Bonnes/mauvaises données. *Mythe : « plus de données = toujours mieux ».*
- **Leçon 0.2.3 — Un « modèle », c'est quoi ?** Une **recette apprise**, pas un cerveau. On peut l'inspecter, le télécharger, s'en servir. (Ancre : le `.joblib` d'IBIS-X est un vrai modèle.)

#### Module 0.3 — À quoi ça sert (et où c'est déjà dans ta vie)
- **Leçon 0.3.1 — L'IA prédictive au quotidien.** Reco, anti-spam, fraude bancaire, dépistage médical, maintenance. B7 étude de cas.
- **Leçon 0.3.2 — Ce que l'IA ne sait PAS faire.** Limites, bon sens, généralisation. *Mythe : « l'IA est neutre et infaillible ».*
- **Leçon 0.3.3 — Quand l'IA se trompe (et pourquoi c'est grave).** B7 : COMPAS (récidive), recrutement Amazon. Pose la graine de l'éthique (reprise en cursus 3).

**Examen Éveil** : quiz de synthèse + carte finale déverrouillée *« Je sais expliquer à un proche ce qu'est vraiment l'IA »*. **Aucune mise en pratique produit** (c'est voulu : on ne sait pas encore agir). **Praticabilité** : 🟢 (100 % conceptuel, aucune dépendance).

### 4.2 Cursus 1 — FONDATIONS — « Les bases du Machine Learning »

**Grade visé** : **Apprenti**. **But** : le vocabulaire et les gestes de base, **première réussite réelle**.

#### Module 1.1 — Le vocabulaire du ML
- **1.1.1 — Lignes & colonnes.** Observations (lignes) et variables (colonnes) — sur un vrai extrait de `student_performance`.
- **1.1.2 — Features & cible.** Ce qu'on donne au modèle (features) vs ce qu'on lui demande de prédire (cible). B3 : glisse une colonne « cible » et vois ce que ça change.
- **1.1.3 — Classification vs régression.** Prédire une **catégorie** (réussite oui/non) vs un **nombre** (note). B6 traducteur.

#### Module 1.2 — Le jeu de données
- **1.2.1 — D'où viennent les données.** Et pourquoi IBIS-X les **score éthiquement** avant tout (pont léger vers `/datasets`). 🟢
- **1.2.2 — Train / test : pourquoi cacher une partie.** L'analogie de l'examen : on ne révise pas sur le sujet du bac. B2 animation train/test split.
- **1.2.3 — La qualité des données.** Valeurs manquantes, biais d'échantillon. *Mythe : « les données sont objectives ».*

#### Module 1.3 — Entraîner un premier modèle
- **1.3.1 — Qu'est-ce qu'« entraîner » ?** Ajuster une recette pour coller aux exemples, sans tricher. B2.
- **1.3.2 — L'arbre de décision, expliqué.** Le modèle le plus **lisible** (série de questions oui/non). B3 : construis un mini-arbre à la main, vois-le classer. (Ancre : l'arbre est un algo **réel** d'IBIS-X, `ml/algorithms.py`.)
- **1.3.3 — 🟢 MISE EN PRATIQUE : ta première enquête.** Pont vers le **Défi `titanic-1912`** (niveau novice, ultra-guidé). L'apprenant entraîne un **vrai** modèle de bout en bout.

**Examen-diplôme Fondations** : avoir **complété un Défi novice** (détecté via `completed` du store de quête) + quiz. Récompense : grade **Apprenti**, badge *« J'ai entraîné mon premier modèle »*. **Praticabilité** : 🟢 (Défis novices déjà livrés).

### 4.3 Cursus 2 — PRATICIEN — « Construire et évaluer un modèle »

**Grade visé** : **Praticien**. **But** : préparer les données, choisir un algo, **évaluer honnêtement**, comprendre *pourquoi* le modèle décide.

#### Module 2.1 — Préparer les données (preprocessing)
- **2.1.1 — Les valeurs manquantes.** Supprimer vs imputer (moyenne, médiane, KNN, MICE — tous **réels** dans `ml/preprocessing.py`). B3 : choisis une stratégie, vois l'effet.
- **2.1.2 — Encoder les catégories.** Transformer « rouge/vert/bleu » en nombres (one-hot, ordinal). B2.
- **2.1.3 — Mettre à l'échelle.** Pourquoi standardiser/normaliser. B6 traducteur.
- **2.1.4 — La fuite de données (data leakage).** *Mythe : « 99 % d'accuracy = super modèle ».* L'erreur qui gonfle les scores : une variable qui « triche ». (Ancre : IBIS-X **fit sur train uniquement**, zéro fuite — argument de sérieux.) 🟡

#### Module 2.2 — Les algorithmes
- **2.2.1 — De l'arbre à la forêt.** La forêt aléatoire = la sagesse de la foule d'arbres. B2. (Algo réel.)
- **2.2.2 — La régression logistique.** Le modèle à **coefficients** — le langage des chercheurs (signe, magnitude, odds-ratios). B6. 🔴 *(pleinement praticable quand A1 de l'audit sera livré — annoncé honnêtement.)*
- **2.2.3 — Comment choisir ?** *Mythe : « il existe un meilleur algorithme ».* Compromis lisibilité/performance.

#### Module 2.3 — Évaluer un modèle honnêtement
- **2.3.1 — L'accuracy et son piège.** Classes déséquilibrées (99 % de non-fraude). B10 : un modèle « tout va bien » qui a 99 % d'accuracy et rate toutes les fraudes.
- **2.3.2 — Précision, rappel, F1.** L'intuition du **test médical** (faux positifs vs faux négatifs). B3 : bouge le curseur, vois précision et rappel s'opposer.
- **2.3.3 — La matrice de confusion.** B3 phare : **bouge le seuil de décision**, regarde les 4 cases (VP/FP/VN/FN) bouger en direct (données d'illustration étiquetées). Utilise la rampe `--score-N`.
- **2.3.4 — ROC & PR.** Les courbes, en intuition. (Métriques **réelles** d'IBIS-X, `ml/evaluation.py`.)
- **2.3.5 — Le sur-apprentissage (overfitting).** *Mythe : « un modèle parfait sur mes données est parfait ».* B3 : augmente la profondeur de l'arbre, vois l'écart train/test se creuser. (Pont vers F3 de l'audit — courbes d'apprentissage.) 🟡

#### Module 2.4 — Comprendre POURQUOI (explicabilité)
- **2.4.1 — La boîte noire, et pourquoi l'ouvrir.** L'enjeu de l'explicabilité (confiance, droit, débogage).
- **2.4.2 — Importance des variables & SHAP.** Expliqué **visuellement**, en réutilisant le rendu réel [explanation-view.tsx](../../apps/web/components/ibis/xai/explanation-view.tsx). 🟢
- **2.4.3 — Local vs global.** Pourquoi CETTE prédiction (local) vs le modèle en général (global). B6.
- **2.4.4 — ⚠️ Le garde-fou : importance ≠ cause.** *Mythe capital : « SHAP me dit ce qui cause Y ».* Non — il dit ce que le modèle **utilise**. (C5 de l'audit — honnêteté centrale.) B7. 🟢
- **2.4.5 — 🟢 MISE EN PRATIQUE.** Pont vers le Défi `eleves-decrochage` **ou** `depistage-diabete` (niveau débutant) : entraîner, évaluer, **générer l'explication**.

**Examen-diplôme Praticien** : Défi débutant complété (avec explication générée) + quiz « lis cette matrice de confusion ». Récompense : grade **Praticien**, badges *« Je sais évaluer un modèle »*, *« Je sais lire une explication »*. **Praticabilité** : 🟢 majoritaire, 🟡/🔴 signalés.

### 4.4 Cursus 3 — ANALYSTE — « Rigueur, éthique et recherche »

**Grade visé** : **Analyste**. **Public** : avancé / chercheur. **But** : le niveau publiable — incertitude, équité, causalité, reproductibilité, cadre juridique. **C'est ici que la Formation et l'[audit-recherche](../audit-valeur-recherche.md) se rejoignent** : plusieurs leçons enseignent un concept dont la *pratique* dépend d'une feature de l'audit (marquées 🔴). On l'assume : *« voici le concept ; sa mise en pratique dans IBIS-X arrive — voir feuille de route »*.

#### Module 3.1 — Mesurer l'incertitude
- **3.1.1 — Un seul split est fragile.** Pourquoi un 80/20 unique ne suffit pas → la **validation croisée** (k-fold). 🔴 *(praticable avec B1 de l'audit.)*
- **3.1.2 — « 0,82 ± quoi ? ».** Les **intervalles de confiance** (bootstrap). *Mythe : « un chiffre unique est une vérité ».* 🔴 *(B2 de l'audit.)*
- **3.1.3 — La reproductibilité.** `random_state=42`, même données → même résultat. (Ancre : IBIS-X est **reproductible par conception** — P4.) 🟢

#### Module 3.2 — L'éthique et l'équité (fairness)
- **3.2.1 — D'où viennent les biais.** Données, société, boucle de rétroaction. B7 (reprend COMPAS du cursus 0, en profondeur).
- **3.2.2 — Auditer l'équité.** Parité démographique, égalité des chances, disparate impact. 🟡 *(faisable manuellement via la XAI des Défis équité ; automatisé avec F1 de l'audit.)*
- **3.2.3 — 🟡 MISE EN PRATIQUE : audit de biais.** Pont vers les Défis `equite-revenus` / `equite-credit` (déjà livrés) : entraîner puis **auditer le biais** via la XAI.
- **3.2.4 — Le cadre juridique.** AI Act, RGPD art. 22, « droit à l'explication ». Parle aux juristes. B7.

#### Module 3.3 — Corrélation, prédiction, causalité
- **3.3.1 — Corrélation ≠ causalité.** L'erreur reine. B7 (corrélations fallacieuses cultes). *Mythe : « ils varient ensemble, donc l'un cause l'autre ».*
- **3.3.2 — Les trois registres.** Prédire vs expliquer vs **agir** (la §2 de l'audit rendue pédagogique). Situe honnêtement ce qu'IBIS-X fait (prédictif + explicable) et ne fait pas encore (causal). 🔴 *(module causalité C1 de l'audit.)*

#### Module 3.4 — Du résultat au livrable
- **3.4.1 — L'empreinte de reproductibilité.** Hash des données, versions, seed. 🟡 *(E5 de l'audit.)*
- **3.4.2 — Le modèle téléchargeable.** Ce qu'on fait d'un `.joblib` (réel). 🟢
- **3.4.3 — Vers un résultat citable.** Limites, honnêteté méthodologique, rapport. 🔴 *(E1 de l'audit — rapport exportable.)*

**Examen-diplôme Analyste** : Défi confirmé complété **en autonomie** + audit d'équité mené + quiz avancé. Récompense : grade **Analyste**, **Passeport IA complet** (certificat téléchargeable). **Praticabilité** : mixte 🟢🟡🔴 — chaque 🔴 débloqué au fil de l'audit-recherche.

### 4.5 Vue d'ensemble du curriculum

| Cursus | Modules | Leçons | Mises en pratique (Défis) | Dépendances audit |
|---|---|---|---|---|
| 0 Éveil | 3 | 10 | — (conceptuel) | aucune |
| 1 Fondations | 3 | 9 | titanic, penguins | aucune |
| 2 Praticien | 4 | 15 | élèves, diabète | A1, F3 (partiels) |
| 3 Analyste | 4 | 12 | vin, iris, équité×2 | B1, B2, C1, E1, E5, F1 |
| **Total** | **14** | **~46** | **8 Défis** | 6 features roadmap |

---

## 5. Idées originales & différenciantes

Le catalogue d'idées qui font de « Apprendre » **plus qu'un cours en ligne**. Priorisées en [§11](#11-priorisation--feuille-de-route).

| # | Idée | Pourquoi c'est fort | Effort |
|---|---|---|---|
| **O1** | **« De ChatGPT à ton modèle »** — le fil rouge du produit entier : on part de l'objet connu (ChatGPT) pour arriver à *ton* modèle entraîné. | Répond *exactement* au constat d'Anthony ; donne un récit à toute l'académie. | 🟢 |
| **O2** | **Deck de cartes-notions collectionnables.** Chaque concept maîtrisé = une carte gagnée, rangée dans « mon deck ». Révisable. | Rend la progression **tangible** et fière, sans puérilité. Support de révision. | 🟡 |
| **O3** | **Le traducteur de niveau (B6).** Tout concept lisible en novice / intermédiaire / expert, d'un clic. **Réutilise `XaiAudience`.** | Un seul contenu sert les 2 publics ; le chercheur ne subit pas le ton novice. | 🟡 |
| **O4** | **Glossaire vivant contextuel.** Survole un terme *n'importe où dans IBIS-X* (wizard, résultats, Défis) → mini-définition + lien vers la leçon. | Transforme **tout le produit** en surface d'apprentissage. Tue le jargon partout. | 🟡 |
| **O5** | **Playgrounds « boîte transparente » (B3).** Bouger un seuil / une profondeur → voir la matrice / l'arbre bouger. | On **comprend en manipulant**, pas en lisant. Le cœur pédagogique. | 🟡 |
| **O6** | **« IA vs Toi » (B10).** L'apprenant prédit, le modèle prédit, on compare les scores. | Rend viscéral « ce que le modèle voit » ; dédramatise et humilie gentiment l'intuition. | 🟡 |
| **O7** | **Passeport IA certifiable.** Diplôme téléchargeable en fin de cursus, avec **empreinte de reproductibilité** (parle au sérieux du produit). | Livrable fier pour l'étudiant, crédible pour l'institution. | 🟡 |
| **O8** | **Quiz de placement adaptatif.** Le confirmé n'est pas infantilisé ; il démarre au bon grade. | Respecte le public hétérogène (§1.6). | 🟢 |
| **O9** | **Anatomie d'un fail (B7).** Vrais scandales d'IA (COMPAS, Amazon, biais) comme matière pédagogique. | Marquant, mémorable, éthiquement formateur, sourcé. | 🟢 |
| **O10** | **Le tuteur de leçon (B9).** Assistant ancré (Q/R pré-écrites) + LLM honnête optionnel. **Réutilise `xai-chat` + `is_fallback`.** | Répond aux questions sans quitter la leçon ; honnête par conception. | 🟡 |
| **O11** | **La frise de l'IA.** De Turing (1950) aux LLM (2020s), une timeline qui **situe ChatGPT dans une histoire longue**. | Casse l'illusion « l'IA est née en 2022 ». Culture générale. | 🟢 |
| **O12** | **Mode révision à répétition espacée.** Les cartes-notions ratées reviennent aux bons intervalles. | Ancrage mémoriel réel (spaced repetition). | 🔴 |
| **O13** | **Micro-badges de compétence.** Pas juste « cursus fini » mais « je sais lire une matrice de confusion », « je sais repérer un overfitting ». | Granularité motivante + lisibilité des acquis pour un enseignant. | 🟡 |
| **O14** | **Mode classe / cohorte.** Un enseignant crée une classe, assigne un cursus, suit la progression. | Le public **est** enseignant-chercheur (H5 de l'audit). Levier d'adoption institutionnel. | 🔴 |
| **O15** | **« Explique-moi comme si j'avais 10 ans ».** Un bouton sur chaque notion pour la version ultra-simple. | Filet de sécurité pour le novice qui décroche. | 🟢 |
| **O16** | **Streak de régularité (sobre).** Un discret compteur de jours d'apprentissage — sans confetti. | Habitude, sans infantiliser. | 🟢 |

---

## 6. Design & UX

**Contrainte absolue (P6, mémoire « design riche exigé » + « motif IA unifié »)** : composer **uniquement** avec les tokens et les composants `ibis/*`. Jamais de primitive nue, jamais de couleur inventée.

### 6.1 Tokens & langage graphique (rappel des règles réelles)

| Token | Usage dans « Apprendre » | Règle |
|---|---|---|
| `--primary`, `--muted`, `--border` | Structure, texte, cartes | Base monochrome (`globals.css`) |
| `--chart-1..5` | Schémas pédagogiques (B2), pas des teintes → **nuances** + motif + icône | Jamais une couleur « inventée » (`domain-visuals.ts`) |
| `--score-1..5` | **Réservé** : matrice de confusion, jauges de score de quiz, heatmaps | Rampe séquentielle qualité |
| `--ai`, `--ai-violet`, `--ai-blue` | **Réservé IA** : le tuteur (B9), la mise en pratique assistée, les révélations | Motif IA unifié uniquement |
| `.dv-*` (vignettes domaine) | Bandeaux des cartes de cursus/module (par thème) | Réutilise `getDomainVisual` |

**[MUST]** La difficulté d'un cursus se lit comme dans `LevelBadge` : **barres de remplissage**, jamais « rouge = dur ». Les animations pédagogiques réutilisent `rise-in` / `ai-reveal` / `ai-sheen` **déjà définies** et **respectent `prefers-reduced-motion`**.

### 6.2 Composants réutilisés (zéro réinvention)

| Besoin | Composant existant | Fichier |
|---|---|---|
| Cartes de cursus/module | `Card` + `DomainPattern` + `LevelBadge` (patron `ChallengeCard`) | `components/ibis/challenges/challenge-card.tsx` |
| Progression (anneau) | `ProgressRing` | `components/ibis/progress-ring.tsx` |
| Compteurs (leçons faites, %) | `StatTile` + `CountAnimation` | `components/ibis/dashboard/stat-tile.tsx` |
| Assistance / mise en pratique | `AiAssist` (libellés `wizard.ai*` déjà traduits) | `components/ibis/ai-assist.tsx` |
| Tuteur (chat) | `xai-chat` | `components/ibis/xai/xai-chat.tsx` |
| Rendu d'explication (leçon SHAP) | `explanation-view` | `components/ibis/xai/explanation-view.tsx` |
| États vides / erreurs | `StatePage` / `StateIllustration` | `components/ibis/states/` |
| Coquille plein écran (mode leçon immersif) | patron `WizardShell` | `components/ibis/wizard/wizard-shell.tsx` |

### 6.3 Les écrans (arborescence UI)

```
/formation                      Accueil Académie — les 4 cursus, grade actuel, prochaine étape, deck
  ├── grade + ProgressRing global (« Éveillé · 3/14 modules »)
  ├── quiz de placement (1er accès)           [SHOULD]
  ├── 4 cartes de cursus (verrou souple)       [MUST]
  └── raccourcis : « Reprendre » · « Mon deck » · « Mon passeport »

/formation/[cursus]             Un cursus — la liste de ses modules + progression du cursus
  └── cartes de module (ChallengeCard-like) + mise en pratique en fin

/formation/[cursus]/[lecon]     Une leçon — la séquence de blocs (§3.5)
  ├── fil d'ariane + ProgressRing de leçon
  ├── blocs B1..B10 empilés (scroll ou étapes)
  └── pied : « Leçon suivante » / « Passe à la pratique » (B8)

/formation/deck                 Mon deck de cartes-notions (collection + révision)   [O2]
/formation/passeport            Mon Passeport IA (grades, badges, certificat)        [O7]
```

**[SHOULD]** Le mode leçon peut s'afficher **immersif** (patron `WizardShell` : rail gauche = liste des blocs/leçons, colonne centrale = contenu, pied = navigation) pour la concentration — cohérent avec l'ergonomie du wizard que l'utilisateur connaît déjà.

### 6.4 Entrée de navigation

**[MUST]** Ajouter dans `components/ibis/layout/nav-config.ts` :
```ts
{ labelKey: "formation", href: "/formation", icon: GraduationCapIcon }
```
+ ajouter `"formation"` à l'union `NavItem.labelKey`, + clé `nav.formation` dans `messages/fr.json` **et** `en.json`. `GraduationCapIcon` (lucide) est déjà importé dans `app/page.tsx`. Position suggérée : **juste avant « Défis »** (on comprend, puis on pratique).

---

## 7. Architecture technique

**Principe** (copié des Défis) : **feature d'orchestration front, catalogue statique typé, i18n bilingue, store persistant.** Aucune entité backend au v1.

### 7.1 Arborescence des fichiers (miroir de `challenges/`)

```
apps/web/lib/formation/
  types.ts            # Cursus, Module, Lecon, Block, Grade, NotionCard, BlockType
  catalog.ts          # Le curriculum statique typé (structure only) + helpers
  blocks.ts           # Types & schémas des 10 blocs (§3.5)
  store.ts            # Zustand + persist (localStorage "ibis:formation")
  progress.ts         # Helpers PURS (gradeFor, cursusPercent, nextLesson, isModuleDone)
  placement.ts        # Quiz de placement → grade suggéré (pur)              [SHOULD]
  bridge.ts           # Pont vers Défis : lessonToChallenge(slug) etc.
  glossary.ts         # Glossaire vivant : terme → notion → leçon             [O4]

apps/web/components/ibis/formation/
  cursus-card.tsx           # Carte de cursus (patron ChallengeCard)
  module-card.tsx           # Carte de module
  lesson-view.tsx           # Rendu d'une leçon = séquence de blocs
  blocks/                   # Un composant par type de bloc
    myth-block.tsx          # B1
    visual-block.tsx        # B2 (schémas en tokens)
    playground-block.tsx    # B3 (bacs à sable — données d'illustration)
    notion-card-block.tsx   # B4
    quiz-block.tsx          # B5
    translator-block.tsx    # B6 (réutilise le mapping XaiAudience)
    case-study-block.tsx    # B7
    practice-block.tsx      # B8 (AiAssist + deep-link Défi)
    tutor-block.tsx         # B9 (réutilise xai-chat)               [SHOULD]
    ia-vs-you-block.tsx     # B10
  grade-badge.tsx           # Pastille de grade (patron LevelBadge)
  deck-view.tsx             # Mon deck [O2]
  passport-view.tsx         # Mon Passeport [O7]
  glossary-tooltip.tsx      # Bulle de glossaire contextuelle [O4]

apps/web/app/(app)/formation/
  page.tsx                        # /formation
  [cursus]/page.tsx               # /formation/[cursus]
  [cursus]/[lecon]/page.tsx       # /formation/[cursus]/[lecon]
  deck/page.tsx                   # /formation/deck
  passeport/page.tsx              # /formation/passeport

apps/web/tests/formation/         # tests unitaires (catalog, progress, placement, bridge)
apps/web/e2e/formation.spec.ts    # parcours FR/EN (accueil → leçon → quiz → mise en pratique)
```

### 7.2 Modèle de données (esquisse `lib/formation/types.ts`)

```ts
export type Grade = "curieux" | "eveille" | "apprenti" | "praticien" | "analyste";
export type CursusLevel = "novice" | "debutant" | "confirme";  // réutilise ChallengeLevel

export type BlockType =
  | "myth" | "visual" | "playground" | "notion" | "quiz"
  | "translator" | "case_study" | "practice" | "tutor" | "ia_vs_you";

export interface Block { id: string; type: BlockType; /* payload typé par type, dans blocks.ts */ }

export interface Lesson {
  slug: string;              // ex "0-1-1-le-grand-malentendu"
  blocks: BlockType[];       // ordre des blocs ; le CONTENU vit dans l'i18n (jamais ici)
  notions: string[];         // ids de cartes-notions gagnées
  practiceChallenge?: string;// slug d'un Défi vivant (B8) — validé contre CHALLENGES (P5)
}
export interface Module {
  slug: string; lessons: Lesson[];
  practiceChallenge?: string;// mise en pratique de fin de module
}
export interface Cursus {
  slug: "eveil" | "fondations" | "praticien" | "analyste";
  level: CursusLevel;        // → mapping XaiAudience (déjà XAI_AUDIENCE_BY_LEVEL)
  grade: Grade;              // grade obtenu à la complétion
  domain: string;            // getDomainVisual
  modules: Module[];
  order: number;
}
```

**[MUST]** Comme pour les Défis : **le catalogue ne contient que la structure ; tout le texte (titres, mythes, explications, questions de quiz, définitions) vit dans l'i18n** `formation.<cursus>.<module>.<lecon>.*`. Un test de parité FR/EN protège l'ensemble.

**[MUST]** `practiceChallenge` est **validé au build/test** contre `CHALLENGES` (catalogue Défis) : impossible de pointer vers un Défi mort (P5). Voir `bridge.ts`.

### 7.3 Store & progression (esquisse `lib/formation/store.ts`)

Même patron que `challenges/store.ts` (zustand + `persist`, `noopStorage` SSR, `partialize`) :
```ts
interface AcademyState {
  grade: Grade;
  lessonsDone: string[];        // slugs de leçons terminées
  notionsOwned: string[];       // deck [O2]
  quizScores: Record<string, number>;
  placement: Grade | null;      // résultat du quiz de placement [O8]
  markLesson(slug): void;       // coche + recalcule le grade
  ownNotion(id): void;
  reset(): void;
}
// persist { name: "ibis:formation", partialize: garder l'état utile }
```
Le grade se **recalcule purement** depuis `lessonsDone` (`progress.gradeFor`). La détection « Défi complété » pour les examens-diplômes **lit le store de quête existant** (`ibis:challenges` → `completed`) — zéro duplication, source unique de vérité (P3).

### 7.4 i18n

Nouveau namespace `formation` dans `messages/fr.json` **et** `messages/en.json`. Sous-structure recommandée :
```
formation.nav / home / grades / blocks (libellés génériques)
formation.<cursus>.title / tagline / <module>.title / <module>.<lecon>.title|myth|body|quiz|...
formation.glossary.<terme>   # [O4]
```
+ `nav.formation` dans les deux fichiers. **Parité stricte obligatoire** (le test `tests/i18n-messages.test.ts` échoue sinon).

### 7.5 Backend — **optionnel, [V1.1]**

Tant que le contenu et la progression sont front, **aucun backend**. Le module `apps/api/ibis/modules/formation/` n'est requis que pour :
- **[V1.1] Progression serveur** : synchroniser la progression entre appareils (aujourd'hui localStorage suffit, comme les Défis).
- **[V1.1] Passeport certifiable vérifiable** : un endpoint d'attestation signée (empreinte de repro).
- **[V1.1] Mode classe** ([§9](#9-mode-enseignant--classe-v11)) : cohortes, assignation, suivi — nécessite des tables + RBAC.

Si créé : `routes.py` enregistré dans `main.py` (préfixe `/api/v1`), puis `pnpm generate:api` (ADR-007 — jamais de `fetch` à la main).

---

## 8. Progression, grades & gamification (mature)

**Principe (P + garde-fou §1.5)** : motiver sans infantiliser. Le public inclut des chercheurs.

- **Grades** : Curieux → Éveillé → Apprenti → Praticien → Analyste. Affichés avec une pastille sobre (patron `LevelBadge`). Le grade **résume** l'avancement, il ne bloque pas.
- **Micro-badges de compétence** [O13] : granulaires et *nommés par l'acquis* (« Je sais lire une matrice de confusion »), pas par un score creux.
- **Deck de cartes-notions** [O2] : la collection de concepts maîtrisés — fierté + révision.
- **Passeport IA** [O7] : récap certifiable, téléchargeable en fin de cursus 3, avec empreinte de reproductibilité (crédible institutionnellement).
- **Streak sobre** [O16] : compteur discret de régularité. **[NE PAS FAIRE]** confettis, pièces, classement compétitif.
- **Barre de progression** : `ProgressRing` partout (leçon, module, cursus, global) — cohérent avec Défis et wizard.

**Détection honnête (P1)** : un examen-diplôme n'est validé que par un **vrai** Défi complété (lu dans le store de quête) + un quiz réellement réussi. **Aucun** badge décerné pour du faux.

---

## 9. Mode enseignant / classe [V1.1]

Le public **est** enseignant-chercheur (H5 de l'audit). Prévu, pas au v1 (nécessite backend + RBAC).

- **[V1.1]** Un rôle « enseignant » crée une **classe**, y assigne un cursus, obtient un **code d'invitation**.
- **[V1.1]** Tableau de suivi : progression par élève, notions acquises, Défis complétés (sans surveillance intrusive — agrégats + acquis).
- **[V1.1]** Export d'un **rapport de classe** (qui a validé quoi).
- **[V2]** SSO institutionnel (RENATER/Shibboleth, G4 de l'audit) + quotas par labo.

> Argument produit : IBIS-X devient un **support de TP** clé-en-main pour un cours de data/ML/éthique en SHS — exactement le public de la présentation du 20/07.

---

## 10. Accessibilité, i18n & honnêteté

- **[MUST] i18n FR/EN complet** — parité stricte (test). Tout texte via `useTranslations`.
- **[MUST] `prefers-reduced-motion`** respecté sur toutes les animations pédagogiques (réutilise les garde-fous déjà dans `globals.css`).
- **[MUST] Clavier & lecteurs d'écran** : quiz et playgrounds navigables au clavier, `aria-*` sur les contrôles (comme `LevelBadge` qui isole le décoratif en `aria-hidden`).
- **[MUST] Honnêteté (P1)** : playgrounds **étiquetés « illustration »** ; tuteur LLM marqué `is_fallback` sans clé ; concepts non encore praticables annoncés « bientôt dans IBIS-X », jamais simulés.
- **[SHOULD] Contraste** : vérifier les rampes `--score-N` en quiz (déjà pensées clair/sombre).

---

## 11. Priorisation & feuille de route

Quatre vagues. La **vague 1 est autoportante** : elle livre une académie réelle, sans backend, branchée sur les Défis existants.

### Vague 1 — « L'académie qui casse le mythe » (le socle) — [MUST]
**Cursus 0 (Éveil) + Cursus 1 (Fondations)** complets, avec blocs B1 (mythe), B2 (visuel), B4 (carte-notion), B5 (quiz), B8 (mise en pratique → Défis novices). Accueil `/formation`, grades, deck minimal, entrée de nav, i18n FR/EN, store, tests + e2e.
→ **Résultat** : un novice comprend *enfin* ce qu'est l'IA (≠ ChatGPT) **et** entraîne son premier vrai modèle. Le constat d'Anthony est résolu dès cette vague.

### Vague 2 — « Comprendre en manipulant » — [SHOULD]
**Cursus 2 (Praticien)** + les blocs interactifs : B3 (playgrounds : matrice de confusion, overfitting), B6 (traducteur `XaiAudience`), B10 (IA vs Toi), O4 (glossaire vivant contextuel), O8 (quiz de placement), O11 (frise de l'IA).
→ **Résultat** : l'apprenant évalue et explique honnêtement un modèle ; le jargon meurt dans tout le produit.

### Vague 3 — « Le niveau chercheur » — [SHOULD]/[V1.1]
**Cursus 3 (Analyste)** : éthique/équité (branché sur les Défis équité **déjà livrés** — 🟡), incertitude, causalité, livrables. B7 (études de cas), B9 (tuteur), O7 (Passeport certifiable), O13 (micro-badges). Les leçons 🔴 s'activent **au rythme de l'[audit-recherche](../audit-valeur-recherche.md)** (A1, B1, B2, C1, E1, F1).
→ **Résultat** : la Formation et la roadmap recherche avancent ensemble ; chaque feature livrée débloque sa leçon praticable.

### Vague 4 — « L'académie institutionnelle » — [V1.1]/[V2]
**Backend** : progression serveur, **Mode classe** [O14], passeport vérifiable, révision espacée [O12], SSO [V2].
→ **Résultat** : IBIS-X devient un support de cours clé-en-main.

### Récapitulatif (impact × effort)
```
Impact
 fort  │ Cursus0+1 (V1)   Playgrounds+Glossaire (V2)   Cursus3+Passeport (V3)   ModeClasse (V4)
       │  O1 O8 O9 O15      O3 O4 O5 O6 O11               O7 O13 B9                O14 O12
 moyen │  deck O2           frise O11                    micro-badges O13         SSO
       └───────────────────────────────────────────────────────────────────────→ Effort
          🟢 sans backend     🟡 front interactif           🟡/🔴 + roadmap audit    🔴 backend
```

---

## 12. Métriques de succès

| Question | Métrique | Cible indicative |
|---|---|---|
| Le mythe est-il cassé ? | % d'apprenants terminant le Cursus 0 | > 60 % des entrants |
| Le pont théorie→pratique fonctionne-t-il ? | % qui lancent un **vrai Défi** après une mise en pratique | > 40 % |
| La première réussite arrive-t-elle vite ? | Temps médian jusqu'au 1er Défi complété via la Formation | < 20 min |
| Le contenu forme-t-il vraiment ? | Score moyen aux quiz de fin de module | > 70 % |
| Le confirmé est-il respecté ? | % d'usage du quiz de placement / mode libre | suivi (pas de cible) |
| L'académie fidélise-t-elle ? | % de retour J+7 (streak ≥ 2) | suivi |

> **[MUST]** Aucune métrique de « temps passé » gonflée artificiellement. On mesure la **compréhension** (quiz) et le **passage à la pratique réelle** (Défis), pas l'engagement pour l'engagement.

---

## 13. Ce qu'il ne faut PAS faire (garde-fous)

- **[NE PAS FAIRE]** Présenter un playground comme un vrai résultat d'entraînement (viole P1). Tout élément interactif à données d'illustration est **visiblement étiqueté** ; le vrai s'obtient dans les Défis / le wizard.
- **[NE PAS FAIRE]** Promettre une capacité absente (validation croisée, causalité, fairness automatique) comme si IBIS-X l'exécutait. On **enseigne le concept** et on **annonce honnêtement** son arrivée (lien vers l'audit).
- **[NE PAS FAIRE]** Réinventer des composants ou des couleurs. On compose avec `ibis/*` et les tokens ; `--ai` **uniquement** pour l'IA, `--score-N` **uniquement** pour les scores (P6).
- **[NE PAS FAIRE]** Un cours de maths abstrait. L'intuition d'abord ; la formule est optionnelle et repliée.
- **[NE PAS FAIRE]** De la gamification enfantine (confettis, pièces, classements). Grades, badges d'acquis, passeport — sobres.
- **[NE PAS FAIRE]** Dupliquer l'état de progression des Défis. La complétion d'un Défi a **une seule source** (`ibis:challenges`) ; la Formation la **lit**, ne la recopie pas (P3).
- **[NE PAS FAIRE]** Bloquer durement l'accès. On oriente, on recommande, on ne verrouille jamais un contenu au chercheur pressé.
- **[NE PAS FAIRE]** Du texte en dur dans les composants ou le catalogue. Tout passe par l'i18n FR/EN (parité testée).

---

## 14. Annexes

### 14.1 Checklist d'intégration (vague 1)
- [ ] `lib/formation/{types,catalog,blocks,store,progress,bridge}.ts`
- [ ] `components/ibis/formation/{cursus-card,module-card,lesson-view,grade-badge}.tsx` + `blocks/{myth,visual,notion-card,quiz,practice}-block.tsx`
- [ ] `app/(app)/formation/{page,[cursus]/page,[cursus]/[lecon]/page}.tsx`
- [ ] `nav-config.ts` : `"formation"` dans l'union + `MAIN_NAV` + `GraduationCapIcon`
- [ ] `messages/fr.json` **et** `en.json` : namespace `formation` + `nav.formation`
- [ ] `tests/formation/*.test.ts` (catalog, progress, bridge vers CHALLENGES) + `e2e/formation.spec.ts` FR/EN
- [ ] `bridge.ts` valide chaque `practiceChallenge` contre `CHALLENGES` (P5)

### 14.2 Correspondance leçon ↔ capacité réelle IBIS-X (ancrage P1)
| Leçon | Capacité réelle mobilisée | Fichier de référence |
|---|---|---|
| 1.3.2 arbre / 2.2.1 forêt | Algos réels | `apps/api/ibis/ml/algorithms.py` |
| 2.1.* preprocessing | Imputation/encodage/scaling réels | `apps/api/ibis/ml/preprocessing.py` |
| 2.3.* métriques / matrice | Métriques réelles | `apps/api/ibis/ml/evaluation.py` |
| 2.4.* SHAP / importance | XAI réelle + rendu | `xai/engine.py`, `components/ibis/xai/explanation-view.tsx` |
| 3.1.3 reproductibilité | `random_state=42`, `.joblib` | `experiments/routes.py` |
| toutes mises en pratique | Défis vivants | `lib/challenges/catalog.ts` |

### 14.3 Correspondance leçon 🔴 ↔ feature audit-recherche (roadmap)
| Leçon 🔴 | Feature à livrer | Réf. audit |
|---|---|---|
| 2.2.2 régression logistique (coefficients) | A1 | audit §3.A |
| 3.1.1 validation croisée | B1 | audit §3.B |
| 3.1.2 intervalles de confiance | B2 | audit §3.B |
| 3.2.2 audit d'équité automatisé | F1 | audit §3.F |
| 3.3.2 causalité | C1 | audit §3.C |
| 3.4.3 rapport citable | E1 | audit §3.E |

---

> **En une phrase.** « Apprendre » transforme IBIS-X d'un *outil qu'on ne sait pas utiliser* en une *école où l'on comprend l'IA en la pratiquant pour de vrai* — du novice qui croit que l'IA se résume à ChatGPT, jusqu'au chercheur qui audite l'équité de son modèle. Elle se construit comme les Défis (front, catalogue, i18n, store), referme le triptyque *Comprendre → Pratiquer → Publier*, et tient chaque promesse honnêtement (P1).
