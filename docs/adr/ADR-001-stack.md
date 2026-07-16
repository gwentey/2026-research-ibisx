# ADR-001 — Stack technique

- **Statut** : accepté (2026-07-16)
- **Source** : [docs/refonte/02-ARCHITECTURE.md](../refonte/02-ARCHITECTURE.md) §2

## Contexte

La v1 (4 microservices FastAPI + Angular + Kubernetes/minikube) a causé les pires défauts du produit : contrats front/back désalignés, logique dupliquée 3×, OOMKilled, code copié entre images. L'option Next.js + NestJS a été évaluée pour la v2.

## Décision

| Couche | Choix |
|---|---|
| Frontend | **Next.js 16** (App Router) + React 19 + TypeScript 5.9, template `shadcn-ui-kit-dashboard` (Tailwind 4, shadcn/ui, Recharts, TanStack Table, react-hook-form + zod, next-intl, next-themes) |
| Backend | **Python 3.12 + FastAPI** (Pydantic v2) — **monolithe modulaire**, PAS de microservices |
| Worker | **Celery 5.4**, même codebase et même image Docker que l'API |
| ORM | SQLAlchemy 2.0 + Alembic (chaîne unique) |
| Infra | Docker Compose (5 conteneurs), pas de Kubernetes |

**NestJS est rejeté** : le cœur du produit (pandas, scikit-learn, SHAP, LIME) n'a aucun équivalent Node crédible ; un backend NestJS imposerait un second service Python et recréerait la fracture microservices (violation P3, P7). FastAPI fournit typage fort, OpenAPI auto-généré et DI.

## Conséquences

- Une seule stack backend à maintenir (P7) ; le worker importe les mêmes modules que l'API (P3).
- Le front est intégralement dérivé du template — design system unique (P6), aucun token modifié.
- Angular, Kubernetes, MinIO, fastapi-users : abandonnés.
