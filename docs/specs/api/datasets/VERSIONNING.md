# VERSIONNING — api/datasets

| Version | Date | Artefact/Composant | Changement | Auteur |
|---------|------|--------------------|------------|--------|
| 0.1.0 | 2026-07-19 | Module complet | Rétro-ingénierie : spec initiale du catalogue (CRUD, profiling, filtres, score éthique, guide IA) | Anthony |
| 0.2.0 | 2026-07-20 | kaggle_client.py, kaggle_import.py, enrichment.py, workers/tasks/kaggle.py, routes.py, service.py, models.py, schemas.py | Import communautaire Kaggle par lien : client httpx, enrichissement déterministe + LLM, tâche Celery, route POST /datasets/import/kaggle (tout compte connecté, rate limit 10/h), POST /datasets/{id}/ethics-review, 7 colonnes BDD (source_kind, source_ref, license_name, is_verified, ethics_suggestions, ethics_reviewed_at, ethics_reviewed_by), 3 index + FK, migration 0010 | Anthony |
