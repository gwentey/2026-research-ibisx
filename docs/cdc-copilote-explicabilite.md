# Cahier des charges — Copilote d'explication (chat XAI v2)

> **Statut** : ✅ validé — en implémentation · **Date** : 19/07/2026 · **Périmètre** : onglet Explicabilité (`/experiments/[id]` → XAI)
> **Remplace** : le chat « Discuter de cette explication » actuel (encart dans la colonne latérale droite)
>
> **Décisions (19/07/2026)** : ① contrat de rendu = **schéma de blocs JSON typés** (§4) · ② dock **bas pleine
> largeur du contenu** · ③ fallback riche = **paragraphe + tableau des top-features** · ④ implémentation
> **A→B→C enchaînée** (§12).

---

## 1. Contexte & problème

Le chat XAI vit aujourd'hui dans l'`aside` droite de l'onglet Explicabilité, dans une colonne de
`23rem` (`xai-tab.tsx:289`, `<XaiChat>` à la ligne 459). Concrètement :

- **La boîte est trop étroite** (~25 % de l'écran) : pénible pour **écrire** (input mono-ligne de 500 car.)
  comme pour **lire** (bulles à `max-w-[85%]` dans 23rem → ~15 mots par ligne, tableaux illisibles).
- **Elle est en concurrence** avec les contrôles de génération dans la même colonne sticky : quand le chat
  grandit, il pousse tout le reste.
- **Le rendu est plat** : `xai-chat.tsx` passe `message.content` à `<Markdown>` (GFM). Le gras, l'italique,
  les listes et les tableaux *fonctionnent déjà techniquement*, mais :
  - le **prompt backend n'exige aucune structure** (`chat_prompt`, `xai_text.py:175` → « 120 mots max, texte » ) ;
  - **aucune couleur / mise en évidence sémantique** n'est possible (Markdown pur, pas de notion de « ceci
    est un point positif / un risque / la variable dominante ») ;
  - rien n'est **interprétable par notre code** : on affiche du texte, on ne *comprend* pas ce qu'il contient.

**Objectif de ce document** : figer la cible (UX + contrat de rendu) avant d'implémenter.

---

## 2. Objectifs

| # | Objectif | Critère de réussite |
|---|----------|---------------------|
| O1 | **Sortir le chat de la colonne étroite** | Le chat n'occupe plus l'`aside` ; zone de lecture ≥ 640 px de large |
| O2 | **Ouvrable / fermable sans saturer l'écran** | Fermé = simple lanceur flottant ; ouvert = dock bas escamotable ; état mémorisé |
| O3 | **Réponses riches ET interprétables par le code** | Tableaux, gras, italique, **couleurs sémantiques** rendus par nos composants, pas du HTML brut |
| O4 | **Respecter le design template (intouchable)** | Zéro couleur en dur : tout passe par les tokens du kit (`--ai`, `--destructive`, `--chart-*`…) |
| O5 | **Garder les garde-fous existants** | Quota 5 questions, anti-hallucination, fallback déterministe, honnêteté (badge « sans IA ») |
| O6 | **Accessible & responsive** | Clavier complet, focus trap, contrastes AA, plein écran mobile |

**Non-objectifs (hors périmètre v2)** : historique de conversations persistant multi-sessions, upload de
fichiers dans le chat, voix, streaming token-par-token (on reste sur le polling actuel — cf. §7.4), export PDF
de la conversation.

---

## 3. Solution UX — le dock « Copilote d'explication »

On remplace l'encart latéral par un **dock ancré en bas**, dans l'esprit d'un copilote, avec deux états.

### 3.1 État fermé — le lanceur

- **Pastille flottante** en bas à droite (au-dessus du cale-pied du traceur de quête si présent — cf. commit
  `beee4f6`, on réutilise la même logique de `z-index` / offset).
- Contenu : icône `Sparkles` sur pastille accent IA (`bg-ai/15 text-ai`, motif IA unifié — cf. mémoire
  `feedback-motif-ia-unifie`), libellé court (« Copilote »), et **badge quota** (`n questions restantes`).
- Désactivé (grisé + tooltip) tant qu'aucune explication n'est affichée — le copilote parle **de l'explication
  courante**.

### 3.2 État ouvert — le dock

- **Ancré en bas**, largeur = largeur du contenu principal (ne recouvre PAS la sidebar de navigation),
  hauteur `min(60vh, 560px)`, coins hauts arrondis, ombre portée, `backdrop` léger optionnel.
