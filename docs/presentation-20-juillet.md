# Présentation IBIS-X — réunion du 20 juillet 2026

> **Public** : enseignants-chercheurs de l'École de Management de la Sorbonne — **juristes, économistes, politistes**. Niveaux hétérogènes (certains connaissent GPT, d'autres néophytes).
> **Format** : 3 scénarios préparés → **2 joués en live**, **1 en vidéo** pour les absents.
> **Objectif d'Anthony** : montrer que l'outil produit de **vrais** résultats utiles à un chercheur, honnêtement.
> **À lire avec** : [audit-valeur-recherche.md](audit-valeur-recherche.md) (ce que l'outil fait / ne fait pas), [demo-20min.md](demo-20min.md) (script détaillé du parcours).

---

## 0. Le fil rouge (une phrase à répéter)

> *« IBIS-X ne remplace pas Stata ou R pour l'inférence causale. Il démocratise la modélisation prédictive **explicable et honnête** : en quelques minutes, sans coder, on obtient un vrai modèle reproductible et on comprend quels facteurs y sont associés — un point de départ exploratoire, lucide sur ses limites. »*

Ce cadrage n'est pas une excuse : devant des chercheurs, **assumer la frontière méthodologique est ce qui rend crédible**. Tu nommes la limite avant qu'on te la reproche.

---

## 1. Sélection recommandée

| Scénario | Titre | Public visé | Mode | Durée | Risque |
|---|---|---|---|---|---|
| **A** | « De zéro à un modèle expliqué » | Néophytes / tous | 🔴 **LIVE** (ouverture) | ~8 min | Très faible |
| **B** | « Le replay » — rejouer une étude sur des données réelles | Économistes (+ tous) | 🔴 **LIVE** (clou) | ~12 min | Moyen |
| **C** | « Ouvrir la boîte noire » — biais, éthique, explicabilité | Juristes / politistes | 🎥 **VIDÉO** | ~7 min | Faible (maîtrisé au montage) |

Logique : **A** met tout le monde à niveau et crée le premier « waouh » accessible ; **B** répond frontalement à « est-ce que ça sert MA recherche ? » ; **C** en vidéo adresse le public juriste/éthique avec un cas fort, sans risque live.

---

## 2. Scénario A — « De zéro à un modèle expliqué » *(LIVE, ouverture)*

**Promesse** : un non-codeur part d'une question et repart, en 8 minutes, avec un vrai modèle et une explication qu'il comprend.

**Dataset** : `student_performance` (**déjà seedé**). Question : *« Quels facteurs sont associés à la réussite des élèves ? »* — universelle, parlante pour des enseignants.

**Pourquoi ce dataset** : relatif à l'enseignement (le public EST enseignant), petit, rapide, sans sujet sensible, parcours 100 % rodé (c'est le socle de [demo-20min.md](demo-20min.md) et d'un Défi existant).

### Script (minute par minute)
1. **0–1 min** — Landing + « le parcours en 4 temps ». Poser la question de recherche à voix haute.
2. **1–2 min** — Onboarding en 3 questions : montrer que **l'aisance IA déclarée pilotera le niveau de langage** des explications (personnalisation réelle).
3. **2–3 min** — Catalogue : ouvrir la fiche `student_performance`, insister 20 s sur l'**onglet éthique tristate** (vrai / faux / **non renseigné** — jamais inventé).
4. **3–5 min** — Wizard : cible suggérée, **stratégie de nettoyage réellement appliquée** (montrer le récap « transformations appliquées » = contrat d'honnêteté), split, arbre de décision (« explicabilité maximale »).
5. **5–6 min** — Lancement → **console temps réel** (SSE) : file, logs du worker. ~1 s → résultats (F1, matrice de confusion, importance).
6. **6–8 min** — **Explicabilité** : « Générer l'explication » → SHAP global + **KPI de fiabilité mesurés** (stabilité, parcimonie) + texte niveau débutant. Chat : « quelle variable compte le plus ? ».

### Le moment « waouh »
Le récap « transformations réellement appliquées » + les KPI de fiabilité **mesurés** : « ce n'est pas une démo qui fait semblant, tout est calculé et re-vérifiable. »

### Objection probable → réponse
- *« C'est joli mais est-ce sérieux ? »* → montrer que le modèle est **téléchargeable (`.joblib`) et reproductible (`random_state=42`)**, et enchaîner sur le scénario B (« justement, sur de vraies données de recherche… »).

---

## 3. Scénario B — « Le replay » *(LIVE, le clou)*

**Promesse** : reproduire, en direct et sans coder, la **partie prédictive** d'une étude classique — sur des données qu'un chercheur pourrait apporter — et mesurer le **gain de temps**.

**Dataset** : **Adult / Census Income** (jeu ouvert, ~48 000 individus, UCI/Kaggle). Cible : `income` (> 50 K\$ ou non) à partir de variables socio-démographiques (âge, éducation, heures, secteur…). Question : *« Quels facteurs sont associés au fait de gagner plus de 50 K\$ ? »*

**Pourquoi ce dataset** :
- **Économistes** : c'est un classique de l'économie du travail (déterminants du revenu) — ils le reconnaîtront.
- **Bonus fairness** : il porte un écart hommes/femmes et par origine → transition naturelle vers le sujet du scénario C.
- **Ouvert et propre** : pas de dépendance à un chercheur parisien précis (réponse retenue : « prends un classique ouvert »).

> **Alternative selon la salle** : si le public penche juriste/politiste, remplacer par **COMPAS** (récidive) — mais c'est un sujet plus sensible, je le réserverais à la vidéo C. Garder Adult pour le live économiste.

### Script (minute par minute)
1. **0–2 min** — Poser l'étude : « imaginez le papier *quels déterminants du salaire ?* ; classiquement, des heures de nettoyage + du code Stata. Ici : ».
2. **2–4 min** — **Upload du CSV** (rôle contributor) → profilage automatique + **scoring éthique** calculé sur SES données. C'est le geste « j'apporte mes données ».
3. **4–7 min** — Wizard : cible `income`, nettoyage recommandé appliqué, **forêt aléatoire**. Lancement → résultats (F1, ROC-AUC, importance des variables).
4. **7–9 min** — Lecture des résultats en économiste : « éducation et heures travaillées ressortent — cohérent avec la littérature ». **Importance des variables** à l'écran.
5. **9–11 min** — **LE caveat, assumé** : « attention — ceci est **associationnel, pas causal**. L'outil ne dit pas que faire +1 an d'études *cause* +X\$. Pour ça il faudrait un design causal (DiD, IV) — c'est sur la feuille de route, pas dans l'outil aujourd'hui. » (voir [audit §2](audit-valeur-recherche.md)).
6. **11–12 min** — Le **gain de temps** : « de la donnée brute à un modèle expliqué et **téléchargeable** en ~10 min, sans une ligne de code, reproductible ». Télécharger le `.joblib` à l'écran.

### Le moment « waouh »
L'**upload de données réelles** + résultat crédible en minutes → « ça marche avec MES données, pas juste vos exemples ».

### Objections probables → réponses
- *« Ce n'est que de la corrélation / ce n'est pas causal. »* → **Exactement, et je le dis avant vous.** C'est un outil exploratoire et prédictif ; l'inférence causale est un horizon documenté (montrer l'audit). Cette lucidité = ta force.
- *« Où sont mes coefficients / p-values ? »* → Aujourd'hui l'outil donne l'**importance** des variables, pas des coefficients d'un logit. C'est le **quick win n°1** de la feuille de route (régression logistique). Tu peux le montrer sur l'audit.
- *« La forêt aléatoire, c'est une boîte noire. »* → Enchaîner sur la XAI (SHAP) et annoncer le scénario C.

### Risques & plan B
- **Upload qui échoue en live** → **pré-uploader le dataset avant la séance** (backup dans le catalogue), et basculer dessus si besoin. Tester le CSV exact la veille (encodage, en-têtes, séparateur).
- **Dataset volumineux** → Adult ~48 k lignes s'entraîne en secondes ; vérifier la veille. Si lenteur, réduire à un échantillon propre.
- **Limite de taille d'upload** → vérifier `upload_max_bytes` dans `.env` ; Adult brut fait ~4 Mo (OK).

---

## 4. Scénario C — « Ouvrir la boîte noire » *(VIDÉO)*

**Promesse** : l'IA explicable et honnête comme **sujet** — biais, équité, transparence. Pensé pour les **juristes** (AI Act, discrimination, RGPD art. 22) et **politistes** (justice, biais).

**Dataset** : **COMPAS** (ProPublica, ouvert) — score de risque de récidive, célèbre pour son **biais racial**. À défaut, **Titanic** (biais social de classe/sexe de 1912, déjà seedé) — moins polémique, tout aussi parlant.

**Pourquoi la vidéo** : sujet sensible → mieux vaut le **maîtriser au montage** que le risquer en live ; et il est plus « bavard » (on commente, on met en pause).

### Storyboard (~7 min)
1. **0–1 min** — Le cas : « un algorithme prédisait le risque de récidive aux États-Unis — et reproduisait un biais racial. Comment un outil *explicable* aide-t-il à le voir ? »
2. **1–3 min** — Entraînement réel sur COMPAS → résultats. Puis **SHAP local sur un individu** : « pourquoi CE cas a-t-il été classé à risque ? » (explication locale = force du produit).
3. **3–4 min** — **Comparaison de deux modèles** (`compareExperiments`) : montrer que le choix de méthode change les erreurs.
4. **4–5 min** — L'**honnêteté machine** : badge « Généré sans IA (repli déterministe) » → « l'outil ne bluffe jamais sur ce qu'il sait ». Scoring éthique tristate.
5. **5–7 min** — Le pont **droit/éthique** : ce que l'AI Act et le RGPD exigent (explicabilité, non-discrimination) ; **ce que l'outil ne fait pas encore** (audit d'équité formel = feuille de route, [audit §F1](audit-valeur-recherche.md)). Conclusion lucide.

### Note de tournage
- Enregistrer en **1440p**, thème clair, zoom sur les chiffres.
- Sous-titres FR (public hétérogène).
- Pré-entraîner les expériences AVANT de tourner (pas d'attente à l'écran).
- Préparer une **2ᵉ vidéo courte du scénario A** (parcours néophyte) pour les absents les plus novices.

---

## 5. Antisèche anti-objection (à garder sous les yeux)

| Ce qu'on te dit | Ta réponse en une phrase |
|---|---|
| « Ce n'est pas causal. » | « Exact, et je le dis avant vous : c'est exploratoire et prédictif, la causalité est un horizon assumé. » |
| « Où sont les p-values / coefficients ? » | « L'outil donne l'importance des variables ; le logit à coefficients est le prochain ajout prévu. » |
| « La forêt est une boîte noire. » | « D'où la XAI : SHAP global ET local, avec des KPI de fiabilité mesurés. » |
| « Un seul split, c'est fragile. » | « Vrai — la validation croisée est le quick win n°2 de la feuille de route. » |
| « Et mes données SPSS/Stata ? » | « CSV aujourd'hui ; l'import SPSS/Stata est identifié comme la barrière d'entrée n°1 à lever. » |
| « C'est un jouet pédagogique. » | « Le résultat est réel, reproductible (`seed=42`) et téléchargeable. Le pédagogique, c'est le *guidage*, pas le résultat. » |
| « Ça hallucine comme ChatGPT ? » | « Non : sans clé LLM, il passe en repli déterministe *explicitement marqué*. L'honnêteté est un principe du produit. » |

---

## 6. Checklist technique J-1 (dimanche soir)

```bash
# 1. Repartir propre
docker compose down -v && docker compose up -d
docker compose exec api ibis seed          # admin + 6 datasets

# 2. Vérifier la stack
#   web http://localhost:3000  |  api http://localhost:8000/api/v1/docs
#   /status = santé + démo SSE

# 3. Pré-charger les datasets du scénario B (et C) EN AMONT (plan B upload)
#   - Adult-census : télécharger le CSV, le pré-uploader via l'UI (compte contributor)
#   - COMPAS : nettoyer en un CSV propre (colonnes utiles) AVANT, pré-uploader
```

- [ ] Compte de démo prêt : `admin@ibisx-demo.org` / `admin-ibisx-2026` (+ un compte contributor « néophyte » avec crédits pour le scénario A).
- [ ] **Rejouer les 2 scénarios live en entier** une fois, chrono en main.
- [ ] Vérifier les **crédits** suffisants sur les comptes (chaque entraînement = 1 crédit).
- [ ] **Pré-entraîner** les expériences du scénario C avant de tourner la vidéo.
- [ ] Tester le CSV Adult exact (encodage UTF-8, en-têtes, séparateur `,`, taille < `upload_max_bytes`).
- [ ] **Plan B hors-ligne** : tout est local (Docker), aucune dépendance réseau — confirmer qu'aucune clé LLM n'est requise (repli déterministe OK).
- [ ] Navigateur en plein écran, zoom lisible, thème clair, notifications coupées.
- [ ] Slide/onglet ouvert sur [audit-valeur-recherche.md](audit-valeur-recherche.md) §4–5 pour montrer la feuille de route si on te pousse sur les manques.

---

## 7. Message de clôture (30 secondes)

> *« Ce que vous venez de voir est réel, reproductible et honnête sur ses limites. Aujourd'hui, IBIS-X vous fait gagner du temps en phase exploratoire et rend l'IA explicable accessible à qui ne code pas. Demain — coefficients, validation croisée, audit d'équité, import de vos formats — la feuille de route est écrite. Ce n'est pas un substitut à votre méthode : c'est un accélérateur qui la respecte. »*
