# VERSIONNING — web/datasets

| Version | Date | Artefact/Composant | Changement | Auteur |
|---------|------|--------------------|------------|--------|
| 0.1.0 | 2026-07-19 | Module complet | Rétro-ingénierie : spec initiale (catalogue, fiche détail, wizard upload, scoring) | Anthony |
| 0.2.0 | 2026-07-20 | kaggle-import-dialog.tsx, dataset-attribution.tsx, ethics-review-dialog.tsx, ethics-review-banner.tsx, lib/datasets/ethics-review.ts, dataset-card.tsx, overview-tab.tsx, page.tsx | Import Kaggle communautaire : dialog d'import, attribution importeur, bannière + dialog revue éthique, i18n FR/EN (kaggleImport, attribution, ethicsReview), tests Vitest ethics-review.ts | Anthony |
| 0.2.1 | 2026-07-20 | lib/api/errors.ts, kaggle-import-dialog.tsx, ethics-review-dialog.tsx | Correctif : lecture des deux enveloppes d'erreur 422 (metier vs Pydantic) ; supprime l'affichage « [object Object] » constate en production | Anthony |