- **En-tête** : titre « Copilote d'explication », sous-titre contextuel (« à propos de : explication
  globale / exemple n°X »), badge quota, bouton **réduire** (↓ → repli en lanceur) et bouton **fermer** (×).
- **Zone messages** : colonne de lecture **centrée, `max-w-3xl`** (≈ 720 px) même si le dock est large →
  confort de lecture, fin du problème « 15 mots par ligne ».
- **Suggestions** : les questions suggérées (`getSuggestedQuestions`) en chips, au-dessus de l'input tant que
  la conversation est vide.
- **Saisie** : **`textarea` multi-lignes** auto-grandissante (2→6 lignes), `Entrée` = envoyer,
  `Maj+Entrée` = nouvelle ligne, compteur 500 car., bouton Envoyer. Désactivée si quota atteint / session
  expirée (messages actuels réutilisés : `chat.remaining`, `chat.expired`).
- **Persistance** : état ouvert/fermé + hauteur mémorisés en `localStorage`, **par expérimentation**.

### 3.3 Responsive

- **Desktop** : dock bas comme ci-dessus.
- **Mobile / tablette** : **feuille plein écran** (bottom sheet). On s'appuie sur le **Drawer `vaul`** déjà
  présent dans les dépendances (`node_modules/vaul`) → primitive accessible, drag-to-dismiss, focus trap
  gratuits.

### 3.4 Impact sur `xai-tab.tsx`

- Retirer `<XaiChat>` de l'`aside` (ligne 459). L'`aside` ne garde que les **contrôles de génération** →
  gagne de la hauteur, plus de concurrence sticky.
- Monter `<ExplanationCopilot explanation={current} />` **une seule fois**, en overlay (portail), piloté par
  l'explication couramment affichée.

---

## 4. Solution rendu v2 — le contrat « blocs interprétables »

C'est le cœur de la demande : *« la réponse doit être interprétable par notre code pour afficher les
couleurs, tableaux, etc. »*. Markdown pur ne le permet pas (il ne porte aucune **intention sémantique** :
il ne sait pas dire « ceci est un risque »). Deux stratégies possibles — recommandation en §11.

### 4.1 Principe retenu — schéma de blocs typés (JSON)

L'IA ne renvoie plus du texte libre mais un **document structuré** : une liste de **blocs typés**, chacun
associé à un **composant de notre design system** et à une **tonalité sémantique** branchée sur nos tokens.

