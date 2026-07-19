# Spec Fonctionnelle — web/fairness [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | web/fairness        |
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

*Aucun ADR lié.*

> *Table auto-générée par adr-linker. Ne pas éditer manuellement.*

---

## Contexte et objectif

Le comparateur d'équité est l'onglet « Équité » de la page de résultats d'expérience
(`/experiments/[id]`). Il permet à l'utilisateur de vérifier si le modèle ML entraîné
traite tous les groupes d'une variable sensible de manière comparable, en affichant
les métriques de performance par groupe ainsi que les indicateurs de disparité.

L'objectif est pédagogique et de vigilance : signaler une disparité mesurée sans
prétendre établir une discrimination juridique.

## Règles métier (déduites du code)

1. **Classification uniquement.** Si le `taskType` de l'expérience est `"regression"`,
   le panneau affiche un message informatif et aucune analyse n'est lancée.

2. **Détection automatique des colonnes candidates.** Le panneau construit une liste de
   colonnes candidate en combinant :
   - les colonnes dont le nom correspond à un attribut potentiellement protégé détecté
     par tokenisation (7 catégories : sexe, âge, race, origine, religion, handicap, famille),
   - les colonnes de type catégoriel ou booléen du dataset (selon le profilage backend).
   La liste est dédupliquée et tronquée à 8 éléments.

3. **Sélection manuelle de la variable sensible.** L'analyse ne se déclenche que lorsque
   l'utilisateur choisit explicitement une variable dans la liste candidate.

4. **Limite de cardinalité (backend).** Si la colonne sensible choisie comporte plus de
   12 valeurs distinctes dans le jeu de test, le backend rejette la requête
   (code `FAIRNESS_TOO_MANY_GROUPS`). Le panneau affiche alors un message d'erreur
   générique invitant à choisir une variable à faibles modalités.

5. **Métriques binaires vs multiclasse.**
   - En classification **binaire** : taux de sélection (parité démographique), taux de
     vrais positifs (égalité des chances), exactitude, ratio des taux de sélection,
     écart de vrais positifs, écart d'exactitude.
   - En classification **multiclasse** : exactitude par groupe uniquement (les autres
     métriques n'ont pas de définition univoque).

6. **Règle des 80 % (disparate impact).** En binaire, le badge « Disparité détectée »
   s'affiche si le ratio des taux de sélection (`min/max`) est inférieur à 0,8.
   En l'absence de disparité, le badge indique « Pas de disparité majeure ».

7. **Issue favorable par défaut.** Lorsque le champ `favorable` n'est pas transmis,
   le backend détermine l'issue favorable comme la dernière classe triée alphabétiquement.
   Ce paramètre est actuellement non exposé dans l'interface web (champ optionnel backend
   utilisé uniquement dans les tests).

8. **Garde-fou causalité.** Un texte de mise en garde rappelle systématiquement que la
   disparité mesurée ne constitue pas à elle seule une preuve de discrimination — il faut
   croiser avec le contexte des données.

9. **Annulation des requêtes en vol.** Le composant utilise un drapeau `alive` dans chaque
   `useEffect` : si le composant est démonté ou si une nouvelle sélection est faite avant
   la fin d'une requête, la réponse de la requête précédente est ignorée (pas de mise à
   jour de l'état sur un composant démonté ou obsolète).

## Cas d'usage (déduits)

### CU-001 — Sélectionner une variable sensible et consulter les métriques par groupe

**Acteur :** utilisateur ayant terminé une expérience de classification.

**Flux principal :**
1. L'utilisateur ouvre l'onglet « Équité » sur la page de résultats d'une expérience.
2. Le panneau charge la liste des colonnes du dataset et affiche les candidats
   (variables sensibles détectées + colonnes catégorielles).
3. L'utilisateur clique sur une variable (ex. « sex »).
4. Le panneau appelle le backend et affiche le tableau de métriques par groupe,
   les indicateurs de disparité et le garde-fou.

**Flux alternatif — régression :**
- Si l'expérience est de type régression, le panneau affiche uniquement le message
  « L'analyse d'équité s'applique aux modèles de classification, pas de régression. »

**Flux alternatif — aucune colonne détectée :**
- Si aucune colonne candidate n'est trouvée, le panneau affiche
  « Aucune variable catégorielle exploitable détectée dans ce jeu. »

**Flux alternatif — colonne trop granulaire :**
- Si la colonne choisie comporte plus de 12 valeurs distinctes, le backend renvoie
  une erreur et le panneau affiche le message d'erreur générique.

### CU-002 — Changer de variable sensible

**Flux :**
1. L'utilisateur clique sur un autre bouton de la liste candidate.
2. La requête précédente est abandonnée (drapeau `alive`).
3. La nouvelle analyse est chargée et remplace l'affichage précédent.

## Dépendances

- **Backend :** `GET /experiments/{experiment_id}/fairness?sensitive_column=X`
  (opération `getFairnessReport`, générée par `@hey-api/openapi-ts`).
- **Backend :** `GET /datasets/{dataset_id}` (opération `getDataset`) pour la liste
  des colonnes avec leurs types interprétés.
- **Lib :** `detectSensitiveFeatures` depuis `apps/web/lib/lenses/insights.ts`
  (partagée avec la feature `web/lenses`).
- **UI kit :** shadcn/ui (Badge, Button, Card, Skeleton, Table).
- **i18n :** clés `fairness.*` et `causal.*` dans `apps/web/messages/fr.json` et `en.json`.

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Issue favorable configurable.** Le paramètre `favorable` est prévu dans le backend
  (et testé) mais n'est pas exposé dans l'interface web. Est-ce un choix définitif ou
  une fonctionnalité prévue pour une version ultérieure ?
- **Seuil MAX_GROUPS = 12.** La valeur 12 est documentée comme limite au-delà de laquelle
  le regroupement par valeur brute « n'a plus de sens ». Ce seuil a-t-il été validé
  méthodologiquement ou est-il provisoire ?
- **Colonnes sensibles dans X_test.** Le backend lit la colonne sensible depuis le
  dataframe brut, pas depuis les features d'entraînement. Si une colonne sensible est
  intentionnellement exclue du modèle (fairness-aware), l'analyse reste possible car
  elle utilise la source originale. Ce comportement est-il documenté comme intentionnel
  auprès des utilisateurs ?
