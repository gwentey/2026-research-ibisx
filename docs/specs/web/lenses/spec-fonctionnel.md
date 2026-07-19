# Spec Fonctionnelle — web/lenses [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | web/lenses          |
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

Aucun ADR créé pour cette feature — toutes les décisions techniques identifiées échouent
à la politique ADR v2.3.0 (détail dans le rapport ADR ci-dessous). Les décisions sont
documentées dans `spec-technique.md`.

---

## Contexte et objectif

La feature "Regards métier" permet à un utilisateur de relire les résultats d'une
expérience ML sous l'angle d'une des 6 disciplines des sciences humaines et sociales
(économiste, juriste, politiste, sociologue, historien, éthicien IA).

L'objectif pédagogique est de montrer que les mêmes métriques réelles peuvent être
interrogées de façons radicalement différentes selon la formation du lecteur. La feature
n'invente aucun texte, ne génère aucun appel LLM : elle assemble des phrases
paramétrées à partir des vraies valeurs du résultat.

---

## Règles métier (déduites du code)

1. **Mêmes données, angles différents.** `extractInsights` consomme exclusivement les
   données réelles du résultat (`metrics`, `viz_data`, `class_names`, `task_type`).
   Aucune valeur n'est inventée ou estimée.

2. **Vue classique = absence de regard.** `LensId | null` : la valeur `null` correspond
   à la vue classique (aucune lecture disciplinaire active). Chaque discipline est
   identifiée par un `LensId` parmi les six valeurs possibles.

3. **Discipline par défaut persistée au profil.** L'utilisateur peut choisir une
   discipline de préférence dans son profil (page `/profile`) ; ce choix est retenu en
   localStorage et appliqué automatiquement à l'ouverture d'un résultat — sauf si
   l'utilisateur a explicitement changé de regard sur cette page.

4. **Bascule manuelle éphémère.** Lorsque l'utilisateur change de regard directement
   sur la page résultats (`LensSwitcher`), ce choix est local à la session de navigation
   et ne modifie pas la préférence de profil.

5. **Regard et niveau d'audience sont orthogonaux.** Les deux axes (discipline SHS
   et niveau novice/intermediate/expert) sont indépendants : changer le regard ne
   modifie pas le niveau XAI, et vice-versa.

6. **Détection des attributs sensibles par tokenisation stricte.** Les noms de
   variables sont découpés en tokens (`[^a-z0-9]+`), normalisés (accents, casse) et
   comparés à des listes exactes ou de préfixes. Cette approche évite les faux positifs
   par sous-chaîne (ex. `average` ne doit pas déclencher `age`).

7. **Noms de variables nettoyés des préfixes sklearn.** Les noms bruts comme
   `cat__sex_Male` ou `num__age` sont transformés en `sex_Male` / `age` avant affichage
   (`prettyFeatureName`).

8. **Absence délibérée du motif visuel `--ai`.** Le composant `LensReading` utilise
   un style monochrome sans indicateur IA. Le commentaire source est explicite : ce
   contenu n'est pas généré par IA, donc le pattern `--ai` ne doit pas s'y appliquer.

9. **Bilingue FR/EN.** Tout le contenu textuel des lectures disciplinaires — taglines,
   points, angles morts — est externalisé dans le système i18n `next-intl`
   (`messages/fr.json` et `messages/en.json`, clé `lenses.*`).

10. **Tolérance aux données manquantes.** `extractInsights` retourne un objet valide
    même pour un `RawResults` vide : `topFeatures = []`, `sensitiveFeatures = []`,
    `primaryMetric = null`, etc. Aucun crash si un champ est absent.

---

## Cas d'usage (déduits)

### CU-001 — Consulter un résultat avec un regard disciplinaire

**Acteur :** Utilisateur ayant terminé une expérience ML.

**Précondition :** La page `/experiments/{id}` est ouverte et un résultat est disponible.

**Flux principal :**

1. La page charge les résultats de l'expérience via l'API.
2. `extractInsights` est appelé (useMemo) pour construire l'objet `ResultInsights`.
3. Le regard par défaut est lu depuis le store Zustand (localStorage `ibis:lens`).
4. Le `LensSwitcher` s'affiche avec le regard actif présélectionné (ou « Classique »
   si aucune préférence).
5. L'utilisateur clique sur une discipline (ex. « Juriste »).
6. La carte `LensReading` apparaît : titre de discipline, tagline, 2 à 3 points
   factuels paramétrés, section « Angle mort ».
7. L'utilisateur clique sur « Classique » : la carte disparaît.

**Flux alternatif :** L'utilisateur a une préférence de profil « Sociologue » — à
l'ouverture, le regard Sociologue est pré-sélectionné et la carte affichée sans
action supplémentaire.

### CU-002 — Choisir sa discipline de référence dans le profil

**Acteur :** Utilisateur connecté.

**Flux principal :**

1. L'utilisateur accède à `/profile`.
2. Le composant `DisciplineSelector` affiche les 6 disciplines + « Aucune — vue classique ».
3. L'utilisateur sélectionne une discipline.
4. Le store Zustand persiste le choix dans localStorage.
5. Lors de la prochaine consultation d'un résultat, ce regard est appliqué par défaut.

### CU-003 — Résultat avec variables sensibles détectées

**Contexte :** Le dataset contient des colonnes `cat__sex_Male`, `num__age`.

1. `detectSensitiveFeatures` tokenise les noms et identifie « sex », « age ».
2. La lecture « Juriste » affiche : _"Le modèle s'appuie sur des variables potentiellement
   protégées : le sexe, l'âge."_
3. La lecture « Éthicien IA » reprend la même liste avec son propre angle.

---

## Dépendances

- **`apps/web/app/(app)/experiments/[id]/page.tsx`** — consommateur principal ;
  orchestre `extractInsights`, `useLensStore`, `LensSwitcher`, `LensReading`.
- **`apps/web/app/(app)/profile/page.tsx`** — expose `DisciplineSelector` pour la
  préférence utilisateur.
- **`next-intl`** — externalisation de tout le texte disciplinaire (FR/EN).
- **`zustand` + middleware `persist`** — persistance localStorage de la discipline.
- **API résultats (`ExperimentResults`)** — fournie par le contrat OpenAPI ; `RawResults`
  est le sous-type structurel consommé par `extractInsights`.

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- La liste des 7 attributs sensibles (`SENSITIVE` dans `insights.ts`) est-elle
  définitive pour V1, ou est-elle amenée à être étendue (ex. handicap, union syndicale) ?
  Le code laisse la table ouverte, mais aucune story ne documente le processus d'ajout.

- La décision d'exclure le motif `--ai` pour les lectures disciplinaires est documentée
  en commentaire source mais n'a pas de spec formelle décrivant la règle générale :
  _"quand NE PAS utiliser `--ai`"_ — à valider si une politique globale est prévue.

- Les lectures des disciplines `historian` et `politist` produisent des points fixes
  (pas paramétrés par les métriques réelles, sauf `classCount`/`classNames` pour
  politist). Est-ce un choix V1 assumé ou un manque à combler en V1.1 ?

- Le format de `metricLabel` transmis au regard « économiste » n'est pas documenté :
  la page résultats calcule un libellé humain depuis `primaryKey`, mais la logique
  n'est pas visible dans le snippet analysé.
