# Spec Technique — web/fairness

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | web/fairness        |
| Version       | 0.1.0               |
| Date          | 2026-07-19          |
| Source        | Rétro-ingénierie    |

---

## Architecture du module

Le module se compose de deux couches distinctes :

**Couche frontend (React / Next.js App Router)**

`FairnessPanel` est un Client Component (`"use client"`) monolithique qui orchestre
l'ensemble du flux : chargement des colonnes candidates, sélection de la variable
sensible, appel du rapport d'équité, et rendu du tableau de métriques.

Il réutilise `detectSensitiveFeatures` depuis `lib/lenses/insights.ts`, une fonction
pure partagée avec la feature `web/lenses`. Cette dépendance transverse assure
la cohérence entre la détection de variables sensibles dans les « Regards métier »
et dans le comparateur d'équité.

**Couche backend (FastAPI / Python)**

`fairness_report()` dans `apps/api/ibis/modules/xai/fairness.py` :
1. Charge le contexte de l'expérience via `engine.load_experiment_context()` (modèle
   sérialisé + split déterministe).
2. Lit la colonne sensible depuis le **dataframe brut** (avant preprocessing), alignée
   sur les indices du jeu de test (`test_index`).
3. Réexécute `model.predict()` sur `X_test`.
4. Délègue le calcul à `compute_group_fairness()`, une fonction pure sans I/O.

