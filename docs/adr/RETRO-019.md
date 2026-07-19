# RETRO-019 — Téléchargement authentifié via API : jamais d'URL de stockage directe

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documenté (rétro)   |
| Date       | 2026-07-19          |
| Source     | Rétro-ingénierie    |
| Features   | web/datasets, api/datasets, api/admin |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | SECURITY |
| Q1 — Coût de revert > 1j ? | OUI — basculer vers des URL de stockage directes imposerait de modifier le backend (génération d'URL signées ou publiques selon le backend de stockage local/S3, avec gestion de l'expiration), la logique d'accès (public vs privé ne peut plus être vérifiée au niveau HTTP si l'URL est directe), le client TypeScript généré, et les deux composants frontend concernés (FilesTab, DatasetDetailHeader). |
| Q2 — Non-déductible du code ? | OUI — l'invariant "jamais d'URL directe vers le stockage" ne se voit ni dans `package.json` ni dans la configuration de l'API. C'est une décision architecturale de contrôle d'accès qui aurait pu être implémentée différemment (URL signées S3, URLs publiques pour datasets `access=public`). |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — impacte `web/datasets` (FilesTab, DatasetDetailHeader), `api/datasets` (endpoint `/datasets/{id}/files/{file_id}/download` qui sert le fichier via le backend, jamais en redirect), et `api/admin` (la gestion des datasets respecte le même invariant d'accès). |
| Q4 — Casse un invariant si ignoré ? | OUI — un dev qui retournerait une URL de stockage directe depuis l'API (ou la lirait depuis un champ retourné) contournerait le contrôle d'accès par rôle et exposerait des datasets `access=private` sans authentification. |

> ✅ Validé contre la politique `.claude/rules/06-adr-policy.md`.

---

## Contexte

Les datasets peuvent être publics (`access=public`) ou privés (`access=private`). Indépendamment de cette visibilité "catalogue", les fichiers bruts (CSV/Parquet stockés sur disque ou S3) ne doivent jamais être accessibles sans authentification préalable. Le backend de stockage (`STORAGE_BACKEND=local|s3`, cf. ADR-005) ne doit pas être exposé directement aux clients.

## Décision identifiée

Tout téléchargement de fichier dataset transite obligatoirement par le client API généré (`downloadDatasetFile`), qui envoie le token d'accès Bearer et reçoit un `Blob` en réponse. L'API backend sert le contenu du fichier (en streaming ou buffer), vérifie l'authentification sur chaque requête, et n'expose jamais d'URL de stockage dans ses réponses.

Le code frontend exprime cet invariant de façon explicite avec le commentaire :
```
// Téléchargement authentifié via le client généré (jamais d'URL de fichier publique)
```

Ce commentaire est présent dans `files-tab.tsx` et `dataset-detail-header.tsx`.

Le fichier téléchargé est systématiquement renommé avec l'extension `.parquet` (format normalisé côté backend, quel que soit le format d'origine).

## Conséquences observées

### Positives
- Contrôle d'accès uniforme : toute visibilité des fichiers passe par la couche d'authentification JWT de l'API, y compris pour les datasets `access=public`
- Compatibilité multi-backend stockage : l'URL de stockage réelle (local ou S3) n'est jamais exposée au client, ce qui permet de changer de backend sans impact frontend
- Format normalisé : le client reçoit toujours du Parquet, simplifiant le traitement ultérieur

### Négatives / Dette
- **Performance** : le fichier transite par le backend API (pas de redirection vers un CDN/S3 pré-signé), ce qui consomme de la mémoire serveur sur les fichiers volumineux
- **Pas de reprise sur interruption** : le téléchargement via Blob ne supporte pas la reprise (pas de range requests)

## Recommandation

**Garder** pour l'accès aux datasets `access=private`. Pour les datasets `access=public` à terme, il serait possible d'optimiser en générant une URL pré-signée S3 côté backend (retournée dans la réponse, valable quelques minutes), permettant un téléchargement direct sans transiter par le backend — sans sacrifier le contrôle d'accès initial. Cette optimisation nécessiterait une évolution de l'endpoint de téléchargement.
