# Audit Initial — IBIS-X v2

| Champ             | Valeur                          |
|-------------------|---------------------------------|
| Date              | 2026-07-19                      |
| Auditeur          | retro-auditor (Zelian)          |
| Source            | Rétro-ingénierie du code réel   |
| Features auditées | 24 (13 api + 11 web)            |
| ADRs identifiés   | 12 (RETRO-*)                    |

---

## Résumé exécutif

IBIS-X v2 est une plateforme pédagogique ML/XAI bien structurée : architecture modulaire
par domaine, contrat OpenAPI enforced en CI, 303 tests déclarés (201 pytest + 102 Vitest
+ 3 specs e2e) et 12 ADRs documentés. La stack est moderne et les invariants critiques
(honnêteté des résultats, reproductibilité P4, anti-hallucination LLM) sont bien gardés
dans le code et les tests. Les risques majeurs sont une couverture de tests déséquilibrée
— le module LLM (point de défaillance externe le plus probable) est sans tests, et la
majorité des surfaces web ne dispose d'aucun Vitest — et plusieurs dépendances manuelles
non validées en CI (ETHICAL_KEYS front/back, BlockDocument Python/TypeScript, viz_data
sans schéma Pydantic), dont la désynchronisation est silencieuse.

---

## Stack et architecture

**Monorepo non-géré** : deux apps indépendantes (`apps/api` FastAPI + `apps/web` Next.js)
coordonnées par Docker Compose. Pas de workspace manager (Turborepo/Nx absent). La
cohérence inter-apps est assurée uniquement par le contrat OpenAPI (enforce en CI).

**Backend** : FastAPI 0.115 / Python 3.12, SQLAlchemy 2.0, Alembic (auto-apply au
démarrage), Celery 5 (4 queues distinctes), Redis pub/sub pour le SSE de progression,
Pydantic v2 strict sur tous les payloads, structlog JSON, Argon2id + JWT HS256, Ruff +
mypy en CI.

**Frontend** : Next.js 16.2.10 App Router, TypeScript 5.9, React 19, shadcn/ui + Tailwind
CSS 4, Zustand 5, next-intl 4 (FR + EN), Recharts 2.15, client TypeScript généré depuis
OpenAPI (`@hey-api/openapi-ts`).

**Pattern architectural** : service layer strict (routes → service → models), fonctions
pures séparées des I/O (engine.py, fairness.py, quality.py, blocks.py), registre
d'algorithmes extensible, fallback déterministe sur toutes les features LLM.

---

## Cartographie fonctionnelle

| # | Feature | État | Complexité | Tests | Spec |
|---|---------|------|-----------|-------|------|
| 1 | api/auth | Fonctionnel | Haute | Oui (2 fichiers) | Non documentée |
| 2 | api/users | Fonctionnel | Faible | Oui (2 fichiers) | Non documentée |
| 3 | api/datasets | Fonctionnel | Haute | Oui (2 fichiers) | docs/specs/api/datasets/ |
| 4 | api/scoring | Fonctionnel | Moyenne | Oui (4 fichiers) | Non documentée |
| 5 | api/experiments | Fonctionnel | Haute | Oui (2 fichiers) | docs/specs/api/experiments/ |
| 6 | api/ml | Fonctionnel | Haute | Oui (2 fichiers) | docs/specs/api/ml/ |
| 7 | api/xai | Fonctionnel | Haute | Oui (8 fichiers) | docs/specs/api/xai/ |
| 8 | api/llm | Fonctionnel | Moyenne | **Non (0 fichier)** | Non documentée |
| 9 | api/projects | Fonctionnel | Faible | Oui (2 fichiers) | Non documentée |
| 10 | api/dashboard | Fonctionnel | Faible | Oui (2 fichiers) | Non documentée |
| 11 | api/admin | Fonctionnel | Moyenne | Oui (2 fichiers) | Non documentée |
| 12 | api/jobs | Fonctionnel | Moyenne | Oui (2 fichiers) | Non documentée |
| 13 | api/health | Fonctionnel | Faible | Oui (1 fichier) | Non documentée |
| 14 | web/auth | Fonctionnel | Moyenne | **Non (0 fichier)** | Non documentée |
| 15 | web/onboarding | Fonctionnel | Faible | **Non (0 fichier)** | Non documentée |
| 16 | web/datasets | Fonctionnel | Haute | **Non (0 fichier)** | docs/specs/web/datasets/ |
| 17 | web/wizard | Fonctionnel | Haute | **Non (0 fichier)** | Non documentée |
| 18 | web/experiments | Fonctionnel | Haute | Partiel (1 fichier) | docs/specs/web/experiments/ |
| 19 | web/xai | Fonctionnel | Haute | Partiel (1 fichier) | Non documentée |
| 20 | web/fairness | Fonctionnel | Moyenne | **Non (0 fichier)** | docs/specs/web/fairness/ |
| 21 | web/lenses | Fonctionnel | Moyenne | Partiel (1 fichier) | Non documentée |
| 22 | web/challenges | Fonctionnel | Moyenne | Oui (5 fichiers + e2e) | docs/specs/web/challenges/ |
| 23 | web/formation | Fonctionnel | Moyenne | Oui (8 fichiers + e2e) | Non documentée |
| 24 | web/dashboard | Fonctionnel | Faible | **Non (0 fichier)** | Non documentée |
| 25 | web/admin | Fonctionnel | Moyenne | **Non (0 fichier)** | Non documentée |

