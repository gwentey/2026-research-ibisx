# Design — Évolution 1 XAI : nombres lisibles

> Date : 2026-07-19 · Statut : **validé** (design approuvé en session)
> CDC de référence : `docs/specs/xai-evolutions/cdc.md` §Évolution 1.
> Périmètre : `apps/api/ibis/modules/llm/xai_text.py`, `apps/api/ibis/modules/xai/blocks.py`,
> `apps/web/lib/xai/`, `apps/web/components/ibis/xai/`.

## Problème

Le LLM recopie les importances SHAP en pleine précision (`cat__Sex_female = 0.242421`) dans
l'explication ET le chat. Illisible pour un novice : noms techniques (`cat__`, `num_median_0__`)
et floats bruts. Objectif : « Sexe = femme, ≈ 24 % » partout, sans casser le garde-fou
anti-hallucination ni le repli déterministe.

## Constats de code qui cadrent le design

- Les noms bruts viennent de `pipeline.get_feature_names_out()` (`preprocessing.py:281`) :
  transformers `num_<stratégie>_<index>` et `cat` → `num_median_0__Pclass`,
  `cat__Sex_female` (one-hot = `Colonne_catégorie`), `cat__Sex` (ordinal).
- `build_context()` est **partagé** entre l'explication (`_generate_text`) et le chat
  (`answer_chat_question`) : le corriger corrige les deux chemins.
- Le moteur stocke les importances **top-15** (`TOP_DISPLAY`, `engine.py:34`) et le chart front
  affiche cette même liste → dénominateur commun pour des % identiques back/front.
- Le garde-fou `numbers_exist_in_context` tolère arrondis 0–4 déc. + équivalents ×100 +
  valeur exacte, mais **pas** l'équivalent ÷100 (contexte « 24 » → « 0,24 » rejeté à tort).
- Aucune route/schéma ne change → pas de migration, pas de régénération OpenAPI.

## Décisions

### D1 — `humanize_feature(name: str) -> str`, fonction pure dans `xai_text.py`

Pattern « prompts as pure functions » conservé (pas d'accès BDD/config, testable sans infra).

Règles, dans l'ordre :
1. Séparer au premier `__` : partie gauche = nom du transformer, partie droite = reste.
   Sans `__` → nom déjà lisible, étape 2 sautée.
2. Si transformer `cat` (préfixe one-hot/ordinal) et reste contenant `_` : coupure au
   **dernier** `_` → `Colonne = catégorie` (« Sex = female »). Justification : les colonnes
   SHS sont souvent snake_case multi-mots (`niveau_etude`), les catégories rarement — la
   coupure au dernier `_` est le bon pari. Ordinal (`cat__Sex`, pas de `_` restant) → colonne.
3. Underscores du nom de colonne → espaces (« niveau etude »). Catégorie inchangée.
4. Jamais d'exception : entrée inattendue → retour tel quel.

**Choix assumés (écarts à la lettre du CDC, validés) :**
- *Pas de regroupement/masquage des identifiants bruités* : le top-15 + % évacue naturellement
  le bruit type `Ticket_347082` (importances minuscules) ; masquer irait contre la transparence
  XAI ; regrouper imposerait de sommer des importances → divergence contexte/charts.
- *Pas de traduction des noms de colonnes* (« Sex = female », pas « Sexe = femme ») : la
  traduction vient naturellement de la prose du LLM ; un dictionnaire de noms arbitraires
  serait faux hors datasets connus.

### D2 — Formatage du contexte LLM (`build_context`)

- Métriques : arrondi 3 décimales, format `:g` (0.83 → « 0.83 », 0.8324451 → « 0.832 »).
- Importances : « part de l'importance affichée » en **% entiers**,
  dénominateur = Σ|v| de la **liste reçue entière** (= top-15 stocké, celui que le chart
  montre) ; liste intégralement affichée dans le contexte (≈15 lignes, coût négligeable) ;
  « <1 % » pour les poussières (le « 1 » est un ordinal toléré par le garde-fou).
- Contributions locales signées : même % + flèche ↗ (pousse vers le haut) / ↘ (vers le bas) —
  neutre en langue, aucun chiffre parasite, la direction n'est pas perdue.
- `local_values` (prediction, base_value) : arrondi 3 décimales. `predicted_label` inchangé.
- L'en-tête du contexte annonce le format : « Importances (part de l'importance affichée, %) ».

