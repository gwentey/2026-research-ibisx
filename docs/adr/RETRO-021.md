# RETRO-021 — Intégrité référentielle : les blocs "practice" ne citent que des Défis existants

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documenté (rétro)   |
| Date       | 2026-07-19          |
| Source     | Rétro-ingénierie    |
| Features   | web/formation       |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DATA-MODEL |
| Q1 — Coût de revert > 1j ? | OUI — Changer l'invariant (autoriser des slugs de Défi non vérifiés) impliquerait de modifier `lib/formation/catalog.ts`, `lib/formation/bridge.ts`, `tests/formation/bridge.test.ts`, et `lib/challenges/catalog.ts` en coordination. Le risque de liens morts silencieux dans les leçons "mise en pratique" rend tout audit > 1 journée transverse. |
| Q2 — Non-déductible du code ? | OUI — On voit dans le code que `block.challenge` est un string, mais l'intention d'enforcer l'intégrité référentielle (un bloc "practice" DOIT référencer un slug vivant dans `CHALLENGES`) n'est visible ni dans `package.json` ni dans `tsconfig.json`. Elle est encodée dans `bridge.ts` + `bridge.test.ts`. |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — Deux specs sont impactées : `web/formation` (catalogue de leçons, bridge.ts) et `web/challenges` (catalogue des Défis, qui est la source de vérité pour les slugs valides). Toute modification du catalogue des Défis (ajout/suppression de slug) doit être alignée avec les blocs "practice" de l'académie. |
| Q4 — Casse un invariant si ignoré ? | OUI — Un développeur qui ajoute un bloc `{ type: "practice", challenge: "slug-inexistant" }` dans `catalog.ts` provoque un lien mort silencieux : le bouton "Lancer l'enquête" redirige vers `/challenges/slug-inexistant` sans feedback. C'est `bridge.test.ts` qui le détecte, mais uniquement si le développeur fait tourner les tests. |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

L'académie IA (`web/formation`) inclut des leçons de type "mise en pratique" (bloc B8) qui concluent une leçon théorique en renvoyant l'apprenant vers un Défi IBIS-X réel (`/challenges/<slug>`). La valeur pédagogique repose sur le fait que le lien mène vers un vrai pipeline d'entraînement, pas un exercice inventé.

Sans contrainte explicite, un contributeur pourrait ajouter un bloc `practice` pointant vers un Défi supprimé, renommé, ou futur (pas encore existant), créant un lien mort qui dégrade silencieusement l'expérience.

## Décision identifiée

Le fichier `apps/web/lib/formation/bridge.ts` expose `referencedChallenges(cursusList)` qui extrait tous les slugs de Défis cités par des blocs "practice" dans le catalogue. Le test `tests/formation/bridge.test.ts` vérifie que chacun de ces slugs est présent dans `CHALLENGES` (importé de `lib/challenges/catalog.ts`).

La contrainte est encodée par les trois éléments suivants, indissociables :
1. `bridge.ts` : helper pur qui liste tous les slugs référencés
2. `bridge.test.ts` : assertion que chaque slug existe dans le catalogue des Défis
3. Convention de catalogue : le slug de Défi est stocké dans le champ `challenge` du bloc en TypeScript (`catalog.ts`), jamais dans les fichiers i18n

Les blocs "practice" présents dans la Vague 1 :
- `ta-premiere-enquete` → `titanic-1912`
- `ta-deuxieme-enquete` → `eleves-decrochage`
- `ta-troisieme-enquete` → `equite-revenus`

## Conséquences observées

### Positives
- Zéro lien mort dans les transitions formation → Défis en production
- La suppression ou le renommage d'un Défi dans `lib/challenges/catalog.ts` est détectée en CI avant merge
- Le contrat entre les deux features est explicite et testable

### Négatives / Dette
- Un Défi ne peut pas être supprimé du catalogue des Défis sans d'abord retirer les blocs "practice" qui le référencent dans l'académie — les deux changements doivent être coordonnés dans le même commit
- Les Défis des vagues 2 et 3 devront être créés dans `lib/challenges/catalog.ts` AVANT d'être référencés dans le catalogue de formation

## Recommandation

Garder. L'intégrité référentielle est la garantie que le pont formation → pratique réelle reste le principal argument pédagogique de l'académie. La contrainte est légère (un test CI) et le coût d'ignorance est élevé.
