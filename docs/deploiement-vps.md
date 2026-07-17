# Déploiement VPS mono-machine (ARCH §11–13)

Cible : un VPS Linux (2 vCPU / 8 Go recommandés — SHAP et l'entraînement vivent dans le
worker limité à 4 Go), Docker + Compose v2, un nom de domaine pointant sur la machine.

## 1. Préparer la machine

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
git clone <repo> ibisx && cd ibisx
```

## 2. Secrets (.env)

```bash
cp .env.example .env
python3 -c "import secrets; print(secrets.token_urlsafe(48))"   # → JWT_SECRET
python3 -c "import secrets; print(secrets.token_urlsafe(24))"   # → POSTGRES_PASSWORD
```

À renseigner impérativement :

| Variable | Rôle |
|---|---|
| `JWT_SECRET` | signature des jetons (256 bits générés — jamais une valeur d'exemple) |
| `POSTGRES_PASSWORD` | requis par `compose.prod.yml` (démarrage refusé sinon) |
| `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` | premier admin (créé par `ibis seed`) |
| `IBIS_DOMAIN` | domaine public → certificat Let's Encrypt automatique via Caddy |
| `OPENROUTER_API_KEY` *(optionnel)* | textes IA réels ; sans clé → repli déterministe marqué |
| `GOOGLE_CLIENT_ID/SECRET` *(optionnel)* | connexion Google (penser à l'URL de callback prod) |

Rappels sécurité ([NE PAS REPRODUIRE] S7) :
- **Aucune clé de la v1** — toutes considérées compromises.
- `.env` n'est jamais commité ; le job CI `secrets` (gitleaks) scanne tout l'historique.
- Logs prod : `LOG_LEVEL=INFO` imposé par `compose.prod.yml`, jamais DEBUG, pas de PII.

## 3. Lancer

```bash
IBIS_DOMAIN=mondomaine.fr docker compose -f compose.prod.yml up -d --build
docker compose -f compose.prod.yml exec api ibis seed
```

Topologie : **seul Caddy expose 80/443** (TLS auto, HTTP→HTTPS). `/api/*` → api:8000
(SSE compris, `flush_interval -1`), le reste → web:3000. Postgres/Redis restent internes.
En-têtes posés par Caddy : CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`,
`Referrer-Policy`, `Permissions-Policy` (voir [deploy/Caddyfile](../deploy/Caddyfile)).

Vérification : `curl -I https://mondomaine.fr` (200 + en-têtes) et
`https://mondomaine.fr/api/v1/health` (`{"status":"ok", …}`).

## 4. Exploitation

**Sauvegardes** (quotidien, cron) :

```bash
docker compose -f compose.prod.yml exec -T postgres pg_dump -U ibis ibis | gzip > backup-$(date +%F).sql.gz
docker run --rm -v ibisx_ibis-data:/data -v $PWD:/out alpine tar czf /out/data-$(date +%F).tgz /data
```

**Mise à jour applicative** :

```bash
git pull && docker compose -f compose.prod.yml up -d --build   # migrations auto au boot de l'api
```

**Rotation des clés** (à planifier, et immédiatement en cas de doute) :
1. `JWT_SECRET` : générer une nouvelle valeur → `up -d api worker` → tous les access tokens
   expirent (≤ 30 min) et les refresh sont invalidés → les utilisateurs se reconnectent.
2. `POSTGRES_PASSWORD` : `ALTER USER ibis WITH PASSWORD '…'` puis mettre `.env` à jour et
   redémarrer api/worker.
3. Clés externes (OpenRouter, Google, Kaggle) : révoquer côté fournisseur, remplacer dans
   `.env`, `up -d api worker`.

**Maintenance automatique** (Celery beat, vérifiée par les tests) : détection d'entraînements
orphelins (`WORKER_LOST`, 5 min), purge des sessions de chat inactives 24 h ; le cache
d'analyse qualité expire à 7 jours (revalidé à la lecture). Aucun fichier temporaire
persistant : les téléchargements Kaggle passent par `TemporaryDirectory` auto-nettoyé.

## 5. Dépannage

| Symptôme | Piste |
|---|---|
| 502 sur `/` | `docker compose -f compose.prod.yml logs web` (build Next) |
| 502 sur `/api` | logs `api` ; migrations bloquées → `alembic upgrade head` à la main |
| Pas de certificat | DNS pas encore propagé, ou port 80/443 filtré par le pare-feu |
| Entraînements en attente | `logs worker` ; vérifier la mémoire (limite 4 Go) |
| `POSTGRES_PASSWORD requis` | la variable est obligatoire en prod (pas de défaut « ibis ») |
