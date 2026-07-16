# IBIS-X v2 — Dossier de refonte

Dossier fondateur de la refonte complète d'IBIS-X (abandon des microservices/minikube et d'Angular, repart de zéro sur Next.js + shadcn-ui-kit-dashboard côté front et un backend modulaire unique + worker sous Docker Compose).

## Contenu

| Fichier | Rôle |
|---|---|
| [01-CAHIER-DES-CHARGES.md](01-CAHIER-DES-CHARGES.md) | **Le cahier des charges exhaustif** : contexte & mission, personas, principes P1–P7, RBAC, et les 8 modules fonctionnels spécifiés (catalogue & filtration des datasets, scoring multi-critères, projets & benchmarking, pipeline ML en 9 étapes, XAI avec KPI & graphes, dashboard, administration). C'est l'input principal de l'IA de développement. |
| [02-ARCHITECTURE.md](02-ARCHITECTURE.md) | **Le document d'architecture** : choix de stack (et rejet argumenté de NestJS), topologie Docker Compose, organisation du monorepo, communication (OpenAPI → client TS généré, SSE, Celery), schéma PostgreSQL, auth JWT + RBAC, stockage fichiers, bibliothèques IA/XAI/LLM, sécurité, CI. Les 7 décisions sont prêtes à être formalisées en ADR Zelian. |
| [retro-analyse/](retro-analyse/) | Les 6 rapports de rétro-ingénierie du code v1 (service-selection, ml-pipeline, xai-engine, frontend Angular, infra/auth, documentation/PRD/mémoire) — la matière première factuelle des deux documents ci-dessus. |

## Checklist de démarrage à zéro (rien ne se réutilise de la v1)

- [ ] **Nouveau dépôt git** `ibis-x` (monorepo `apps/web` + `apps/api`, structure du §4 de 02-ARCHITECTURE.md) — l'ancien repo `2025-research-exai` reste en lecture seule.
- [ ] **Nouveau projet Google Cloud** → créer un client OAuth 2.0 (gratuit) → `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` neufs (ne jamais réutiliser ceux de la v1, présents dans son historique git).
- [ ] **Nouvelle clé OpenRouter** (`OPENROUTER_API_KEY`) — seule clé LLM du projet ; révoquer les clés OpenAI/OpenRouter v1.
- [ ] **Nouveau secret JWT** (≥ 256 bits, généré aléatoirement) et **nouveau token Kaggle**.
- [ ] `.env` local créé depuis `.env.example`, jamais commité.

## Prochaines étapes (pipeline Zelian)

1. Créer le nouveau projet (Zelian Builder) avec le template `shadcn-ui-kit-dashboard-main`.
2. Phase 2 : formaliser les ADR-001 → ADR-007 depuis 02-ARCHITECTURE.md (`/zelian-adr`).
3. Phase 3 : dériver les specs fonctionnelles par module (M1 → M8) depuis le cahier des charges (`/zelian:spec-writer`).
4. Phase 4 : implémentation module par module, dans l'ordre M1 (auth) → M2 (catalogue) → M3 (scoring) → M4 (projets) → M5 (wizard 9 étapes) → M6 (XAI) → M7 (dashboard) → M8 (admin).

## Rappels critiques

- ⚠️ **Toutes les clés/secrets de la v1 sont à considérer compromis** (ils sont dans l'historique git v1) : régénérer OpenRouter/OpenAI, Google OAuth, JWT secret, Kaggle avant tout déploiement.
- Le codebase v1 (`/Applications/XAMPP/xamppfiles/htdocs/2025-research-exai`) ne sert plus que de référence de lecture ; aucune donnée n'en est migrée.
- Les 7 principes P1–P7 (jamais de donnée inventée, IA honnête, source unique, reproductibilité, orientation, langage graphique unique, maintenable seul) priment sur toute décision d'implémentation.