Avantages :
- **Interprétable par le code** par construction (c'est de la donnée, pas du texte à deviner).
- **Sûr** : aucun HTML arbitraire, aucune couleur en dur → **respecte le template intouchable** (O4).
- **Couleurs qui ont du sens** : elles portent une info (positif / négatif / prudence / accent IA), pas de la
  décoration — parfaitement adapté au domaine XAI (une variable *pousse* la prédiction vers le haut ou le bas).
- **Dégradable** : un bloc inconnu ou invalide retombe en paragraphe texte.

### 4.2 Le jeu de blocs (fermé et versionné — `schema_version: 1`)

| Bloc | Champs | Rendu (composant kit) |
|------|--------|------------------------|
| `paragraph` | `text` (inline markdown restreint : gras/italique/`code` + marque `highlight`) | `<p>` + `<Markdown>` restreint |
| `heading` | `text`, `level` (3\|4) | titre de section compact |
| `list` | `ordered` (bool), `items[]` (inline) | `<ul>/<ol>` |
| `table` | `columns[]`, `rows[][]` où chaque cellule = `{ text, tone? }` | `<Table>` du kit, cellule teintée par `tone` |
| `callout` | `tone`, `title?`, `text` | encart type `<Alert>` (bordure + fond `tone`, icône) |
| `keyValue` | `items[]` de `{ label, value, tone?, trend? }` | grille label/valeur (façon KPI) |
| `featureBar` | `feature`, `contribution` (signé), `direction` (`up`\|`down`) | mini-barre + libellé — réutilise la sémantique SHAP/LIME de `explanation-view.tsx` |
| `badge` | `text`, `tone` | `<Badge>` inline |

> Marque inline `highlight` : `==texte==` (ou `{tone}...{/tone}` selon syntaxe retenue) permet de **surligner
> un mot dans un paragraphe** avec une tonalité — c'est le « colorier pour illustrer » demandé, mais encadré.

### 4.3 Palette sémantique — mapping vers les tokens (jamais de hex)

Le kit est **volontairement monochrome** (`--chart-1..5` = gris, `--ai` = seul accent). La « couleur » v2
est donc une **enum fermée de tonalités**, chacune mappée à un token existant :

| `tone` | Sens métier | Token / classe |
|--------|-------------|----------------|
| `neutral` | information neutre (défaut) | `text-foreground` / `text-muted-foreground` |
| `accent` | mise en avant IA, variable dominante | `--ai` (`text-ai`, `bg-ai/10`) |
| `positive` | pousse *vers* la classe / favorable | token succès (`--chart-*` clair ou vert du kit) |
| `negative` | pousse *contre* / risque / erreur | `--destructive` |
| `warning` | limite, prudence, faible fiabilité | ambre du kit (`--color-amber-*`) |

L'IA **choisit une tonalité sémantique**, jamais une couleur. Le code décide du rendu → le template reste
maître de l'apparence. Changer la charte = changer le mapping à un seul endroit.

### 4.4 Exemple de réponse (schéma de blocs)

```json
{
  "schema_version": 1,
  "blocks": [
    { "type": "paragraph",
      "text": "La variable ==revenu== domine la décision : à elle seule elle explique **41 %** de la prédiction." },
    { "type": "table",
      "columns": ["Variable", "Poids", "Sens"],
      "rows": [
        [ {"text":"revenu"},      {"text":"0.41"}, {"text":"pousse vers « accordé »","tone":"positive"} ],
        [ {"text":"taux_endett."}, {"text":"0.19"}, {"text":"pousse vers « refusé »","tone":"negative"} ]
      ] },
    { "type": "callout", "tone": "warning", "title": "À garder en tête",
      "text": "Le modèle n'a vu que 2 000 exemples : prudence sur les profils atypiques." }
  ]
}
```

> Chaque nombre (`41 %`, `0.41`, `0.19`, `2000`) est **vérifié** présent dans le contexte serveur avant
> affichage (§7.3). Sinon régénération puis fallback.

---

## 5. Contrat d'interface (frontend ⇄ backend)

- `ChatMessageRead` gagne un champ optionnel **`blocks: Block[] | null`** (schéma §4.2).
- `content` (texte brut) **reste rempli** : miroir lisible pour la copie, la recherche, l'accessibilité et
  la rétro-compat. Le front affiche `blocks` s'ils existent, sinon `Markdown(content)`.
- Nouveau composant **`<IbisBlocks blocks={...} />`** : `switch(block.type)`, rend un composant du kit par
  type, tonalité → classe via une map `TONE_CLASS`. Type inconnu → `paragraph` texte. **Zéro
  `dangerouslySetInnerHTML`.**

---

## 6. Chaîne technique — backend

Fichiers concernés : `ibis/modules/llm/xai_text.py`, `ibis/workers/tasks/explain.py`
(`answer_chat_question`, ligne 202), `ibis/modules/xai/models.py`, `ibis/modules/xai/routes.py`,
`alembic/versions/`.

### 6.1 Génération

- **Nouveau prompt** `chat_prompt_v2` : demande explicitement une réponse **au format blocs** (schéma injecté),
  décrit les tonalités et **quand** les utiliser (positif/négatif/prudence), impose « ≤ N blocs, tableau
  seulement si ça aide ». Le système reste : *ne cite que les valeurs du contexte* (`SYSTEM`, `xai_text.py:36`).
- **Mode de sortie** : appeler le LLM en **JSON/structured output** (ou function-calling) et **valider par
  Pydantic** (`BlockDocument`). Robustesse : 1 re-tentative si JSON invalide.

### 6.2 Stockage

- Migration Alembic : **`chat_messages.blocks JSONB NULL`**. `content` conservé (texte brut dérivé des blocs,
  pour recherche/copie/fallback).

### 6.3 Anti-hallucination (renforcé au niveau bloc)

- Réutiliser `numbers_exist_in_context` (`xai_text.py:103`) sur **la concaténation de tous les champs texte**
  des blocs. Un nombre absent du contexte → régénération (1×) → **fallback**.

### 6.4 Fallback déterministe

- Si LLM indisponible **ou** JSON invalide 2× **ou** anti-hallucination échoue : on produit un
  **`BlockDocument` déterministe** (un `paragraph` + éventuellement un `table` des top-features) à partir des
  vraies données — `is_fallback = true`, badge « Réponse générée sans IA » conservé (`chat.fallbackNote`).

---

## 7. Chaîne technique — frontend

### 7.1 Composants
- `components/ibis/xai/explanation-copilot.tsx` — le dock (état ouvert/fermé, portail, persistance, Drawer mobile).
- `components/ibis/xai/ibis-blocks.tsx` — le moteur de rendu des blocs (§5).
- On **garde** `xai-chat.tsx` comme cœur logique (session, envoi, polling) ou on le refond dans le copilote.

### 7.2 Design tokens & motif IA
- Réutiliser le **motif IA unifié** (pastille `--ai`, `Sparkles`) et les composants riches du kit (jamais de
  primitive nue) — cf. mémoires `feedback-motif-ia-unifie` et `feedback-design-riche`.

### 7.3 Sécurité de rendu
- Markdown inline **restreint** dans `paragraph`/`list` (gras, italique, `code`, `highlight` — pas de HTML,
  pas de lien arbitraire non maîtrisé). Tonalités = classes issues d'une **map fermée** ; toute valeur hors
  enum → `neutral`.

### 7.4 Temps réel
- On **conserve le polling 1,5 s** existant (`xai-chat.tsx:116`, ADR-007) — pas de streaming en v2. Le dock
  affiche le `TypingLoader` pendant l'attente (comportement actuel réutilisé).

---

## 8. Accessibilité

- Dock = `role="dialog"` `aria-modal` en mobile (feuille), focus trap, `Échap` = réduire, retour focus au
  lanceur. Lanceur = `button` avec `aria-expanded`. Contrastes des tonalités validés AA (les tokens le sont
  déjà en clair/sombre). Zone messages `aria-live="polite"` pour annoncer les réponses.

## 9. i18n

- Toutes les chaînes UI dans `messages/{fr,en}.json` sous `xai.chat` / nouveau `xai.copilot`. **Le contenu
  des blocs est déjà dans la langue de la session** (le LLM répond en `session.language`) — rien à traduire
  côté front. Nouvelles clés : titre copilote, sous-titre contextuel, réduire/fermer, aide saisie multi-lignes.

## 10. Tests

- **Backend** : validation Pydantic du schéma ; anti-hallucination sur blocs (nombre inventé → fallback) ;
  fallback déterministe = `BlockDocument` valide ; parsing JSON invalide → re-tentative → fallback.
- **Frontend (unit)** : `<IbisBlocks>` rend chaque type ; `tone` inconnu → neutre ; message sans `blocks`
  → repli Markdown ; aucun `dangerouslySetInnerHTML`.
- **e2e** : ouvrir/fermer le dock, poser une question, voir un tableau + callout coloré, quota décrémenté,
  état persisté au rechargement — **FR et EN** (aligné sur l'e2e parcours existant).

---

## 11. Points à trancher (décisions)

1. **Contrat de rendu** *(structurant)* — **Recommandé : schéma de blocs JSON** (§4), le plus « interprétable
   par le code » et le plus sûr vis-à-vis du template. *Alternative* : Markdown étendu (directives
   `:::callout`, `==surlignage==`) — plus léger, streamable, mais couleurs moins maîtrisables et parsing plus
   fragile. → **une seule question posée après ce CDC.**
2. **Position du dock** — bas **pleine largeur du contenu** (recommandé) vs bas-droite compact type widget.
3. **Portée du fallback riche** — juste un paragraphe, ou paragraphe **+ tableau des top-features** (recommandé).

## 12. Lotissement proposé

1. **Lot A — UX dock** : sortir le chat de l'`aside`, `explanation-copilot.tsx` (ouvrir/fermer, persistance,
   Drawer mobile), input multi-lignes. *Rendu inchangé (Markdown)* → gain immédiat sur O1/O2.
2. **Lot B — contrat blocs backend** : schéma Pydantic, prompt v2, JSON mode, migration `blocks`,
   anti-hallucination + fallback riche.
3. **Lot C — rendu blocs frontend** : `<IbisBlocks>`, palette sémantique, branchement dans le dock, tests + e2e.

---

*Réf. code : `apps/web/components/ibis/xai/{xai-tab,xai-chat,explanation-view}.tsx` ·
`apps/api/ibis/modules/llm/xai_text.py` · `apps/api/ibis/workers/tasks/explain.py` ·
`apps/api/ibis/modules/xai/{models,routes,service}.py`*
