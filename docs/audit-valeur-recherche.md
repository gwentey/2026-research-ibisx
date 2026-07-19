# Audit — « Tout ce qu'il faudrait ajouter pour qu'IBIS-X serve vraiment un chercheur »

> **Version** : 1.0 — 19 juillet 2026
> **Auteur** : audit technique à la demande d'Anthony (« fais un audit de TOUT ce qu'il faudrait rajouter »).
> **Contexte** : présentation du 20/07 devant des enseignants-chercheurs de l'École de Management de la Sorbonne (juristes, économistes, politistes).
> **Nature du document** : inventaire exhaustif d'idées, priorisé. Ce n'est PAS un cahier des charges à implémenter en bloc — c'est une carte du territoire pour décider quoi construire, dans quel ordre, et pourquoi.
> **Documents liés** : [demo-20min.md](demo-20min.md), [presentation-20-juillet.md](presentation-20-juillet.md), [parcours/CAHIER-DES-CHARGES.md](parcours/CAHIER-DES-CHARGES.md).

---

## 0. TL;DR — le verdict en une page

**IBIS-X sert déjà réellement un chercheur, mais comme instrument d'analyse *exploratoire et prédictive explicable*, pas comme substitut à sa boîte à outils économétrique/inférentielle.** Le pipeline complet fonctionne (catalogue éthique → wizard → entraînement réel reproductible → XAI mesurée), un chercheur peut **uploader ses propres données** et **télécharger un modèle `.joblib` reproductible**. C'est authentique et honnête (principes P1–P7).

Ce qui l'empêche aujourd'hui d'être cité tel quel dans un papier de SHS tient en **trois manques structurants** :

1. **Prédiction ≠ causalité.** L'outil mesure des associations (SHAP, importance) ; un économiste veut des *effets causaux* (DiD, IV, effets fixes). C'est le décalage n°1.
2. **Aucune inférence statistique.** Ni coefficients, ni p-values, ni intervalles de confiance, ni validation croisée. Un résultat sans quantification de l'incertitude n'est pas publiable.
3. **Aucun livrable citable.** Le `.joblib` ne se cite pas ; il manque le rapport méthodo+résultats+figures exportable.

**La bonne nouvelle** : les deux premiers manques les plus « parlants » pour ce public (régression logistique à coefficients, et validation croisée + intervalles) sont **peu coûteux** parce que l'architecture est faite pour ça (registre d'algos = « 1 wrapper + 1 entrée », `algorithms.py:1`). Le reste est une feuille de route.

