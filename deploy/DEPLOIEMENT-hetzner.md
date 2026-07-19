# Déploiement IBIS-X sur la VM Hetzner mutualisée (ibisx.zelian.fr)

VM `ubuntu-8gb-nbg1-1` — 4 vCPU / 8 Go — qui héberge **déjà** : onboarding, school, manage,
l2sorbonne, work (Plane) `.zelian.fr`, un runner GitHub, nginx+Certbot. **On ne touche à rien
de tout ça.** IBIS-X vient s'ajouter en isolation totale (conteneurs bridés + port 127.0.0.1).

- IP publique du serveur : **46.225.20.249**
- Repo : **github.com/gwentey/2026-research-ibisx** (public)
- Port interne réservé à IBIS-X : **127.0.0.1:3200** (3000/3101/3102/8090 sont déjà pris)
- Dossier de prod sur la VM : **/opt/ibisx**
- Commande compose de référence :
  `docker compose -f compose.prod.yml -f deploy/compose.vps.yml …`

Chaque étape est **à faire une seule fois** sauf mention contraire. Fais-les dans l'ordre.

---

## Étape 1 — DNS chez LWS (⚠️ à faire en premier, ça met quelques minutes à se propager)

`ibisx.zelian.fr` ne résout pas encore (pas de wildcard). Dans le panneau LWS → zone DNS de
`zelian.fr`, ajoute **un enregistrement A** :

| Type | Nom / Sous-domaine | Cible / Valeur | TTL |
|------|--------------------|----------------|-----|
| A    | `ibisx`            | `46.225.20.249`| défaut |

(Même IP que `onboarding`. Pas besoin d'AAAA : tes autres sites n'en ont pas.)

Vérifie depuis ton PC (attends que ça réponde la bonne IP) :

```bash
dig +short ibisx.zelian.fr        # doit afficher 46.225.20.249
```

Tant que ça ne répond pas 46.225.20.249, **ne lance pas Certbot** (étape 4) : il échouerait.

---

## Étape 2 — Bootstrap du dossier de prod (sur la VM, une fois)

```bash
sudo mkdir -p /opt/ibisx
sudo chown "$USER":"$USER" /opt/ibisx      # ou laisse root si le runner tourne en root
git clone https://github.com/gwentey/2026-research-ibisx.git /opt/ibisx
cd /opt/ibisx

# Crée la branche de production côté GitHub si elle n'existe pas encore (voir étape 6),
# puis récupère-la :
git fetch --all
git checkout production 2>/dev/null || echo "→ crée d'abord la branche 'production' (étape 6)"
```

---

## Étape 3 — Le fichier .env (secrets) sur la VM

Le `.env` n'est **jamais** commité. Tu le fabriques sur ton PC puis tu le transfères. Il vit en
permanence dans `/opt/ibisx/.env`.

**a) Génère les secrets** (sur ton PC ou la VM) :

```bash
python3 -c "import secrets; print('JWT_SECRET=' + secrets.token_urlsafe(48))"
python3 -c "import secrets; print('POSTGRES_PASSWORD=' + secrets.token_urlsafe(24))"
```

**b) Fabrique ton `.env`** à partir de `.env.example`. À renseigner **impérativement** :

| Variable | Valeur |
|---|---|
| `ENVIRONMENT` | `production` |
| `JWT_SECRET` | la valeur générée (jamais l'exemple) |
| `POSTGRES_PASSWORD` | la valeur générée |
| `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` | ton compte admin de départ |
| `MAX_CONCURRENT_TRAININGS` | `1` (recommandé sur machine partagée) |
| `OAUTH_REDIRECT_URL` | `https://ibisx.zelian.fr/auth/google/callback` (si tu actives Google) |

Optionnel : `SMTP_*` (voir étape 7), `OPENROUTER_API_KEY` (textes IA réels), `GOOGLE_*`, `KAGGLE_*`.

**c) Transfère-le** depuis ton PC (dans le repo local) :

```bash
rsync -avz --chmod=600 .env root@46.225.20.249:/opt/ibisx/.env
# (ou : scp .env root@46.225.20.249:/opt/ibisx/.env)
```

**d) Valide-le** sur la VM — c'est le garde-fou qui te dit si tu as oublié quelque chose :

```bash
cd /opt/ibisx && ./deploy/check-env.sh .env
```

> Ce script **refuse** (code 1) si une variable requise manque/est un placeholder, **et** te
> liste les clés ajoutées au `.env.example` que tu n'aurais pas encore reportées sur la VM
> (le cas « le modèle a évolué »). Il tourne aussi **automatiquement à chaque déploiement**
> (étape bloquante du workflow) : un déploiement avec un `.env` incomplet est refusé, pas planté.

---

## Étape 4 — Premier démarrage + nginx + TLS

**a) Démarre la stack** (le build Next.js + Python se fait ici ; la VM est peu chargée, ça passe) :

```bash
cd /opt/ibisx
docker compose -f compose.prod.yml -f deploy/compose.vps.yml up -d --build

# Vérifie en local (avant même nginx) : doit répondre {"status":"ok",...}
curl -s http://127.0.0.1:3200/api/v1/health; echo
```

**b) Crée l'admin initial** :

```bash
docker compose -f compose.prod.yml -f deploy/compose.vps.yml exec -T api ibis seed
```

**c) Branche nginx** :

```bash
sudo cp /opt/ibisx/deploy/nginx-ibisx.zelian.fr.conf /etc/nginx/sites-available/ibisx.zelian.fr
sudo ln -s /etc/nginx/sites-available/ibisx.zelian.fr /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx      # nginx -t échoue = on ne reload pas, aucun risque
```

