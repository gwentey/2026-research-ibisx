# VERSIONNING — api/datasets

| Version | Date | Artefact/Composant | Changement | Auteur |
|---------|------|--------------------|------------|--------|
| 0.1.1 | 2026-07-20 | `datasets.ai_guide` (JSONB) | Contenu du champ étendu : ajout de `blocks` (BlockDocument) et `tokens_used` par le worker `guide.py` v2. Aucune migration SQL — colonne déjà JSONB libre. | Anthony |
| 0.1.0 | 2026-07-19 | Tous les fichiers | Version initiale — rétro-ingénierie complète du module | Anthony |