> **Ce document liste ~60 idées.** Elles ne sont pas toutes à faire. La [§4 matrice de priorisation](#4-matrice-de-priorisation) et la [§5 feuille de route](#5-feuille-de-route-proposée-3-horizons) trient. La [§6](#6-focus-public-école-de-management-sorbonne) fait le lien avec le public de lundi.

---

## 1. Ce que l'outil fait DÉJÀ (la ligne de base honnête)

Pour ne rien recommander qui existe, ni sous-estimer l'existant. Vérifié dans le code le 19/07/2026.

| Domaine | Existant | Fichier |
|---|---|---|
| **Tâches** | Classification + régression supervisées | `ml/preprocessing.py` |
| **Algorithmes** | Arbre de décision, forêt aléatoire (sklearn, `random_state=42`) | `ml/algorithms.py:92` |
| **Preprocessing** | Imputation moyenne/médiane/mode/constante/**KNN**/**iterative (MICE)**, drop lignes/colonnes ; scaling standard/minmax/robust ; encodage onehot/ordinal ; exclusion colonnes ID ; normalisation des tokens manquants ; **fit sur train uniquement (zéro fuite)** | `ml/preprocessing.py:125` |
| **Split** | Train/test stratifié, `test_size` réglable | `ml/preprocessing.py:216` |
| **Métriques classif.** | Accuracy, precision/recall/F1 (weighted + macro), ROC-AUC, PR-AUC, matrice de confusion, per-classe, OOB | `ml/evaluation.py:34` |
| **Métriques régression** | MAE, MSE, RMSE, R², résidus, prédit vs réel | `ml/evaluation.py:103` |
| **Explicabilité** | SHAP + LIME (global + **local**), importance native (Gini), arbre lisible exporté | `xai/engine.py`, `ml/evaluation.py:140` |
| **Qualité XAI mesurée** | Complétude SHAP, **stabilité inter-seeds (Spearman 42–46)**, accord SHAP↔LIME, parcimonie, fidélité LIME | `xai/quality.py` |
| **XAI adaptative** | Texte novice/intermédiaire/expert, LLM avec **repli honnête « Généré sans IA »** | `llm/xai_text.py` |
| **Éthique données** | Scoring multi-critères pondéré tristate (vrai/faux/non renseigné) | `scoring/formulas.py` |
| **Données chercheur** | **Upload de son propre CSV** (rôle contributor), profilage + scoring auto | `datasets/routes.py:102` |
| **Reproductibilité** | Modèle `.joblib` téléchargeable {modèle + pipeline + features + config} | `experiments/routes.py:128` |
| **Comparaison** | Comparaison de plusieurs expériences | `experiments/routes.py:149` |
| **Qualité données** | Test de normalité (`normaltest`) pour guider les stratégies | `ml/quality.py:33` |

**En clair : la « plomberie » est excellente et honnête. Ce qui manque, ce sont les *méthodes* et les *livrables* qu'attend spécifiquement la recherche quantitative en SHS.**

---

## 2. Le manque qui structure tout : prédiction vs causalité vs inférence

Avant la liste, le cadre mental. La recherche quantitative en SHS se joue sur **trois registres** que l'outil ne couvre pas également :

| Registre | Question type | Ce qu'attend le chercheur | État IBIS-X |
|---|---|---|---|
| **Prédictif** | « Peut-on prédire Y ? » | Métriques de performance, généralisation | ✅ **Couvert** (c'est le cœur actuel) |
| **Inférentiel** | « Quel est l'effet de X sur Y, et suis-je sûr ? » | Coefficient, signe, magnitude, **IC / p-value** | ❌ **Absent** |
| **Causal** | « Si on change X, Y change-t-il *à cause de* X ? » | Identification (DiD, IV, RDD), hypothèses explicites | ❌ **Absent** |

L'importance SHAP répond à « quelles variables le modèle utilise-t-il », **pas** à « quelles variables *causent* Y ». Confondre les deux est l'erreur que le public sanctionnera. **Tout le reste de l'audit découle de vouloir monter dans les registres inférentiel et causal — ou d'assumer clairement de rester dans le prédictif et de le rendre irréprochable.**

C'est aussi un **choix de positionnement produit**, pas seulement technique :

- **Option « rester prédictif, mais irréprochable »** → priorité aux quick wins d'inférence légère (CV, IC bootstrap, fairness) et aux livrables. Le message : *« le meilleur outil no-code de modélisation prédictive explicable et honnête »*.
- **Option « monter vers l'inférence/causalité »** → grand pari, ajoute un vrai module économétrique. Le message : *« de l'exploration jusqu'à l'estimation causale, sans coder »*. Beaucoup plus ambitieux, beaucoup plus long.

---

## 3. L'audit thématique complet (toutes les idées)

Chaque idée porte : **Impact recherche** (⭐ à ⭐⭐⭐), **Effort** (🟢 faible / 🟡 moyen / 🔴 élevé), et **Public** concerné (J = juristes, É = économistes, P = politistes, T = tous).

### A. Modèles & méthodes ML

| # | Idée | Pourquoi | Impact | Effort | Public |
|---|---|---|---|---|---|
| A1 | **Régression logistique / linéaire** au registre | Le langage natif des économistes : coefficients, signe, magnitude, **odds-ratios**. Rend l'outil crédible instantanément. Le registre est fait pour ça. | ⭐⭐⭐ | 🟢 | É P |
| A2 | **Régularisation Ridge / Lasso / ElasticNet** | Sélection de variables automatique, standard en éco appliquée ; gère p proche de n. | ⭐⭐ | 🟢 | É |
| A3 | **Gradient boosting (XGBoost / LightGBM)** | Performance de référence ; « et si on poussait la précision ? ». | ⭐ | 🟡 | T |
| A4 | **Modèles intrinsèquement interprétables (GAM, EBM d'InterpretML)** | Interprétabilité *sans* SHAP : effets non-linéaires lisibles. Idéal pour la promesse « explicable ». | ⭐⭐ | 🟡 | T |
| A5 | **Non-supervisé : ACP/ACM, k-means, clustering hiérarchique** | Les politistes/sociologues font des **typologies** (ACP/ACM) en permanence. Aujourd'hui : zéro. Gros angle mort. | ⭐⭐⭐ | 🟡 | P J |
| A6 | **Régression ordinale** (échelles de Likert) | Les enquêtes SHS sont pleines d'échelles 1–5. La traiter comme numérique ou catégorielle est faux. | ⭐⭐ | 🟡 | P É |
| A7 | **Modèles de comptage (Poisson, binomiale négative)** | Nombre d'événements (grèves, brevets, plaintes). | ⭐ | 🟡 | É |
| A8 | **Analyse de survie / durée (Cox, Kaplan-Meier)** | Durée de chômage, survie d'entreprise, **temps jusqu'à récidive** (juristes), maintien au pouvoir. | ⭐⭐ | 🔴 | É J P |
| A9 | **Modèles multiniveaux / à effets mixtes** | Individus nichés dans pays/régions/écoles — omniprésent en science po comparée. | ⭐⭐ | 🔴 | P É |
| A10 | **Gestion du déséquilibre de classes** (class_weight, SMOTE) | Événements rares (fraude, faillite, récidive). | ⭐ | 🟢 | T |

### B. Inférence statistique & incertitude *(le manque criant pour la crédibilité)*

| # | Idée | Pourquoi | Impact | Effort | Public |
|---|---|---|---|---|---|
| B1 | **Validation croisée k-fold** (+ répétée) | Aujourd'hui **un seul split** (`preprocessing.py:216`). Un unique 80/20 est fragile ; la CV est le minimum attendu pour un résultat sérieux. | ⭐⭐⭐ | 🟢 | T |
| B2 | **Intervalles de confiance sur les métriques et les prédictions** (bootstrap, conformal prediction) | « 0,82 ± quoi ? ». Sans incertitude, pas de résultat publiable. Le bootstrap réutilise l'infra de ré-échantillonnage déjà présente (stabilité inter-seeds). | ⭐⭐⭐ | 🟡 | T |
| B3 | **IC / p-values sur les coefficients** (couplé à A1) | Table de régression « prête à publier » (style stargazer/outreg). | ⭐⭐⭐ | 🟡 | É P |
| B4 | **Tests statistiques exploratoires** (t-test, χ², corrélations, ANOVA) | Le b.a.-ba de l'analyse SHS, en amont du ML. | ⭐⭐ | 🟢 | T |
| B5 | **Correction des comparaisons multiples** (Bonferroni, FDR) | Crédibilité méthodologique ; anticipe le reproche du « p-hacking ». | ⭐ | 🟢 | É P |
| B6 | **Analyse de puissance / taille d'échantillon** | Les SHS ont souvent un petit n : alerter quand le n est trop faible. | ⭐⭐ | 🟡 | T |
| B7 | **Détection de multicolinéarité (VIF)** | Indispensable pour interpréter des coefficients (couplé à A1). | ⭐ | 🟢 | É |

### C. Inférence causale *(la vraie différence de registre)*

| # | Idée | Pourquoi | Impact | Effort | Public |
|---|---|---|---|---|---|
| C1 | **Module « causalité » explicite** : DiD, variables instrumentales, RDD, matching (PSM), effets fixes | Le cœur de l'éco appliquée moderne. Passer de « corrélé » à « cause ». | ⭐⭐⭐ | 🔴 | É P |
| C2 | **Diagramme causal (DAG) pour poser les hypothèses** | Rend explicites les hypothèses d'identification (langage de Pearl / dowhy). Pédagogique ET rigoureux. | ⭐⭐ | 🔴 | É P |
| C3 | **Effets de traitement hétérogènes (causal forests, double ML — EconML)** | **Pont naturel** avec les forêts aléatoires déjà présentes ; à la frontière de la recherche. | ⭐⭐ | 🔴 | É |
| C4 | **Analyse de sensibilité aux confondeurs non observés** (E-value, bornes de Rosenbaum) | « Et si une variable manquait ? » — la question qu'un rapporteur pose toujours. | ⭐⭐ | 🔴 | É P |
| C5 | **Garde-fou « associationnel, pas causal »** systématique dans la XAI | Honnêteté (P1) : un bandeau qui rappelle que SHAP ≠ effet causal. **Quasi gratuit et très crédibilisant.** | ⭐⭐⭐ | 🟢 | T |

### D. Données : ingestion, types, structure

| # | Idée | Pourquoi | Impact | Effort | Public |
|---|---|---|---|---|---|
| D1 | **Import Excel (.xlsx), SPSS (.sav), Stata (.dta), SAS** | Les SHS ne travaillent **pas** en CSV. Aujourd'hui c'est une barrière d'entrée massive. Levier d'adoption énorme. | ⭐⭐⭐ | 🟡 | T |
| D2 | **Connecteurs sources publiques** (INSEE, Eurostat, data.gouv, ESS, API) | Où vivent réellement les données SHS françaises/européennes. | ⭐⭐ | 🔴 | É P |
| D3 | **Données de panel / longitudinales** (identifiant × temps) | Structure de données SHS par excellence (avant/après, cohortes). | ⭐⭐⭐ | 🔴 | É P |
| D4 | **Séries temporelles & prévision** (saisonnalité, tendance) | Conjoncture éco, indicateurs, prévision électorale temporelle. | ⭐⭐ | 🔴 | É P |
| D5 | **Poids de sondage / plan d'échantillonnage complexe** | Enquêtes INSEE/ESS/Eurobaromètre **exigent** des poids ; les ignorer biaise tout. | ⭐⭐⭐ | 🟡 | P É |
| D6 | **Texte / NLP** : classification, topic modeling, sentiment, analyse de corpus | Juristes (jurisprudence, contrats), politistes (discours, programmes, débats parlementaires). Registre entier absent. | ⭐⭐⭐ | 🔴 | J P |
| D7 | **Données géospatiales** (cartes choroplèthes) | Géographie électorale, économique, inégalités territoriales. | ⭐ | 🔴 | P É |
| D8 | **Jointure / fusion de datasets** | Enrichir ses données avec des variables externes (INSEE + son enquête). | ⭐⭐ | 🟡 | T |
| D9 | **Feature engineering guidé** (dates, variables construites, recodages) | Recoder « âge → tranches », construire des ratios : besoin quotidien. | ⭐⭐ | 🟡 | T |
| D10 | **Imputation multiple avec incertitude propagée (MICE complet)** | L'`IterativeImputer` existe (`preprocessing.py:113`) mais l'incertitude n'est pas propagée ; l'imputation multiple « à la Rubin » est le standard SHS. | ⭐ | 🟡 | É P |

### E. Reproductibilité, livrables & publication *(le pont vers le papier)*

| # | Idée | Pourquoi | Impact | Effort | Public |
|---|---|---|---|---|---|
| E1 | **Rapport de recherche exportable (PDF / Markdown / HTML)** : question, données, méthodo, métriques, figures, explication, limites | **LE livrable manquant.** Transforme « j'ai un modèle » en « j'ai un artefact citable ». Déjà identifié en [V1.1]. | ⭐⭐⭐ | 🟡 | T |
| E2 | **Figures qualité publication** (SVG/PDF vectoriel, N=, légendes, noir & blanc) | Coller directement dans un article. | ⭐⭐ | 🟡 | T |
| E3 | **Tables exportables (LaTeX / Word / CSV)** | Tables de régression prêtes à coller (couplé à A1/B3). | ⭐⭐ | 🟡 | É P |
| E4 | **Export du code reproductible** (le pipeline en Python/R généré) | Transparence + réplication ; rassure les rapporteurs. | ⭐⭐ | 🟡 | É |
| E5 | **Empreinte de reproductibilité** (hash des données, versions libs, seed) | « Garantie de réplication » vérifiable — argument de confiance fort. | ⭐⭐ | 🟢 | T |
| E6 | **Model cards & datasheets for datasets** (Mitchell et al., Gebru et al.) | Gouvernance et transparence documentées ; parle aux juristes. | ⭐⭐ | 🟡 | J T |
| E7 | **Distinction exploratoire / confirmatoire (préenregistrement léger)** | Réponse à la crise de réplication ; sérieux méthodologique. | ⭐ | 🟡 | É P |
| E8 | **Citation / DOI de l'analyse + versioning des expériences** | Rendre une analyse référençable. | ⭐ | 🟡 | T |

### F. Rigueur & garde-fous méthodologiques *(prolonge les principes P1–P7)*

| # | Idée | Pourquoi | Impact | Effort | Public |
|---|---|---|---|---|---|
| F1 | **Audit d'équité / fairness** (parité démographique, égalité des chances, disparate impact) | **Central** pour les juristes (discrimination, **AI Act**, RGPD art. 22) et pour tout dataset sensible. Angle fort de différenciation. | ⭐⭐⭐ | 🟡 | J P |
| F2 | **Détection automatique de fuite de données** | Alerter quand une variable « triche » (proxy de la cible). Prolonge la culture anti-T1 du produit. | ⭐⭐ | 🟡 | T |
| F3 | **Alerte de surapprentissage + courbes d'apprentissage** | Écart train/test visible ; garde-fou pédagogique. | ⭐⭐ | 🟢 | T |
| F4 | **Analyse de robustesse / multivers** (sensibilité aux choix de preprocessing) | « Le résultat tient-il si je change une décision ? » — anti-p-hacking. | ⭐⭐ | 🔴 | É P |
| F5 | **Alerte p > n / trop de variables pour le n** | Petit échantillon SHS : éviter les conclusions ineptes. | ⭐⭐ | 🟢 | T |
| F6 | **Détection PII / anonymisation** (bannière PII déjà en [SHOULD] non fait) | Données personnelles = obligation RGPD ; rassure juristes et comités d'éthique. | ⭐⭐ | 🟡 | J T |

### G. Collaboration, gouvernance & éthique de la recherche

| # | Idée | Pourquoi | Impact | Effort | Public |
|---|---|---|---|---|---|
| G1 | **Espaces d'équipe / partage de projet entre co-auteurs** | La recherche est collective ; partager une analyse avec un co-auteur. | ⭐⭐ | 🔴 | T |
| G2 | **Rôles fins (co-auteur, relecteur, lecture seule) + annotations** | Relecture méthodologique, commentaires. | ⭐ | 🟡 | T |
| G3 | **Conformité RGPD** (pseudonymisation, hébergement UE, finalité, consentement) | Condition d'usage sur données réelles en Europe. | ⭐⭐ | 🔴 | J |
| G4 | **SSO institutionnel (Shibboleth / RENATER)** + quotas par labo | Adoption à l'échelle d'une université. | ⭐ | 🔴 | T |
| G5 | **Journal éthique / attestation d'usage** | Traçabilité pour comités d'éthique de la recherche. | ⭐ | 🟡 | J |

### H. Expérience, pédagogie & assistance *(déjà une force — à pousser)*

| # | Idée | Pourquoi | Impact | Effort | Public |
|---|---|---|---|---|---|
| H1 | **Conseiller méthodologique IA** : « pour cette question + ces données, la méthode adaptée serait… » | Oriente vers la bonne méthode (ne l'exécute pas à la place). Prolonge le motif `AiAssist`. Très différenciant. | ⭐⭐⭐ | 🟡 | T |
| H2 | **Recettes / Défis par discipline** (droit, éco, science po) | Extension naturelle de la feature Défis existante, ciblée métier. | ⭐⭐ | 🟢 | J É P |
| H3 | **Mode « traduction » stats ↔ langage courant + glossaire contextuel** | Public hétérogène (néophytes ↔ experts) : chacun son niveau. | ⭐⭐ | 🟢 | T |
| H4 | **Comparaison guidée de spécifications côte à côte** | `compareExperiments` existe (`experiments/routes.py:149`) — l'enrichir en « quelle spécification est robuste ? ». | ⭐⭐ | 🟡 | É P |
| H5 | **Mode « cours / atelier »** (comptes classe, cohortes, suivi) | Le public est *enseignant*-chercheur : usage pédagogique direct. | ⭐⭐ | 🟡 | T |
| H6 | **Pont R / Python** (ouvrir le capot, importer/exporter du code) | Rassure les chercheurs qui veulent vérifier ou prolonger. | ⭐ | 🔴 | É |

### I. Plateforme & passage à l'échelle *(moins prioritaire, listé pour l'exhaustivité)*

| # | Idée | Pourquoi | Impact | Effort | Public |
|---|---|---|---|---|---|
| I1 | **Gros datasets** (échantillonnage intelligent, out-of-core) | Certaines bases SHS sont volumineuses. | ⭐ | 🔴 | T |
| I2 | **API publique / accès programmatique** | Pour les chercheurs qui scriptent. | ⭐ | 🟡 | É |
| I3 | **Marketplace de datasets vérifiés par domaine** | Prolonge le catalogue éthique existant. | ⭐ | 🔴 | T |

---

## 4. Matrice de priorisation

### Quick wins (fort impact × faible effort) — à faire en premier

1. **A1 — Régression logistique/linéaire** (coefficients, odds-ratios) → parle aux économistes, peu coûteux.
2. **B1 — Validation croisée k-fold** → passe d'un résultat « fragile » à « sérieux ».
3. **C5 — Garde-fou « associationnel ≠ causal »** dans la XAI → honnêteté quasi gratuite, très crédibilisante.
4. **E1 — Rapport de recherche exportable** → le livrable citable manquant.
5. **F1 — Audit d'équité / fairness** → différenciant, central pour juristes + AI Act.
6. **B2 — Intervalles de confiance (bootstrap)** → réutilise l'infra de ré-échantillonnage.
7. **D1 — Import Excel/SPSS/Stata** → lève la barrière d'entrée n°1 pour les SHS.

### Gros paris (fort impact × fort effort) — à planifier

- **C1 — Module causalité** (DiD/IV/RDD) : *le* saut qualitatif, mais lourd.
- **D6 — Texte / NLP** : ouvre juristes + politistes, mais c'est un sous-produit entier.
- **D3/D5 — Panel + poids de sondage** : indispensables pour les vraies enquêtes SHS.
- **A5 — Non-supervisé (ACP/ACM/clustering)** : angle mort pour les politistes.

### À faire plus tard / opportuniste (faible impact ou très spécifique)

- A3, A7, D7, E7, E8, G2, G4, H6, I1–I3.

### Carte visuelle (impact ↑ / effort →)

```
Impact
 ⭐⭐⭐ │ C5 B1 A1 E1     B2 D1 F1          C1 D6 D3 D5 A5
       │ (quick wins)     (moyen effort)     (gros paris)
 ⭐⭐  │ F3 B4 B5 E5     A2 A4 B3 F2 H1     C2 C3 C4 D4 A8 A9 F4
       │
  ⭐   │ A10 B7 F5        E4 H2 H3 D9        A3 A7 D7 G4 I1
       └──────────────────────────────────────────────────→ Effort
          🟢 faible          🟡 moyen            🔴 élevé
```

---

## 5. Feuille de route proposée (3 horizons)

### Horizon 1 — « Prédictif irréprochable » (semaines)
Rendre l'existant crédible sans changer de registre. **A1, B1, B2, C5, F1, F3, E1, E5.**
→ Message produit : *« le meilleur outil no-code de modélisation prédictive explicable, honnête et reproductible »*. Suffit à convaincre un chercheur qu'il peut l'utiliser en phase exploratoire et le citer avec prudence.

### Horizon 2 — « Ouvert aux vraies données SHS » (mois)
Lever les barrières d'entrée. **D1 (Excel/SPSS/Stata), D5 (poids), D9 (recodages), A5 (ACP/clustering), A6 (ordinale), H1 (conseiller méthodo), E3 (tables LaTeX).**
→ Message : *« importe ta vraie enquête, obtiens une analyse exploratoire complète ».*

### Horizon 3 — « Monter en registre » (trimestres)
Le grand pari. **C1 (causalité), D3 (panel), D4 (séries temporelles), D6 (texte/NLP), A9 (multiniveaux), G1/G3 (collaboration + RGPD).**
→ Message : *« de l'exploration à l'estimation, sans coder »*. C'est un changement de nature du produit — décision stratégique, pas juste technique.

---

## 6. Focus « public École de Management Sorbonne »

Ce que chaque discipline présente lundi cherchera, et l'idée-clé qui lui parle.

### Juristes
- **Attente** : équité algorithmique, discrimination, explicabilité conforme (AI Act, RGPD art. 22 « droit à l'explication »), analyse de textes juridiques.
- **Idées phares** : **F1 (fairness)**, **C5 (garde-fou causal)**, **F6 (PII/RGPD)**, **E6 (model cards)**, **D6 (NLP jurisprudence)**.
- **Accroche démo** : le biais social réel appris par un modèle (Titanic 1912, ou COMPAS) → « comment le droit encadre-t-il ça ? ».

### Économistes
- **Attente** : coefficients, IC/p-values, causalité, séries/panel, prévision, choix discrets (logit).
- **Idées phares** : **A1 (logit/OLS)**, **B3 (table de régression)**, **C1 (causalité)**, **B1/B2 (CV + IC)**, **D3 (panel)**.
- **Accroche démo** : « quels facteurs sont associés au revenu ? » (Adult-census) → puis le caveat causalité, honnête.

### Politistes
- **Attente** : enquêtes pondérées, typologies (ACP/ACM), prédiction électorale, multiniveaux, analyse de discours.
- **Idées phares** : **A5 (ACP/clustering)**, **D5 (poids de sondage)**, **A9 (multiniveaux)**, **D6 (texte/discours)**, **B4 (tests)**.
- **Accroche démo** : typologie d'électeurs / de pays → ce que l'outil ne fait pas *encore*, mais pourrait.

> **Conseil transversal pour lundi** : la faiblesse (prédiction ≠ causalité) devient une **force de discours** si tu la nommes toi-même. « Voici ce que l'outil fait honnêtement aujourd'hui, voici la frontière, voici la feuille de route. » Un public de chercheurs respecte la lucidité méthodologique bien plus que la survente.

---

## 7. Les 5 quick wins que je recommande, et les 2 faisables avant lundi

| Priorité | Idée | Effet | Faisable avant lundi ? |
|---|---|---|---|
| 1 | **A1 — Régression logistique/linéaire** | Parle aux économistes, registre « 1 wrapper + 1 entrée » | ✅ **Oui** (½ journée : wrapper + IC de coefficients basiques + carte `GET /algorithms`) |
| 2 | **C5 — Garde-fou « associationnel ≠ causal »** | Honnêteté, désamorce l'objection n°1 | ✅ **Oui** (un bandeau i18n dans la XAI + une ligne dans le débrief) |
| 3 | **E1 — Rapport de recherche exportable** | Le livrable citable | 🟡 Serré (MD réaliste, PDF non) |
| 4 | **B1 — Validation croisée** | Crédibilité du chiffre | 🟡 Possible mais touche au worker |
| 5 | **F1 — Audit fairness** | Différenciant, juristes + AI Act | 🔴 Non (à planifier) |

> **Ma reco pour lundi précisément** : ne pas coder dans l'urgence si le risque de casser la démo existe. Les deux ajouts **A1** et **C5** sont à faible risque et à fort effet de discours — si tu veux un « geste fort », ce sont ceux-là. Sinon, la démo actuelle suffit *à condition* d'assumer le cadrage de la [§2](#2-le-manque-qui-structure-tout--prédiction-vs-causalité-vs-inférence). Le détail des scénarios est dans [presentation-20-juillet.md](presentation-20-juillet.md).

---

## 8. Ce qu'il ne faut PAS faire (garde-fous)

- **Ne pas simuler** une capacité absente pour la démo (viole P1). Mieux vaut dire « pas encore » que faire semblant.
- **Ne pas présenter l'importance SHAP comme un effet causal.** Jamais.
- **Ne pas tout construire.** Ce document liste ~60 idées *pour choisir*, pas pour tout faire. La valeur est dans le tri (§4–5).
- **Ne pas dénaturer le positionnement** en empilant des méthodes sans fil directeur : chaque horizon (§5) a un message clair. Choisir le message d'abord, les features ensuite.