**d) Certificat TLS** (une fois le DNS propagé, étape 1) :

```bash
sudo certbot --nginx -d ibisx.zelian.fr
```

Test final : `https://ibisx.zelian.fr` (site) et `https://ibisx.zelian.fr/api/v1/health` (`ok`).

---

## Étape 5 — Le 2ᵉ runner GitHub (dédié à ce repo)

Ton runner actuel (`zelian-prod-vm`) est lié à `2026-zelian-insider` : **on ne le touche pas**.
On ajoute un runner **séparé** pour `gwentey/2026-research-ibisx`, dans son propre dossier.

Va sur **github.com/gwentey/2026-research-ibisx → Settings → Actions → Runners → New self-hosted
runner (Linux x64)**. GitHub affiche un bloc de commandes avec la **bonne version** et un **token**.
Adapte-le ainsi (dossier + nom + label `ibisx`) :

```bash
cd ~
mkdir actions-runner-ibisx && cd actions-runner-ibisx

# ↓↓↓ COPIE la ligne `curl -o … tar.gz` exacte donnée par GitHub (elle contient la bonne version)
curl -o actions-runner-linux-x64.tar.gz -L https://github.com/actions/runner/releases/download/vX.XXX.X/actions-runner-linux-x64-X.XXX.X.tar.gz
tar xzf actions-runner-linux-x64.tar.gz

# Config : reprends le TOKEN affiché par GitHub, garde --labels ibisx et --name ci-dessous
./config.sh --url https://github.com/gwentey/2026-research-ibisx \
  --token <TON_TOKEN_GITHUB> \
  --name ibisx-prod-vm --labels ibisx --work _work --unattended

# Installe en service (comme ton runner actuel), démarre :
sudo ./svc.sh install root
sudo ./svc.sh start
sudo ./svc.sh status
```

> Le runner doit pouvoir lancer Docker. En l'installant en `root` (comme ton runner existant),
> c'est bon. Deux runners coexistent sans problème sur la même machine.

---

## Étape 6 — Activer le déploiement automatique (main → production)

Le modèle : `main` reçoit tes features, puis **quand tu décides de mettre en prod**, tu merges
`main` dans `production`. Le push sur `production` déclenche [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)
sur ton runner `ibisx`, qui fait : pull → check-env → garde-fou ports → build → up → health → seed.

**Création de la branche `production` (une fois)** — depuis ton PC :

```bash
git checkout main && git pull
git checkout -b production
git push -u github production        # ⚠️ pousse d'abord tous les fichiers deploy/ + le workflow !
```

**À chaque mise en prod ensuite** :

```bash
git checkout production && git merge main && git push github production
# → le runner déploie tout seul. Suis l'avancée dans l'onglet Actions du repo.
```

> Important : le workflow `deploy.yml`, le dossier `deploy/` et `check-env.sh` doivent exister
> **sur la branche `production`** (donc être mergés depuis `main`) pour que le runner les voie.

---

## Étape 7 — Emails & comptes (prêt pour la prod ?)

- **Création de compte : opérationnelle sans rien.** L'inscription est email + mot de passe avec
  auto-connexion, **sans email de confirmation**. Ça marche dès le jour 1.
- **Emails = un seul usage : la réinitialisation de mot de passe.** Sans SMTP, le lien est
  seulement écrit dans les logs (`docker compose … logs api`) — donc l'utilisateur ne le reçoit
  pas. Pour l'activer, renseigne dans `.env` :

  ```
  SMTP_HOST=...          # ton relais SMTP authentifié
  SMTP_PORT=587
  SMTP_USER=...
  SMTP_PASSWORD=...
  SMTP_FROM=IBIS-X <no-reply@zelian.fr>
  ```

  Et côté domaine : **SPF + DKIM sur zelian.fr** (sinon spam/blocage). N'envoie pas en direct
  depuis l'IP Hetzner (port 25 souvent bloqué) — passe par un relais/submission 587.
- **Connexion Google** (optionnelle) : `GOOGLE_CLIENT_ID/SECRET` + `OAUTH_REDIRECT_URL=https://ibisx.zelian.fr/auth/google/callback`,
  et déclare cette URL de callback dans Google Cloud Console.
- ⚠️ **Limite connue** : l'email de reset contient un lien **relatif** (`/reset-password?token=…`),
  pas cliquable dans un email. Pour une vraie prod email, il faudra préfixer par
  `https://ibisx.zelian.fr`. → petit correctif applicatif à prévoir (me demander).

---

## Exploitation courante

**Sauvegardes** (à mettre en cron quotidien) :

```bash
cd /opt/ibisx
docker compose -f compose.prod.yml -f deploy/compose.vps.yml exec -T postgres \
  pg_dump -U ibis ibis | gzip > /opt/ibisx-backups/db-$(date +%F).sql.gz
docker run --rm -v ibisx_ibis-data:/data -v /opt/ibisx-backups:/out alpine \
  tar czf /out/data-$(date +%F).tgz /data
```

**Voir les logs** : `docker compose -f compose.prod.yml -f deploy/compose.vps.yml logs -f api worker`

**Surveiller la RAM partagée** : `docker stats --no-stream` (IBIS-X ne doit pas dépasser ~4 Go cumulés)

**Rollback** (revenir au commit d'avant) :

```bash
cd /opt/ibisx
git reset --hard HEAD~1
docker compose -f compose.prod.yml -f deploy/compose.vps.yml up -d --build
```

**Mise à jour manuelle** (sans passer par le workflow) : `git pull` puis la commande `up -d --build`.
