# RETRO-web-experiments-01 — Révélation progressive des blocs de résultats par niveau d'audience

| Champ      | Valeur                        |
|------------|-------------------------------|
| Statut     | Documenté (rétro)             |
| Date       | 2026-07-19                    |
| Source     | Rétro-ingénierie              |
| Features   | web/experiments, web/xai      |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DESIGN |
| Q1 — Coût de revert > 1j ? | OUI — modifier la politique touche `lib/audience/policy.ts` (table `BLOCK_MIN_AUDIENCE`), `page.tsx` (onglet Performance), `xai-tab.tsx` (paramètre `audience` transmis à la génération), `api/xai` (profondeur d'explication textuelle), `api/llm` (cible ~180/250/320 mots par niveau), et les tests `policy.test.ts`. La propagation est transverse front+back. |
| Q2 — Non-déductible du code ? | OUI — la table `BLOCK_MIN_AUDIENCE` est dans le code, mais la justification du classement (pourquoi `confusion` = novice et `curves` = intermediate, référencé dans les commentaires comme `docs/adaptatif/CAHIER-DES-CHARGES.md §4`) n'apparaît ni dans `package.json` ni dans les configs. L'invariant P1 « jamais supprimer, seulement replier » est posé dans les commentaires source mais absent de tout fichier de configuration. |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — web/experiments (onglet Performance, `AdvancedDetails`), web/xai (`XaiTab` : `audience` pilote la génération et la profondeur LLM), api/xai (génération adaptée par niveau), api/llm (longueur cible ~180/250/320 mots). |
| Q4 — Casse un invariant si ignoré ? | OUI — (a) un dev ajoutant un nouveau bloc de résultats sans entrée dans `BLOCK_MIN_AUDIENCE` le rend toujours visible pour novice, cassant la pédagogie progressive ; (b) retirer `audience` des props de `XaiTab` brise l'adaptation LLM ; (c) remplacer `AdvancedDetails` (replier) par un filtre (supprimer) viole l'invariant P1. |

> ✅ Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

IBIS-X expose des résultats de machine learning à trois niveaux d'utilisateurs déclarés à l'onboarding : `novice`, `intermediate`, `expert`. Un novice qui découvre la matrice de confusion ou les courbes ROC sans guide risque une surcharge cognitive ou une mauvaise interprétation. À l'inverse, un expert qui ne voit que la métrique principale n'a pas les informations nécessaires pour juger la qualité d'un modèle.

Le cahier des charges adaptatif (§4) impose une politique de révélation progressive : chaque bloc de résultats a un niveau minimum requis. En dessous de ce seuil, le bloc est replié dans un accordéon « Détails avancés » mais jamais supprimé (invariant P1 : un curieux peut toujours déplier).

## Décision identifiée

Une table `BLOCK_MIN_AUDIENCE` centralisée dans `apps/web/lib/audience/policy.ts` associe chaque bloc de résultats à son niveau minimum :

| Bloc | Niveau minimum |
|------|---------------|
| `confusion` | novice |
| `importance` | novice |
| `metric_grid` | intermediate |
| `curves` | intermediate |
| `regression` | intermediate |
| `tree` | intermediate |
| `preprocessing` | expert |
| `logs` | expert |

La fonction `isBlockVisible(block, effectiveAudience)` compare les rangs ordinaux `{novice: 0, intermediate: 1, expert: 2}`. Les blocs invisibles au niveau courant sont passés à `<AdvancedDetails>` (Collapsible), jamais filtrés.

Cette politique s'étend au backend : le paramètre `audience` est transmis à `requestExplanation`, qui pilote la profondeur du texte LLM (~180/250/320 mots) et le ton du copilote.

Le niveau effectif est éphémère (état local de la page) : la bascule « Voir en tant que » permet de naviguer hors de son profil sans modifier le profil enregistré.

## Conséquences observées

### Positives
- La page de résultats est lisible par un novice (métrique principale + matrice de confusion + importance) sans noyer dans les courbes ROC/PR ou les logs de training.
- L'expert accède à tous les blocs directement, sans accordéon.
- Un novice curieux peut toujours déplier `AdvancedDetails` — P1 respecté.
- La même politique pilote la génération LLM backend, garantissant la cohérence front/back.

### Négatives / Dette
- Tout nouveau bloc de résultats (ex. calibration curve, learning curve) doit être ajouté à `BLOCK_MIN_AUDIENCE` manuellement — risque d'oubli silencieux (le bloc devient visible pour tous par défaut si omis).
- La politique est figée dans le code source front : changer le classement d'un bloc nécessite un déploiement. Un backend de configuration (admin) permettrait une gestion dynamique.
- `AudienceWarning` (garde-fou visuel quand effectif ≠ profil) n'a pas de test d'intégration.

## Recommandation

**Garder.** La politique est cohérente et testée (`policy.test.ts`, 4 cas). Ajouter une règle de lint ou un commentaire obligatoire dans `policy.ts` rappelant qu'un nouveau bloc doit y être enregistré. À terme, envisager un fichier de configuration versionné plutôt que du code pour les seuils.
