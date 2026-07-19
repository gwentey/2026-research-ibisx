# Spec Fonctionnelle — web/wizard [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | web/wizard          |
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

> Aucun ADR RETRO n'a été créé pour cette feature : tous les candidats ont été
> rejetés après passage du filtre politique v2.3.0 (voir rapport ADR en fin de
> spec-technique.md). Les décisions pertinentes sont documentées en spec-technique.md
> et/ou référencent des ADRs existants (ADR-006, ADR-007).

---

## Contexte et objectif

Le wizard ML est le parcours central d'IBIS-X : il guide un utilisateur authentifié
de A à Z dans la création d'une expérience d'apprentissage automatique supervisé,
en 8 étapes actives (la 9e est une redirection automatique vers les résultats).
L'objectif est pédagogique autant que fonctionnel : chaque étape expose un encart
« Comprendre » et des suggestions IA déterministes pour aider les utilisateurs
novices à faire des choix éclairés, sans requérir de connaissances préalables en ML.

Le wizard s'ouvre en passant `?projectId=…&datasetId=…` dans l'URL — il ne peut
pas être ouvert sans ces deux paramètres.

---

## Règles métier (déduites du code)

1. **Pré-requis URL obligatoires** : le wizard est inaccessible sans `projectId` et
   `datasetId` en query string ; un message d'erreur avec lien de retour est affiché.

2. **Reprise de brouillon** : au chargement, un brouillon serveur (upsertDraft/getDraft)
   est récupéré pour `(projectId, datasetId)`. S'il existe, le store est hydraté et
   un toast « Brouillon repris » s'affiche. La reprise n'a lieu qu'une fois par montage
   (garde `hydratedRef`).

3. **Persistance à chaque étape validée** : appuyer sur « Étape suivante » déclenche
   un `upsertDraft` silencieux — l'utilisateur peut fermer le navigateur et reprendre
   là où il s'est arrêté.

4. **Navigation conditionnelle** : un utilisateur ne peut aller qu'à une étape déjà
   atteinte (contrainte `maxReachedStep`). La navigation est désactivée intégralement
   pendant le lancement de l'entraînement (état `starting` ou `running`).

5. **Blocage de progression** (validation centralisée en page) :
   - Étape 2 : progression bloquée si aucune colonne cible, aucun type de tâche, ou
     combinaison incohérente (régression sur colonne catégorielle).
   - Étape 3 : progression bloquée si au moins une colonne non-cible dépasse 30 % de
     valeurs manquantes sans stratégie d'imputation explicitement choisie.
   - Étape 6 : progression bloquée si aucun algorithme n'est sélectionné.

6. **Recommandations IA déterministes** (aucun appel LLM dans le wizard) :
   - Étape 2 : la colonne cible est suggérée par correspondance de noms
     (`target`, `label`, `class`, `outcome`, `species`, `quality`, `score`, `g3`, `survived`).
     Le type de tâche est recommandé : classification si la colonne est catégorielle ou
     a ≤ 10 valeurs distinctes, régression sinon.
   - Étape 5 : en présence de valeurs aberrantes (>10 % sur au moins une colonne),
     la normalisation « Robuste » est recommandée ; sinon « Standard ».
   - Étape 6 : `decision_tree` recommandé si le dataset a < 1000 lignes ET < 15 colonnes,
     sinon `random_forest`. La recommandation est bornée au registre connu.

7. **Seed de reproductibilité figé** : `random_state = 42` est injecté de façon fixe
   dans le payload API (`toExperimentCreate`), quel que soit le choix de l'utilisateur.
   L'étape 4 l'affiche explicitement à titre pédagogique.

8. **Stratification automatique** : en classification, la division train/test est
   stratifiée (mentionné en UI étape 4) pour conserver les proportions de classes.

9. **Stratégies de nettoyage filtrées par type** : les stratégies `mean`, `median`,
   `knn` et `iterative` ne sont proposées que pour les colonnes numériques. Les colonnes
   catégorielles n'exposent que `most_frequent`, `constant`, `drop_rows`, `drop_column`.

10. **Réinitialisation du store sur changement de contexte** : `store.init(projectId, datasetId)`
    remet le store à son état initial si le couple `(projectId, datasetId)` change.

11. **Confirmation avant lancement** : l'utilisateur doit cocher explicitement une case
    avant que le bouton « Lancer l'entraînement » soit activé (étape 8).

12. **Débit de crédit** : un crédit est débité au lancement ; le solde affiché dans le
    rail gauche est rafraîchi via `getMe` après le démarrage de l'expérience.

13. **Délai minimum de console** : la console d'entraînement reste visible au moins
    2600 ms même si le worker termine plus vite, pour que le traitement soit perceptible.