---

## Points forts

1. **Contrat OpenAPI enforced en CI** : toute dérive entre backend et client TypeScript
   bloque la CI (`git diff --exit-code -- apps/web/lib/api`). Aucun projet similaire
   n'a ce garde-fou aussi rigoureux.

2. **Invariants critiques gardés dans le code** : prohibition de données synthétiques
   documentée `[NE PAS REPRODUIRE]` + test `test_dataset_unavailable_is_explicit_failure`,
   `random_state=42` verrouillé dans Pydantic (`Literal[42]`), fallback déterministe sur
   toutes les features LLM.

3. **Sécurité auth solide** : JWT HS256 + refresh rotation à chaque usage + révocation
   de famille (détection de vol), hachage Argon2id, rate-limiting Redis sur `/auth/*`,
   secret scanning gitleaks en CI, jamais de token Google stocké.

4. **Architecture extensible** : registre d'algorithmes ML (1 fichier = 1 algo),
   stockage backend agnostique (local/S3), vocab canonique centralisé (`ml/vocab.py`),
   service layer strict avec fonctions pures séparées des I/O.

5. **Couverture e2e réelle** : 3 specs Playwright contre la stack Docker complète, nightly
   CI, test de déterminisme P4 en fin de run e2e. Les tests couvrent un parcours utilisateur
   complet inscription → wizard → entraînement → SHAP → chat.

6. **Logging structuré** : structlog JSON sur le backend, codes d'erreur typés sur toutes
   les features (pas de messages génériques), progression publiée via Redis pub/sub avec
   repli polling 2 s.

---

## Risques identifiés

| # | Risque | Criticité | Impact | Feature(s) |
|---|--------|-----------|--------|------------|
| R1 | Module LLM sans aucun test | CRITIQUE | Régression non détectée sur le point de défaillance externe le plus probable | api/llm |
| R2 | `viz_data` non validé par schéma Pydantic | CRITIQUE | Graphiques vides silencieux en production si `evaluation.py` renomme un champ | api/ml, web/experiments |
| R3 | Tasks Celery (train + explain) sans tests unitaires directs | CRITIQUE | Régressions pipeline ML/XAI non détectées avant e2e nightly | api/ml, api/xai |
| R4 | Bug timezone dans quotas journaliers | CRITIQUE | Quota mal calculé à minuit UTC pour les utilisateurs hors UTC (race condition silencieuse) | api/experiments |
| R5 | `resolveDatasetId` limité à 96 datasets | CRITIQUE | Challenges inutilisables si le catalogue dépasse 96 entrées (retour silencieux `null`) | web/challenges |
| R6 | `ETHICAL_KEYS` front/back non validés en CI | MAJEUR | 11ème critère ajouté côté backend → score incohérent avec la grille UI, sans erreur visible | api/datasets, web/datasets |
| R7 | `BlockDocument` Python/TypeScript dupliqué manuellement | MAJEUR | Évolution d'un type de bloc → désynchronisation silencieuse du rendu front | api/xai, web/xai |
| R8 | 9 surfaces web sans aucun Vitest | MAJEUR | Régressions UI non détectées : auth, onboarding, wizard, dashboard, admin, datasets, fairness | web/* |
| R9 | Pas de journal d'audit des mouvements de crédits | MAJEUR | Impossible de reconstituer l'historique en cas de contestation ou de migration vers facturation réelle | api/experiments, api/users |
| R10 | `ethics.py` sans tests unitaires | MAJEUR | Comportement tristate non couvert ; dénominateur implicite 10 | api/datasets |

---

## Recommandations stratégiques

1. **Ajouter des tests pour le module LLM en priorité absolue** — `client.py`, `xai_text.py`,
   `guides.py` sont des points d'intégration externes (OpenRouter) sans aucun test. Un
   mock du client HTTP suffit pour couvrir les prompts adaptatifs, la validation
   anti-hallucination et les fallbacks.

2. **Typer `viz_data` avec un schéma Pydantic versioned** — La structure JSON produite par
   `evaluation.py` et consommée par Recharts est le seul contrat inter-apps non validé en
   CI. Un `VizData` Pydantic exporté dans l'OpenAPI élimine le risque de désynchronisation
   silencieuse.

3. **Corriger le bug timezone dans le comptage des quotas journaliers** — `datetime.now(UTC).replace(tzinfo=None)` à la ligne 105 de `experiments/service.py` crée une comparaison
   datetime naïve potentiellement incorrecte. Utiliser `datetime.now(UTC)` avec des timestamps
   tz-aware dans toute la chaîne.

4. **Couvrir les surfaces web critiques en Vitest** — En ordre de priorité : wizard (9 étapes,
   logique brouillon), auth (flow login/register), datasets (state machine `useCatalog`).
   Ces surfaces concentrent la complexité UX et sont actuellement sans filet de sécurité.

5. **Générer le schéma TypeScript de `BlockDocument` depuis le Pydantic** — Utiliser
   `pydantic2ts` ou l'export OpenAPI pour supprimer la duplication manuelle Python/TypeScript
   du contrat de blocs, et ajouter la vérification de synchronisation en CI.
