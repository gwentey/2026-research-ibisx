# Méga-prompt — Évolutions XAI (à coller dans une NOUVELLE session Claude Code)

> Copie tout ce qui suit (à partir de « --- DÉBUT DU PROMPT --- ») dans un nouveau chat
> Claude Code ouvert **sur ce repo**. Le CDC détaillé est dans
> `docs/specs/xai-evolutions/cdc.md` — le prompt te demande de le lire en premier.

--- DÉBUT DU PROMPT ---

Tu travailles sur **IBIS-X**, une plateforme de recherche en IA explicable (Next.js dans
`apps/web`, FastAPI + Celery dans `apps/api`, Postgres, Redis). On améliore la feature **XAI**
(explication + copilote chat). Le projet est en **production** sur `ibisx.zelian.fr`.

## 0. Avant tout

1. **Lis `docs/specs/xai-evolutions/cdc.md`** de bout en bout : c'est le cahier des charges
   complet (état actuel, fichiers exacts, 4 évolutions, critères d'acceptation). Il fait foi.
2. Puis lis les fichiers clés qu'il cite (surtout `apps/api/ibis/modules/llm/xai_text.py`,
   `apps/api/ibis/modules/xai/blocks.py`, `apps/api/ibis/workers/tasks/explain.py`,
   `apps/web/components/ibis/xai/ibis-blocks.tsx`, `.../explanation-view.tsx`,
   `.../explanation-copilot.tsx`, `apps/web/app/(app)/experiments/[id]/page.tsx`).

## 1. Ce qu'on veut (résumé — détail dans le CDC)

**Ordre d'exécution recommandé** ci-dessous ; le numéro entre parenthèses renvoie à la
numérotation des évolutions du CDC (attention : ordre d'exécution ≠ numéro d'évolution).

1. **Nombres lisibles** *(CDC Évolution 1, transverse — à faire en premier)* — le LLM cite
   aujourd'hui des importances brutes (`0.242421`). Les présenter **en % / arrondis** dans le
   contexte, et **humaniser les noms de variables** (`cat__Sex_female` → « Sexe = femme »).
   Ajouter un helper `humanize_feature`. Fonde les étapes suivantes.
2. **Questions suggérées contextualisées** *(CDC Évolution 4)* — remplacer les listes
   génériques par des questions qui citent la **vraie variable dominante** et la **vraie
   métrique** (déterministe, per-profil). Réutilise `humanize_feature`.
3. **Explication en blocs riches** *(CDC Évolution 2 — la plus grosse)* — faire générer
   l'« Explication rédigée par l'IA » en **BlockDocument** (même schéma que le chat) et la
   rendre avec `IbisBlocks` (tableaux, callouts, couleurs). Aujourd'hui c'est du texte plat.
   Nécessite une **migration** (colonne `explanation.text_blocks` JSON) + exposition dans les
   résultats + régénération du contrat OpenAPI.
4. **Explication liée au profil + crédits** *(CDC Évolution 3 — surtout front)* — le switch
   « Voir en tant que » ne régénère pas. Un CTA « Regénérer (1 crédit) » existe déjà mais passe
   inaperçu : le rendre **proéminent** (bandeau + dialog de confirmation rappelant le coût). Le
   niveau affiché doit toujours correspondre au niveau généré.

## 2. Acquis de la mise en prod — NE PAS casser

- **gpt-5-mini = modèle à raisonnement.** `.env` prod : `LLM_MODEL=openai/gpt-5-mini`,
  `LLM_REASONING_EFFORT=low`, `LLM_MAX_TOKENS=3000`. `client.py` envoie `reasoning.effort`,
  **retire `temperature`** et **relève `max_tokens`** quand l'effort est défini. Sans ça →
  `content=null` → repli.
- **Garde-fou anti-hallucination** `xai_text.numbers_exist_in_context` : tolère arrondis, %,
  **valeur exacte du contexte** (`f"{value:g}"`), petits ordinaux ; loggue les rejets
  (`xai_text.foreign_numbers`). Après avoir arrondi les nombres du contexte, il doit rester vert.
- **Bug masqué en dev** : sans clé LLM, tout tombe en fallback → les chemins LLM ne sont pas
  exercés. Écris des tests qui **exercent la logique** (validation blocs, arrondi, garde-fou)
  sans dépendre d'une vraie clé (mocke `llm_client.complete`).
- **Worker Celery ne recharge pas à chaud** ; **migrations Alembic au boot de l'api**.

## 3. Méthode de travail (impérative)

- **Une évolution à la fois**, dans l'ordre du §1. Pour chacune : brainstorm court si besoin,
  puis **TDD** (test rouge → implémentation → vert), puis commit.
- **Design riche** : composer avec les tokens du kit UI (jamais de primitives nues) ; le motif
  IA (blocs, couleur `ai`) doit être **identique** entre explication et chat.
- **i18n FR/EN** : toute chaîne visible dans `apps/web/messages/{fr,en}.json`.
- **Contrat OpenAPI (ADR-007)** : après toute modif de route/schéma backend, lance
  `cd apps/api && uv run python -m ibis.export_openapi ../web/lib/api/openapi.json` puis
  `cd apps/web && pnpm generate:api`, et **commite le client généré** (la CI le vérifie).
- **Garde la CI verte.** Commandes de vérif avant chaque commit :
  - API : `cd apps/api && uv run ruff check . && uv run ruff format --check . && uv run mypy ibis && uv run pytest -q`
  - Web : `cd apps/web && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- **Commits en français, SANS attribution Claude** (jamais de `Co-Authored-By`). Le repo public
  est `github.com/gwentey/2026-research-ibisx` (remote `github`).
- **Ne pousse pas / ne merge pas sans qu'on te le demande.** Le déploiement prod se fait via un
  merge `main → production` (runner self-hosted). Ne touche pas à ça.

## 4. Critères d'acceptation globaux

- Une explication/chat sur Titanic parle de « **le sexe** » et « **≈ 24 %** », jamais de
  `cat__Sex_female = 0.242421`.
- L'« Explication rédigée par l'IA » a le **même look** que le chat (blocs).
- Changer de profil affiche clairement qu'il faut régénérer (coût 1 crédit) et le fait sur
  confirmation.
- Les questions suggérées citent le vrai modèle.
- Repli déterministe (« sans IA ») toujours fonctionnel. CI verte. Zéro nombre brut côté user.

Commence par **lire le CDC**, puis propose-moi ton plan pour l'**Évolution 1** avant de coder.

--- FIN DU PROMPT ---