14. **Repli polling 2 s** : si le flux SSE échoue, un polling toutes les 2 secondes
    prend le relais jusqu'à la fin de l'entraînement.

15. **Annulation** : l'utilisateur peut annuler un entraînement en cours (état `running`)
    via le bouton « Annuler » — l'API `cancelExperiment` est appelée.

16. **Intégration traceur de quête** : le composant `QuestTracker` est monté sur toutes
    les pages du wizard ; la présence d'un défi actif réserve dynamiquement la hauteur
    nécessaire (`--quest-tracker-height`) pour que la barre de navigation basse et le
    contenu ne passent pas derrière.

---

## Cas d'usage (déduits)

### CU-001 — Premier entraînement guidé

Un utilisateur novice, sans connaissances ML préalables, arrive depuis la page projet
après avoir sélectionné un dataset. Il suit les 8 étapes dans l'ordre, utilise les
suggestions IA à chaque étape (bouton « Guide-moi »), et lance l'entraînement en
étape 8. Le wizard le redirige automatiquement vers la page de résultats.

### CU-002 — Reprise de brouillon

Un utilisateur a complété les étapes 1 à 5 et fermé le navigateur. En revenant sur
`/wizard?projectId=…&datasetId=…`, le store est hydraté depuis le brouillon serveur,
le curseur se repositionne à l'étape 5, et un toast confirme la reprise.

### CU-003 — Correction d'une étape précédente

Un utilisateur en étape 7 réalise qu'il a choisi la mauvaise colonne cible. Il clique
sur « Étape 2 » dans le rail gauche (étape déjà atteinte), corrige son choix, et
revient en étape 7 via la navigation.

### CU-004 — Nettoyage obligatoire imposé

Au cours de l'étape 3, deux colonnes présentent > 30 % de valeurs manquantes. Le
bouton « Étape suivante » reste désactivé tant qu'une stratégie n'a pas été choisie
pour chacune. L'utilisateur peut cliquer « Appliquer les recommandations » pour
appliquer automatiquement la stratégie recommandée par le backend.

### CU-005 — Entraînement depuis un défi actif

Un utilisateur ayant activé un défi voit le `QuestTracker` en barre basse. La barre
de navigation du wizard se positionne au-dessus du traceur de quête. À la validation
de l'objectif « Lancer l'entraînement », le traceur de quête se met à jour.

---

## Dépendances

### APIs backend consommées
- `getDataset` — métadonnées du dataset (colonnes, stats, objectif)
- `previewDataset` — aperçu des 10 premières lignes
- `getQualityAnalysis` — score qualité, colonnes à nettoyer, valeurs aberrantes, stratégies recommandées
- `listAlgorithms` — registre des algorithmes disponibles avec schémas d'hyperparamètres
- `getDraft` / `upsertDraft` — lecture et écriture du brouillon serveur
- `startExperiment` — création et lancement de l'expérience
- `getExperiment` — polling de statut (repli si SSE indisponible)
- `cancelExperiment` — annulation d'un entraînement en cours
- `getMe` — rafraîchissement du solde de crédits après débit

### Composants partagés importés
- `AppGuard` — protection de route (authentification requise)
- `QuestTracker` — traceur de quête pour les défis actifs
- `WizardShell` — coquille de navigation (rail gauche, header, barre basse)
- `AiAssist` — panneau de recommandation IA unifié (étapes 2, 5, 6, 7)
- `MissionStepper` — indicateur de position dans le parcours mission
- `ProgressRing` — indicateur circulaire d'avancement

### Stores Zustand
- `useWizardStore` — état complet du wizard (étape, paramètres, brouillon)
- `useAuthStore` — utilisateur courant (crédits, mise à jour après débit)

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Coût d'un entraînement en crédits** : le code affiche le solde courant mais ne
  montre pas le coût unitaire exact (toujours 1 crédit ? variable selon l'algorithme ?).
- **Persistance du brouillon lors d'un changement d'algorithme** : si l'utilisateur
  revient à l'étape 6 et change d'algorithme, les hyperparamètres sont réinitialisés
  localement ; mais le brouillon n'est persisté que sur « Étape suivante » — il est
  incertain si un retour en arrière sans passer par « Suivant » persiste le changement.
- **Stratification classification côté backend** : mentionnée dans l'UI (étape 4),
  mais non vérifiée dans le code backend pour confirmer qu'elle est effectivement
  appliquée lors du split.
- **Limite de 10 colonnes dans l'aperçu** : la prévisualisation affiche max 10 colonnes
  et 10 lignes — délibéré ou limitation temporaire ?
- **Étape 9 comme état virtuel** : l'étape 9 n'a pas de contenu propre ; c'est un état
  de transition (store.nextStep() déclenche la redirection). Comportement prévu si
  l'utilisateur navigue manuellement à l'étape 9 sans avoir lancé l'entraînement.