### D3 — Prompts

`build_prompt` et `chat_prompt_v2` : consigne ajoutée « cite les nombres tels qu'affichés
dans le contexte (arrondis / en %), sans re-dériver de précision ». FR et EN.

### D4 — Garde-fou `numbers_exist_in_context`

Seul ajout : tolérance symétrique **÷100** (« 24 » au contexte → « 0.24 » accepté), en miroir
de la tolérance ×100 existante. Tout le reste inchangé (valeur exacte `:g`, arrondis 0–4 déc.,
ordinaux, log `xai_text.foreign_numbers`).

### D5 — Replis déterministes

- `fallback_text` (xai_text) : noms humanisés, métrique arrondie 3 déc.
- `fallback_document` (blocks.py) : noms humanisés dans le tableau, colonne « Poids » en **%**
  (« Poids (%) » / « Weight (%) »), même dénominateur que D2. Import
  `from ibis.modules.llm.xai_text import humanize_feature` — sens unique, pas de cycle
  (`xai_text` n'importe pas `xai.blocks`).

### D6 — Front (miroir minimal)

- Nouveau `apps/web/lib/xai/features.ts` : `humanizeFeature()` (miroir exact de D1) +
  `importancePercents()` (même formule que D2, % entiers sur la liste affichée).
- `explanation-view.tsx` : labels humanisés partout (chart importance globale, waterfall,
  comparaison SHAP/LIME) ; chart importance en % (tooltip « 24 % ») ; waterfall garde les
  contributions **signées** arrondies 3 déc. (unités réelles, pas de %) ; base_value/prediction
  affichés arrondis.
- `ibis-blocks.tsx` : `featureImpact` humanise `item.feature` au rendu (normalise aussi les
  anciens messages du chat qui contiennent des noms bruts).
- Sélecteur d'instances de test : si des noms bruts y transitent, même helper.
- Hors périmètre : beeswarm (viz expert, valeurs SHAP brutes conservées).
- i18n : hints de charts ajustés dans `messages/fr.json` **et** `messages/en.json`.

## Tests (TDD)

Backend (`apps/api/tests/unit/test_xai_text.py`, sans clé LLM — fonctions pures) :
- `humanize_feature` : `cat__Sex_female` → « Sex = female » ; `num_median_0__Pclass` →
  « Pclass » ; `cat__Embarked_S` ; colonne snake_case (`cat__niveau_etude_Bac` →
  « niveau etude = Bac ») ; ordinal `cat__Sex` → « Sex » ; nom nu inchangé.
- `build_context` : zéro float brut (`0.242421` absent), % entiers sommant ≈ 100, noms
  humanisés, métriques 3 déc., flèches en local.
- Garde-fou : sur contexte arrondi, « ≈ 24 % » et « 0,24 » acceptés, nombre étranger rejeté.
- Replis : aucun `cat__`/`num_…__` dans `fallback_text` ni `fallback_document` ; tableau en %.
- Prompts : la consigne « tels qu'affichés » présente FR/EN.

Front (vitest) : `humanizeFeature` + `importancePercents` (mêmes cas que le back) ; rendu
`featureImpact` avec nom brut → label humanisé.

## Critères d'acceptation (CDC)

- Titanic : « Sex = female : 24 % » au contexte → prose « le sexe », « ≈ 24 % » ; jamais
  `cat__Sex_female = 0.242421` (prose, charts, replis).
- Aucun repli hallucination sur ce cas (tolérances testées).
- Repli « sans IA » intact ; chemin `reasoning` du client intouché ; CI verte.

## Livraison

Un lot, un commit : `feat(xai): nombres lisibles — importances en %, variables humanisées
(évolution 1)`. Pas de push sans demande.
