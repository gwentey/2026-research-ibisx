# ADR-005 — Stockage des fichiers

- **Statut** : accepté (2026-07-16)
- **Source** : [docs/refonte/02-ARCHITECTURE.md](../refonte/02-ARCHITECTURE.md) §8

## Décision

**Abstraction de stockage** (`ibis/storage/`) avec deux drivers : `LocalFSStorage` (défaut — volume Docker `ibis-data` monté dans `api` ET `worker`) et `S3Storage` (optionnel, activable par `STORAGE_BACKEND=s3`). La v2 démarre **sans MinIO** : un conteneur de moins, zéro configuration.

- Arborescence : `/data/datasets/{dataset_id}/{file_uuid}.parquet`, `/data/models/{experiment_id}/model.joblib`, `/data/avatars/{user_id}.webp`, `/data/tmp/`.
- **Format canonique : Parquet** (Snappy) — conversion à l'ingestion (CSV/XLSX/JSON → Parquet).
- Les fichiers ne sont servis **que par l'API** (endpoints authentifiés, streaming) ; noms de stockage UUID.
- Les visualisations ne sont **plus des fichiers** : données JSON en base (`viz_data`) rendues par Recharts — [NE PAS REPRODUIRE] les PNG matplotlib base64 en BDD.

## Conséquences

- Clés opaques validées contre la traversée de chemin ; écriture atomique (fichier `.part` puis rename).
- Passage à S3/MinIO/Azure possible par variable d'env, sans toucher au code métier.
