# Spec Technique — web/xai

| Champ | Valeur |
|-------|--------|
| Module | web/xai |
| Version | 0.1.0 |
| Date dernière MAJ | 2026-07-19 |
| Type | Reflet technique (auto-généré) |
| Généré par | update-writer-after-implement (hook Stop) |

> Module non scaffoldé via /zelian:new-spec — `spec-fonctionnel.md` reste à rédiger par le dev
> (avec Claude chat ou /zelian:spec-writer). Ce fichier reflète uniquement le code réel.

---

## Architecture du module

Le module `web/xai` regroupe les composants React et les utilitaires TypeScript dédiés à
l'affichage des explications XAI et au copilote conversationnel. Il est consommé par `XaiTab`
(onglet explicabilité dans la page de résultats d'expérience).

Trois couches :

- **`lib/xai/features.ts`** — Helpers de formatage lisible (miroir du backend Python) :
  `humanizeFeature` (supprime les préfixes sklearn, détecte `col_valeur`),
  `formatShare` (« 24 % », « <1 % », arrondi demi-parts vers le haut),
  `roundLabel` (arrondi 3 décimales pour l'affichage).
- **`components/ibis/xai/explanation-view.tsx`** — Vue principale de l'explication : graphiques
  avec noms humanisés et importances en %, rendu `IbisBlocks` de `text_blocks` avec repli
  Markdown, bandeau proéminent de régénération (si l'explication est antérieure au profil) avec
  `AlertDialog` de confirmation 1 crédit.
- **`components/ibis/xai/ibis-blocks.tsx`** — Renderer React du contrat `BlockDocument` :
  7 types de blocs (paragraph, heading, list, table, callout, key-value, feature-impact),
  `FeatureImpactBlock` affiche les noms humanisés via `humanizeFeature`.
- **`components/ibis/xai/xai-tab.tsx`** — Orchestrateur de l'onglet XAI (non modifié dans cette
  session) : génération, historique, copilote.
- **`components/ibis/xai/explanation-copilot.tsx`** — Dock copilote conversationnel (non modifié
  dans cette session).

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/web/lib/xai/features.ts` | humanizeFeature, formatShare, roundLabel — miroir du back Python | ~33 |
| `apps/web/components/ibis/xai/explanation-view.tsx` | Vue explication : charts humanisés, IbisBlocks + repli Markdown, bandeau régénération + AlertDialog | ~460 |
| `apps/web/components/ibis/xai/ibis-blocks.tsx` | Renderer BlockDocument (7 types de blocs, feature-impact humanisé) | ~310 |
| `apps/web/tests/xai/features.test.ts` | Tests Vitest de humanizeFeature, formatShare, roundLabel | ~45 |
| `apps/web/messages/fr.json` | Clés i18n xai.* : importanceHint reformulé, clés regenerateTitle/Body/ConfirmTitle/ConfirmBody/Cancel/Confirm | — |
| `apps/web/messages/en.json` | Idem en anglais | — |

---

## API / Endpoints consommés

| Méthode | Route | Composant consommateur | Auth |
|---------|-------|----------------------|------|
| GET | `/explanations/{id}/results` | `explanation-view.tsx` (champ `text_blocks`) | JWT |
| GET | `/experiments/{id}/suggested-questions` | `xai-tab.tsx` | JWT |
| POST | `/experiments/{id}/explanations` | `xai-tab.tsx` (régénération) | JWT |
| GET | `/users/me` | `explanation-view.tsx` (rechargement crédits post-régénération) | JWT |

La réponse `GET /explanations/{id}/results` expose désormais `text_blocks` (JSONB nullable,
migration 0009) — `explanation-view.tsx` l'utilise pour le rendu `IbisBlocks`; si absent,
repli sur `text_explanation` (Markdown).

---

## Patterns identifiés

### Miroir frontend du formatage backend

`lib/xai/features.ts` réplique exactement la logique de `llm/xai_text.py` (`humanize_feature`,
`format_share`) côté TypeScript. Les deux implémentations doivent rester synchronisées : tout
changement dans `xai_text.py` doit être répliqué dans `features.ts`.

### Rendu conditionnel text_blocks / text_explanation

`explanation-view.tsx` vérifie `explanation.text_blocks != null` : si présent, rendu via
`<IbisBlocks doc={text_blocks} />` ; sinon, rendu Markdown de `text_explanation`. Ce pattern
assure la rétrocompatibilité avec les explications générées avant la migration 0009.

### Bandeau de régénération conditionnel

Un bandeau proéminent s'affiche si l'explication a été générée avec un niveau d'audience
différent du niveau effectif courant. La confirmation via `AlertDialog` informe l'utilisateur
du coût (1 crédit) avant de déclencher la régénération.

### i18n obligatoire

Tout texte visible utilise les clés `messages/fr.json` et `messages/en.json`. Les nouvelles clés
de régénération suivent le préfixe `xai.regenerate*` et `xai.confirm*`.

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/web/tests/xai/features.test.ts` | `humanizeFeature` (préfixes, catégorielles, passthrough), `formatShare` (arrondis, <1%, valeur totale 0), `roundLabel` | Existant (~45 lignes) |
| Tests unitaires `explanation-view.tsx` | Rendu conditionnel text_blocks / fallback Markdown, bandeau régénération | Absent |
| Tests unitaires `ibis-blocks.tsx` | Rendu des 7 types de blocs, humanisation feature-impact | Absent |
| Tests e2e Playwright | Parcours XAI (via `xai-tab.tsx`) | Existant (partiel) |
