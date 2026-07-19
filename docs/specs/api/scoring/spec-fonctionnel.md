# Spec Fonctionnelle — api/scoring [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | api/scoring         |
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

| ADR | Catégorie | Titre | Statut |
|-----|-----------|-------|--------|
| [RETRO-api-scoring-01](../../../adr/RETRO-api-scoring-01.md) | DB-STRATEGY | Scores de pertinence calculés à la demande (raw + compute-on-read) — non matérialisés en base | Documenté (rétro) |

---

## Contexte et objectif

Le module `api/scoring` est le moteur de classement de pertinence des datasets d'IBIS-X. Il permet à un utilisateur authentifié de soumettre un jeu de critères pondérés et d'obtenir une liste ordonnée de datasets avec un score composite et sa décomposition par critère. Ce module répond au besoin de comparer des datasets sur une base objective et configurable, notamment pour choisir le dataset le plus adapté avant de lancer une expérience ML.

Le scoring est entièrement calculé côté backend, sur la base de champs déjà présents dans le catalogue (pas de nouveau stockage). Les profils de pondération prédéfinis couvrent trois contextes d'usage typiques.

---

## Règles métier (déduites du code)

1. **12 critères scorables.** Le scoring porte sur exactement 12 critères, dans un ordre canonique : `ethical_score`, `technical_score`, `popularity_score`, `anonymization`, `transparency`, `informed_consent`, `documentation`, `data_quality`, `instances_count`, `features_count`, `year`, `sample_balance`. Tout critère hors de cette liste est rejeté avec une erreur 422.

2. **Tous les scores élémentaires sont dans [0, 1].** Aucun score de critère ni score composite ne peut dépasser 1 ni descendre sous 0.

3. **Score final = moyenne pondérée normalisée.** La formule est `Σ(score_i × poids_i) / Σ(poids_i)`. La somme des poids fournis n'a pas à être égale à 1 — la normalisation est effectuée dynamiquement.

4. **Fallback vers les poids par défaut.** Si le payload ne fournit aucun critère, ou si tous les poids fournis sont à 0, les poids par défaut s'appliquent : `ethical_score = 0.4`, `technical_score = 0.4`, `popularity_score = 0.2`.

5. **Seuls les poids strictement positifs sont pris en compte.** Un critère avec `weight = 0` est exclu du calcul, comme s'il n'avait pas été soumis.

6. **Score éthique = fraction des 10 critères éthiques à True.** Chaque critère de la taxonomie Khelifi 2024 vaut 1/10 s'il est `True`, 0 s'il est `False` ou `None`. Granularité : 10 % par critère.

7. **Score technique normalisé dynamiquement sur les champs renseignés.** Les champs `None` (non renseignés) sont exclus du numérateur ET du dénominateur, de sorte que la présence partielle d'informations ne pénalise pas un dataset par rapport à un dataset sans aucune métadonnée technique.

8. **Score de popularité logarithmique.** Formule : `clamp(log10(citations) / 3)`. Vaut 0 pour 0 citation, 1 dès 1 000 citations.

9. **Convention pour les valeurs inconnues.** Quand la qualité des données (`data_quality`) ou l'équilibre de l'échantillon (`sample_balance`) est inconnu, la valeur neutre 0,5 est appliquée plutôt que 0. Cela évite de pénaliser les datasets sans cette information.

10. **Les filtres s'appliquent avant le scoring.** Un payload peut contenir un bloc `filters` (facultatif) ; le scoring ne porte alors que sur les datasets correspondant à ces filtres.

11. **Classement décroissant et stable.** Les datasets sont triés par score décroissant. En cas d'égalité, le département est fait par nom alphabétique puis par identifiant UUID, garantissant un classement déterministe à chaque appel.

12. **Les poids effectifs retournés sont normalisés pour l'affichage.** La réponse inclut un champ `effective_weights` exprimant les poids en pourcentage (somme = 1), indépendamment des valeurs brutes soumises.

13. **Trois profils de pondération prédéfinis sont exposés en lecture seule.** `academic_research`, `industrial_application`, `rapid_prototyping`. Le client les charge via `GET /score/profiles` ; c'est le client qui les soumet ensuite via `POST /datasets/score`.

---

## Cas d'usage (déduits)

### CU-001 — Classer les datasets selon un profil prédéfini

L'utilisateur ouvre le catalogue de datasets et sélectionne le profil "Recherche académique". Le front appelle `GET /score/profiles` pour récupérer les poids du profil, puis `POST /datasets/score` avec ces poids. Il reçoit la liste des datasets classée du plus pertinent au moins pertinent, avec le score global et la décomposition par critère pour afficher une heatmap.

### CU-002 — Scoring pondéré personnalisé avec filtres

L'utilisateur filtre les datasets par domaine "healthcare" puis ajuste manuellement les curseurs de pondération pour prioriser `data_quality` et `instances_count`. Le payload contient un bloc `filters` et la liste des critères pondérés. Le scoring porte exclusivement sur les datasets correspondant aux filtres.

### CU-003 — Scoring sans poids (fallback par défaut)

Un client API soumet `POST /datasets/score` avec `weights: []`. Le service applique automatiquement les poids par défaut (éthique 40 %, technique 40 %, popularité 20 %) et retourne `effective_weights` normalisés pour information.

### CU-004 — Consultation des critères disponibles

Le front charge `GET /score/profiles` pour initialiser l'interface de configuration : il obtient les trois profils, les poids par défaut, et la liste ordonnée des 12 critères (ordre canonique de la heatmap).

---

## Dépendances

- `api/datasets` — fournit le modèle `Dataset`, la fonction `apply_filters`, la constante `ETHICAL_CRITERIA`, la fonction `ethical_score` (ethics.py), et la fonction `to_card` (service.py).
- Authentification JWT (module `api/auth`) — toutes les routes scoring exigent un token valide.

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- La signification métier précise de chaque profil prédéfini (`academic_research`, `industrial_application`, `rapid_prototyping`) — les noms sont explicites mais les choix de pondération n'ont pas de documentation produit associée dans le code.
- La valeur cible de l'optimum de `features_count` (10–100 features = score 1) est hardcodée — à confirmer si ce paramètre doit être configurable à terme.
- L'exigence de performance `< 1 s pour 100 datasets` (CDC §12.2) — vérifier si ce seuil tient en production avec la base réelle.