`compute_group_fairness()` est intentionnellement isolée et testée sans infrastructure.

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/web/components/ibis/fairness/fairness-panel.tsx` | Composant React principal — UI complète du panneau | ~261 |
| `apps/web/components/ibis/causal-caveat.tsx` | Composant garde-fou causalité (réutilisable) | ~24 |
| `apps/web/lib/lenses/insights.ts` | Fonctions partagées : `detectSensitiveFeatures`, `extractInsights` | ~127 |
| `apps/web/app/(app)/experiments/[id]/page.tsx` | Page résultats — intègre `FairnessPanel` dans l'onglet « Équité » | ~500 |
| `apps/web/messages/fr.json` | Clés i18n `fairness.*` et `causal.*` (FR) | — |
| `apps/web/messages/en.json` | Clés i18n `fairness.*` et `causal.*` (EN) | — |
| `apps/api/ibis/modules/xai/fairness.py` | Backend — moteur de calcul des métriques d'équité | ~126 |
| `apps/api/ibis/modules/xai/routes.py` | Backend — endpoint `GET /experiments/{id}/fairness` | ~175 |

---

## API / Endpoints

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `GET` | `/experiments/{experiment_id}/fairness` | Rapport d'équité par colonne sensible | JWT requis |

**Paramètres de requête :**

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `sensitive_column` | `string` (min 1 car.) | Oui | Nom de la colonne sensible dans le dataset brut |
| `favorable` | `string` | Non | Étiquette de l'issue favorable (défaut : dernière classe triée) |

**Réponse (classification binaire) :**
```json
{
  "applicable": true,
  "binary": true,
  "favorable": "oui",
  "sensitive_column": "sex",
  "total": 150,
  "groups": [
    {
      "value": "Female",
      "size": 60,
      "accuracy": 0.88,
      "selection_rate": 0.25,
      "tpr": 0.70
    }
  ],
  "disparities": {
    "accuracy_gap": 0.05,
    "selection_rate_ratio": 0.33,
    "tpr_gap": 0.30,
    "four_fifths_pass": false
  }
}
```

**Réponse (régression) :**
```json
{ "applicable": false, "reason": "regression", "sensitive_column": "..." }
```

**Codes d'erreur backend :**

| Code | Condition |
|------|-----------|
| `FAIRNESS_COLUMN_UNKNOWN` | La colonne n'existe pas dans le dataframe brut |
| `FAIRNESS_TOO_MANY_GROUPS` | La colonne a > 12 valeurs distinctes dans le jeu de test |
| `FAIRNESS_LENGTH_MISMATCH` | Incohérence interne entre y_true, y_pred et groups |

---

## Algorithme de détection des colonnes candidates (frontend)

Le composant construit la liste via deux passes sur les métadonnées du dataset :

1. **Attributs sensibles protégés** : `detectSensitiveFeatures(columnNames)` identifie
   les colonnes dont les tokens correspondent à l'un des 7 attributs protégés (RGPD /
   non-discrimination) : sexe, âge, race, origine, religion, handicap, situation de famille.
   La fonction tokenise par `[^a-z0-9]+`, normalise les accents et vérifie les tokens
   par correspondance exacte ou par préfixe (jamais par sous-chaîne) pour éviter les faux
   positifs (ex. `average_score` ne produit pas `age`).

2. **Colonnes catégorielles ou booléennes** : filtre sur `dtype_interpreted` ∈
   `["categorical", "boolean"]` depuis la réponse `getDataset`.

Les deux listes sont dédupliquées (`Set`) et tronquées à 8 éléments.

---

## Algorithme de calcul des métriques (backend)

`compute_group_fairness()` est une fonction pure :

- **Normalisation** : toutes les valeurs (`y_true`, `y_pred`, `groups`) sont converties
  en `str` pour garantir la comparabilité.
- **Détection binaire/multiclasse** : `binary = (len(sorted(set(y_true) | set(y_pred))) == 2)`.
- **Par groupe** (itération sur `sorted(set(groups))`) :
  - `accuracy = nb_corrects / size`
  - Si binaire et `fav` défini :
    - `selection_rate = nb_pred_fav / size`
    - `tpr = nb_pred_fav_parmi_vrais_positifs / nb_vrais_positifs`
- **Disparités** :
  - `accuracy_gap = max(accuracies) - min(accuracies)`
  - Si binaire : `selection_rate_ratio = min(rates) / max(rates)`
  - Si binaire : `tpr_gap = max(tprs) - min(tprs)`
  - Si binaire : `four_fifths_pass = (ratio is None) or (ratio >= 0.8)` — règle des 80 %
    (EEOC disparate impact standard).
- **Limite** : MAX_GROUPS = 12 (vérifié avant appel dans `fairness_report()`).

---

## Décisions techniques

Ces décisions n'ont pas atteint le niveau ADR (voir rapport de filtrage en bas de ce fichier).

### Utilisation du dataframe brut (pas des features d'entraînement)

Le backend lit la colonne sensible depuis `loaded.raw_df` (dataframe original avant
preprocessing), alignée sur `test_index`. Cela permet d'analyser l'équité même si la
colonne sensible a été exclue des features d'entraînement (usage fairness-aware). Les
valeurs one-hot encodées (`sex_Male=0/1`) n'ont pas de sens comme identifiants de groupe.

### Neutralité du motif visuel

Le composant `CausalCaveat` et le texte de garde-fou du panneau (`fairness.caveat`)
utilisent délibérément un style monochrome sobre (bordure gauche en pointillés,
`text-muted-foreground`), sans couleur sémantique ni motif `--ai`. Cette décision
reflète la convention documentée dans `causal-caveat.tsx` (audit C5) : un garde-fou
est une note méthodologique, pas un statut système.

### Partage de `detectSensitiveFeatures` avec `web/lenses`

La fonction est définie dans `lib/lenses/insights.ts` et importée par `FairnessPanel`.
Ce partage assure la cohérence : si la définition d'un attribut sensible évolue, les
deux features (comparateur d'équité et regards métier) sont mises à jour simultanément.

### Absence du paramètre `favorable` dans l'interface web

Le backend expose un paramètre optionnel `favorable` (label de l'issue positive).
Le frontend ne le transmet pas — l'interface utilise toujours la valeur par défaut
(dernière classe triée). Ce choix simplifie l'UI mais prive l'utilisateur de la
possibilité de changer l'issue de référence.

---

## Patterns identifiés

- **Client Component avec useEffect dual** : deux effets indépendants — un pour les
  colonnes candidates (dépend de `datasetId`), un pour le rapport (dépend de `selected`
  et `experimentId`). Pattern standard React pour des requêtes de données séparées.
- **Drapeau `alive` pour annulation** : évite les mises à jour d'état après démontage
  ou après changement de sélection. Alternative légère à `AbortController`.
- **Fonction pure testable isolément** : `compute_group_fairness()` ne dépend d'aucun
  I/O, d'aucun ORM, d'aucune session DB. Entièrement testable en unittest.
- **Client TypeScript généré** : `getFairnessReport` et `getDataset` sont des fonctions
  générées par `@hey-api/openapi-ts` depuis le contrat OpenAPI FastAPI.

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/api/tests/unit/test_fairness.py` | `compute_group_fairness` — cas binaire/multiclasse/favorable override/longueur incohérente | Existant |
| `apps/web/tests/lenses/insights.test.ts` | `detectSensitiveFeatures` — tokenisation, faux positifs, one-hot, FR/EN, et `extractInsights` | Existant |
| `FairnessPanel` component | Tests du composant React (rendu, états chargement/erreur) | Absent |

---

## Rapport de filtrage ADR

Les candidats suivants ont été examinés et rejetés :

| Candidat | Raison du rejet | Alternative |
|----------|----------------|-------------|
| Tokenisation par token (pas par sous-chaîne) dans `detectSensitiveFeatures` | AP-3 — heuristique d'implémentation | Section « Algorithme de détection des colonnes candidates » ci-dessus |
| MAX_GROUPS = 12 comme limite de cardinalité | AP-3 — constante heuristique locale | Section « Algorithme de calcul des métriques » ci-dessus |
| Fairness exclusive à la classification | Q3 = NON — impact mono-feature | Section « Règles métier » dans spec-fonctionnel.md |
| Seuil 0,8 pour la règle des 80 % (4/5ths) | AP-3 — constante de standard externe (EEOC) | Section « Algorithme de calcul des métriques » ci-dessus |
| Utilisation du dataframe brut vs features encodées | Q3 = NON — impact limité à api/xai + web/fairness (même feature) | Section « Décisions techniques » ci-dessus |
| Paramètre `favorable` non exposé en UI | AP-6 — style/convention API/UI | Section « Décisions techniques » ci-dessus |
