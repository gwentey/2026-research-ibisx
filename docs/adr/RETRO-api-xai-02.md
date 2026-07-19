# RETRO-api-xai-02 — Contrat BlockDocument pour les réponses de chat XAI

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documenté (rétro)   |
| Date       | 2026-07-19          |
| Source     | Rétro-ingénierie    |
| Features   | api/xai, web/xai    |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DATA-MODEL |
| Q1 — Coût de revert > 1j ? | OUI — Le contrat `BlockDocument` est implémenté de façon symétrique en Python (`api/xai/blocks.py`) et en TypeScript (`web/components/ibis/xai/ibis-blocks.tsx`). Modifier un type de bloc, ajouter un champ requis, ou changer la représentation des tones nécessite : mise à jour du schéma Pydantic, mise à jour des prompts LLM dans `xai_text.py`, mise à jour du composant React de rendu, régénération du client TypeScript. > 1 journée avec tests de non-régression. |
| Q2 — Non-déductible du code ? | OUI — Trois décisions architecturales ne sont pas lisibles dans les configs : (a) les blocs utilisent `ConfigDict(extra="ignore")` — délibéré pour absorber les champs superflu d'un LLM sans rejeter tout le document ; (b) les couleurs sont des tonalités sémantiques (`Tone`) jamais des valeurs hex — le kit CSS est seul maître du rendu ; (c) `schema_version = 1` est un champ de versioning explicite pour les migrations futures du contrat. Ces trois invariants sont des choix de conception croisés API/web. |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — Impacte : `api/xai` (schéma Pydantic `blocks.py`, sérialisation dans `explain.py`, stockage JSONB dans `ChatMessage.blocks`) ; `api/llm` (`xai_text.py` : les prompts chat v2 doivent générer un JSON conforme au schéma BlockDocument) ; `web/xai` (`ibis-blocks.tsx` : renderer React qui consomme le schéma, `blocks.ts` : types TypeScript miroir). |
| Q4 — Casse un invariant si ignoré ? | OUI — Un développeur qui ignorerait ce contrat pourrait : (a) ajouter `extra="forbid"` sur un bloc, rejetant les réponses LLM qui incluent des champs inconnus et déclenchant systématiquement le fallback ; (b) utiliser des valeurs hex dans le champ `tone` d'une cellule de tableau, court-circuitant les tokens du design system et créant des incohérences visuelles non-reproductibles entre thèmes ; (c) changer le discriminateur de type d'un bloc sans mise à jour côté frontend, rendant ce type de bloc invisible dans le renderer. |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

La v1 du chat XAI renvoyait du texte libre (plain text). La v2 introduit un format de réponse structurée pour permettre un rendu riche côté web : tableaux colorés, listes, callouts d'avertissement, barres d'importance. Ce format doit être compris simultanément par le LLM qui le génère (via le prompt système), le backend qui le valide (Pydantic), et le frontend qui le rend (composant React).

Un contrat strict mais tolérant aux extras (coté LLM) est l'invariant central : le backend ne doit jamais rejeter une réponse LLM parce qu'elle contient un champ inoffensif inconnu, mais doit toujours rejeter une réponse dont la structure fondamentale est incorrecte.

## Décision identifiée

1. Les réponses de chat sont des `BlockDocument` : `{"schema_version": 1, "blocks": [...]}`.
2. 7 types de blocs avec discriminant `type` : `paragraph`, `heading`, `list`, `table`, `callout`, `keyValue`, `featureImpact`.
3. Toutes les couleurs sont des tonalités sémantiques : `"neutral" | "accent" | "positive" | "negative" | "warning"`. Aucune valeur hex n'est acceptée dans le document.
4. Les modèles de blocs (`_Block` et sous-classes) utilisent `ConfigDict(extra="ignore")` — les champs supplémentaires générés par le LLM sont silencieusement ignorés.
5. `ChatMessage.blocks` stocke le `BlockDocument` sérialisé en JSONB. `ChatMessage.content` est systématiquement le miroir texte via `to_plain_text()` (accessibilité, repli, recherche).
6. En cas de JSON invalide ou de nombre halluciné dans les blocs, jusqu'à 2 tentatives LLM sont effectuées avant de passer au `fallback_document` déterministe (paragraphe + tableau + callout warning).
7. `parse_document()` tolère les enrobages LLM fréquents (fences ```json) et les tableaux de blocs nus (sans objet wrapper).

## Conséquences observées

### Positives
- Le frontend peut rendre des réponses riches (tableaux, barres d'importance) sans parsing custom.
- La validation Pydantic garantit que seuls des blocs structurellement valides atteignent la DB.
- Le fallback déterministe produit lui aussi un `BlockDocument` — le frontend ne distingue jamais structurellement LLM vs fallback (seul `is_fallback=true` et le callout warning signalent la différence).
- `schema_version` permet des migrations futures du contrat sans casser les anciens messages.

### Négatives / Dette
- Le contrat est dupliqué en Python (`blocks.py`) et en TypeScript (`ibis-blocks.tsx` + `blocks.ts`). Toute évolution doit être synchronisée manuellement — il n'y a pas de génération automatique depuis le schéma Pydantic.
- Les prompts LLM dans `xai_text.py` doivent décrire le schéma JSON à générer — ils dépendent de la structure de `BlockDocument` et devront être mis à jour lors de toute évolution.

## Recommandation

Garder. La duplication Python/TypeScript est un coût acceptable pour la clarté du rendu. Envisager à terme la génération du schéma TypeScript depuis le schéma Pydantic (`pydantic2ts` ou export OpenAPI) pour éliminer la désynchronisation manuelle.
