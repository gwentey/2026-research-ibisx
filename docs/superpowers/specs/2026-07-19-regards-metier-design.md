# Spec — « Regards métier » sur les résultats (V1 front déterministe)

> **Date** : 19 juillet 2026 · **Statut** : validé pour build (Anthony : « pour lundi, V1 front déterministe, TDD »).
> **Objectif de démo** : lundi 20/07, montrer le *même* résultat lu « à travers les yeux » de 6 disciplines SHS.

## 1. Intention

Sur la page de résultats, une bascule **« Résultat classique »** ⇄ **« À travers les yeux de {discipline} »**. Chaque regard lit **les mêmes vrais chiffres** (métriques, importance des variables, matrice de confusion, classes) et : met en avant ce qui l'intéresse, l'exprime dans son langage, **et nomme son angle mort**. On **switche pour apprendre**.

**Dimension orthogonale à `XaiAudience`** (novice/expert = *à quel point c'est technique* ; regard = *à travers quels yeux*). Le classique = aucun regard.

## 2. Les 6 regards (disciplines SHS pures)

| Regard | Icône | Met en avant (depuis les vraies données) | Angle mort (ce qu'il apprend) |
|---|---|---|---|
| **Économiste** | TrendingUp | Variables les plus associées (feature importance), magnitude, métrique principale | Association ≠ causalité ; ici pas de coefficient/IC |
| **Juriste** | Scale | **Variables sensibles utilisées** (détectées par nom), explicabilité (AI Act, RGPD art. 22) | Performant ≠ licite : un modèle peut discriminer |
| **Politiste** | Landmark | Représentativité, taille/équilibre des classes, ce que ça dit des groupes | Généraliser exige un échantillon (+ poids) représentatif |
| **Sociologue** | Users | Catégories sociales derrière les variables, effets de structure | Corréler n'explique pas le mécanisme ; risque de naturaliser |
| **Historien / quali** | Scroll | Provenance et temporalité des données, ce que les chiffres taisent | Données situées ; le modèle efface contexte et cas singulier |
| **Éthicien IA** | Compass | Variables sensibles, équité, honnêteté du modèle, finalité/consentement | La question n'est pas « est-ce légal » mais « est-ce juste » |

## 3. Architecture (zéro backend, zéro migration — décision J-1)

- **`lib/lenses/types.ts`** — `LensId`, `ResultInsights`, `FeatureImportance`.
- **`lib/lenses/insights.ts`** *(PUR, TDD)* — `extractInsights(results)`, `detectSensitiveFeatures(names)`, `prettyFeatureName(raw)`. Détection sensible par **tokenisation** (pas de substring : « average » ne doit pas matcher « age »).
- **`lib/lenses/catalog.ts`** — les 6 regards (id, icône, métriques mises en avant).
- **`lib/lenses/store.ts`** — Zustand + `localStorage` (`ibis:lens`), champ `discipline` (le défaut choisi au profil). Patron identique à `lib/challenges/store.ts`.
- **`components/ibis/lenses/lens-switcher.tsx`** — contrôle segmenté [Classique | 6 regards].
- **`components/ibis/lenses/lens-reading.tsx`** — carte pédagogique **monochrome + icône** (PAS le motif `--ai` : le contenu est déterministe, pas généré-IA — honnêteté P2). Rend les faits via i18n interpolé avec les vrais chiffres.
- **`components/ibis/lenses/discipline-selector.tsx`** — sélecteur « Ma discipline » sur la page profil.
- **i18n** — namespace `lenses` complet **FR + EN** (test de parité strict existant).
- **Câblage** — `experiments/[id]/page.tsx` (switcher + reading, défaut = discipline du profil), `profile/page.tsx` (sélecteur).

## 4. Honnêteté (P1/P2)

- Mêmes chiffres réels ; le regard ne change QUE l'emphase et le langage. Aucune donnée inventée.
- Si une variable sensible n'est **pas** détectée : le dire (« aucune détectée par nom, mais des proxys peuvent subsister »), ne pas prétendre le contraire.
- V1 = **déterministe** → styling pédagogique neutre, jamais le motif IA. V2 (LLM « à travers les yeux de X » + repli `is_fallback`) portera le motif `--ai`.

## 5. Definition of done

- Bascule fonctionnelle sur `/experiments/[id]`, 7 états, switch instantané.
- Chaque regard affiche ≥ 1 fait réel injecté (ex. top variable réelle) + son caveat.
- Sélecteur de discipline au profil, persistant (localStorage), pilote le défaut.
- FR + EN complets (parité verte), typecheck + lint + test + build verts, e2e mission FR/EN toujours verts.
- Aucune primitive nue, aucune couleur hors tokens, motif `--ai` non détourné.

## 6. Hors V1 (V2+)

Narratif LLM par regard (repli honnête), persistance backend de la discipline (champ profil + migration), regards supplémentaires (data scientist, décideur), export du regard dans le rapport de recherche ([audit E1](../../audit-valeur-recherche.md)).
