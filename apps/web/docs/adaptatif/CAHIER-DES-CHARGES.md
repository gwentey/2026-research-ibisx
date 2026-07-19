# IBIS-X — Cahier des charges : **Résultats & explications adaptatifs au profil**

> **Version** : 1.0 — 19 juillet 2026
> **Statut** : Document fondateur. Met en œuvre la **Phase 3** du cadre académique d'IBIS-X (explicabilité *centrée utilisateur*, adaptation sémantique / structurelle / interactionnelle — Charge Cognitive, Sweller 1988).
> **Périmètre** : full-stack (`apps/web` + `apps/api`). Contrairement aux Défis, une partie exige le backend.

---

## 0. Conventions

`[MUST]` obligatoire · `[SHOULD]` recommandé · `[V2]` plus tard · `[NE PAS FAIRE]` interdit. Les 7 principes tiennent — ici surtout **P2 (IA honnête** : tout repli marqué, jamais de faux SHAP) et **P4 (reproductibilité** : température 0).

---

## 1. Contexte : la valeur d'IBIS-X, c'est l'adaptation au profil

Le différenciateur académique d'IBIS-X (mémoire M2, papier KES) n'est pas « faire du ML » — c'est **adapter la restitution au niveau de compréhension de l'utilisateur**. C'est la Phase 3 du framework : *« SHAP/LIME avec adaptation sémantique, structurelle et interactionnelle au profil »*.

**État actuel (cartographié) — le socle existe mais à moitié :**

| Brique | État |
|---|---|
| Niveau utilisateur `XaiAudience` (novice/intermediate/expert), dérivé de la familiarité 1-5, éditable au profil | ✅ complet |
| Adaptation du **texte d'explication LLM** (longueur + ton) | 🟡 partiel (`AUDIENCE_SPECS`, structure figée) |
| Adaptation **structurelle** (quels résultats/graphes on montre selon le niveau) | ❌ absent — tout est montré à tous |
| **Chat** adaptatif au niveau | ❌ absent (prompt sans audience) |
| Sélecteur **« voir en tant que »** par niveau + surcharge par requête | ❌ absent (audience figée au profil) |
| Repli déterministe (« sans IA ») par niveau | ❌ absent (ignore l'audience) |
| Affichage du niveau sur le résultat | ❌ retiré (clé `xai.text.audience` orpheline) |
| **Précédent UI réutilisable** : système *Regards métier (Lenses)* | ✅ front-only, localStorage, `LensSwitcher`/`LensReading` |

### 1.1 Le besoin (mots d'Anthony)

> « Les résultats doivent **s'adapter au profil**. Certains résultats donnés à un avancé ne sont pas donnés à un novice ; l'explication et le chat changent selon le niveau (novice → **métaphores hyper simples, analogies**). **SURTOUT** : afficher les résultats **selon le profil par défaut**, mais garder un **switch** pour voir *« en tant que Novice / Confirmé / Expert »* directement sur la page de résultats — avec un **avertissement** quand on sort de son niveau. »

---

## 2. Concept central : le **« niveau effectif »**

On introduit une notion unique qui pilote TOUTE la restitution :

> **Niveau effectif** = le niveau auquel la page de résultats et l'Explicabilité sont actuellement rendues.
> **Par défaut, il vaut le niveau du profil de l'utilisateur.** Un sélecteur permet de le surcharger temporairement.

- **[MUST]** Par défaut, tout est rendu au **niveau du profil** (`user.xai_audience`).
- **[MUST]** La surcharge est **éphémère** : elle vaut pour la consultation en cours, **ne modifie pas le profil**, et **repart du profil** à chaque nouvelle ouverture de la page de résultats (le « vrai » niveau reste celui du profil). *(≠ Lenses qui persiste : ici la persistance nuirait à « par défaut = mon niveau ».)*
- **[MUST]** Trois valeurs, alignées sur `XaiAudience` : **Novice / Intermédiaire / Expert** (libellés i18n `profile.audience.*` déjà présents).

---

## 3. Le sélecteur **« Voir en tant que »** + garde-fous (le SURTOUT)

**[MUST]** Sur la page de résultats (`experiments/[id]`), un **`AudienceSwitcher`** calqué sur le `LensSwitcher` existant :

- `ToggleGroup` : **Novice · Intermédiaire · Expert**. La valeur du **profil** est marquée (badge « vous » / point).
- Sélection par défaut = niveau du profil.
- Changer le sélecteur **re-rend instantanément** la page au niveau choisi (§4) — front-only, aucun appel réseau, aucun crédit.

**Garde-fous (l'« attention ») — [MUST] :** un bandeau apparaît dès que le niveau effectif ≠ niveau du profil :

- **Vue au-DESSUS de son niveau** (ex. profil Novice → vue Expert) : bandeau **d'alerte** (ton sérieux, icône ⚠️) :
  > « Vous êtes **Novice** dans IBIS-X. Cette vue est pensée pour un public **Expert** et peut être difficile à interpréter. → **Revenir à mon niveau (Novice)** »
- **Vue en-DESSOUS de son niveau** (ex. profil Expert → vue Novice) : note **informative** (ton léger) :
  > « Vue simplifiée (**Novice**). → **Revenir à mon niveau (Expert)** »
- Le bouton « Revenir à mon niveau » réinitialise le niveau effectif au profil.

**[SHOULD]** Un lien discret « Ce niveau ne me convient pas ? Ajuster mon profil » vers `/profile` (préférences) — la surcharge est un coup d'œil, le vrai réglage vit au profil.

---

## 4. Adaptation **structurelle** : révélation progressive des résultats

**[MUST]** Chaque bloc de l'onglet *Performance* porte un **niveau minimal**. On rend directement les blocs dont le niveau minimal ≤ niveau effectif ; les blocs au-dessus sont **repliés** dans une section « **Détails avancés** » (dépliable), **jamais supprimés** (un novice curieux peut ouvrir ; un expert voit tout d'emblée).

| Bloc | Niveau minimal | Rendu novice |
|---|---|---|
| Score composite (jauge + libellé « Bon/Moyen ») | **novice** | ✅ + glose « score sur 1, plus proche de 1 = mieux » |
| **Métrique principale** (tuile, avec hint en clair) | **novice** | ✅ mise en avant, hint pédagogique |
| Matrice de confusion (visuelle, intuitive) | **novice** | ✅ + légende « où le modèle se trompe » |
| Importance des variables (ce qui a compté) | **novice** | ✅ framée « quelles infos ont pesé » |
| Grille complète des métriques secondaires (precision/recall macro, F1 pondéré…) | **intermediate** | replié (Détails avancés) |
| Courbes ROC / PR | **intermediate** | replié |
| Arbre de décision / graphes de résidus (régression) | **intermediate** | replié |
| Transformations réellement appliquées (preprocessing) | **expert** | replié |
| Journal d'entraînement (logs worker) | **expert** | replié |

- **[MUST]** La révélation progressive ne **cache jamais une donnée réelle** : elle la **replie** (P1/P2 — honnêteté). Le libellé de la section repliée annonce ce qu'elle contient et pour quel niveau.
- **[SHOULD]** En vue novice, une phrase-cadre en tête : « On vous montre l'essentiel. Passez en Intermédiaire/Expert (ci-dessus) pour tout voir. »
- **Adaptation sémantique** : étendre `metricHints` (aujourd'hui 6 métriques) et fournir, en vue **novice**, des hints **analogiques** ; en vue **expert**, les définitions techniques. Clés i18n par niveau : `experiments.metricHints.<key>` (défaut) + `experiments.metricHintsNovice.<key>` (optionnel).

---

## 5. Adaptation **interactionnelle** : explication + chat au niveau effectif

**[MUST]** L'audience effective (le sélecteur) pilote **la génération**, pas seulement le rendu :

### 5.1 Explication (`requestExplanation`)
- **[MUST] Back** : ajouter un champ **optionnel** `audience` à `ExplanationRequest` (`xai/routes.py`) et à `request_explanation` (`xai/service.py`). S'il est fourni → il **surcharge** `user.xai_audience` pour cette explication ; sinon comportement actuel (profil).
- **[MUST] Front** : `xai-tab.tsx` envoie le **niveau effectif** dans le body.
- **[MUST]** L'explication stocke `audience_level` (déjà le cas) = niveau effectif au moment de la génération.
- **[MUST]** Réintroduire l'**affichage du niveau** sur le résultat d'explication (clé orpheline `xai.text.audience`), + si ce niveau ≠ profil, un micro-badge « généré en vue <niveau> ».
- **[SHOULD]** Sur une explication existante générée à un autre niveau que la vue courante : proposer « **Regénérer en vue <niveau effectif>** » (coûte 1 crédit, choix explicite).

### 5.2 Chat (`askChatQuestion`)
- **[MUST] Back** : `chat_prompt` / `chat_system` / `answer_chat_question` (`llm/xai_text.py`, `workers/tasks/explain.py`) reçoivent l'audience. Le **system prompt novice** impose : **métaphores du quotidien, analogies systématiques, zéro jargon, phrases courtes** ; expert : terminologie exacte. Le **fallback** du chat cesse de coder `audience="novice"` en dur (`explain.py:253`) → utilise l'audience réelle.
- **[MUST] Front** : `xai-chat.tsx` transmet le niveau effectif (via `createChatSession` ou `askChatQuestion`).
- **[SHOULD]** `suggested_questions` adaptées au niveau (novice : « En quoi c'est comme… ? »).

### 5.3 Repli déterministe par niveau
- **[MUST]** `fallback_text` (`xai_text.py:122`) tient enfin compte de l'audience (longueur + formulation), au lieu d'un texte unique — reste marqué « Généré sans IA » (P2).

### 5.4 Enrichir `AUDIENCE_SPECS` (novice)
- **[MUST]** Le spec **novice** insiste explicitement sur **analogies/métaphores** (aujourd'hui « analogies du quotidien » — le renforcer : « commence par une analogie concrète, puis traduis chaque chiffre en langage courant »).

---

## 6. Main tenue renforcée pour les grands débutants (novice uniquement)

**[MUST]** Gaté sur **niveau effectif = novice** :
- Onglet Explicabilité : un **mini pas-à-pas « Comment lire cette explication »** (2-3 étapes visuelles) avant/à côté du résultat, réutilisant le motif pédagogie visuelle (EducIA) et `AiAssist`.
- Le bloc de génération annonce en clair ce qui va se passer (déjà partiellement fait par `ExplainIntro`/`GeneratingPanel` — renforcer le cadrage novice).
- **[NE PAS FAIRE]** Afficher ce pas-à-pas aux niveaux intermediate/expert (charge inutile).

---

## 7. Architecture technique

### 7.1 Front — le niveau effectif (calqué sur Lenses)
- `lib/audience/types.ts` — type `EffectiveAudience = "novice"|"intermediate"|"expert"` + politique de blocs `BLOCK_MIN_AUDIENCE`.
- `lib/audience/store.ts` — store Zustand **non persisté**, initialisé depuis `user.xai_audience`, exposant `{ effective, profileAudience, setEffective(a), reset() }`. Réinitialisé au montage de la page de résultats.
- `components/ibis/audience/audience-switcher.tsx` — calque `LensSwitcher` (ToggleGroup).
- `components/ibis/audience/audience-warning.tsx` — bandeau alerte/info selon dessus/dessous.
- `lib/audience/policy.ts` — `isBlockVisible(blockKey, effective)` (pure, testable).
- Câblage dans `experiments/[id]/page.tsx` (blocs conditionnés) et `xai-tab.tsx` (audience passée à la génération/chat).

### 7.2 Back — surcharge d'audience (minimal, ciblé)
- `xai/schemas.py` : `ExplanationRequest.audience: XaiAudience | None = None` ; `ChatAsk`/session : `audience` optionnel.
- `xai/service.py` `request_explanation` : `audience_level = (audience or user.xai_audience).value`.
- `llm/xai_text.py` : `chat_prompt`/`chat_system`/`suggested_questions`/`fallback_text` prennent `audience` ; enrichir `AUDIENCE_SPECS.novice`.
- `workers/tasks/explain.py` : propager l'audience au chat + fallback.
- **[MUST]** Régénérer le SDK front : `pnpm generate:api` (openapi-ts) après changement de schéma.
- **[MUST]** Tests back : surcharge d'audience prise en compte ; fallback varie par niveau ; température 0 (P4).

### 7.3 Design system
- Tokens uniquement ; `--ai` réservé aux blocs IA ; le bandeau d'alerte réutilise les tons du kit (pas de rouge hors token). Le switcher reprend l'ergonomie du `LensSwitcher`.

---

## 8. Découpage en phases

1. **P1 — Niveau effectif + sélecteur + garde-fous** (front) : store, `AudienceSwitcher`, `AudienceWarning`, câblage page résultats (sans encore replier les blocs). *Livrable : on peut « voir en tant que », avec avertissement.*
2. **P2 — Révélation progressive** (front) : politique de blocs + section « Détails avancés », hints sémantiques par niveau. *Livrable : le novice ne voit que l'essentiel, l'expert tout.*
3. **P3 — Génération au niveau effectif** (back + front + SDK) : surcharge audience dans `requestExplanation` ; réaffichage du niveau ; regénérer-en-vue. *Livrable : l'explication suit le niveau choisi.*
4. **P4 — Chat adaptatif + fallback par niveau** (back + front) : chat novice = métaphores ; fallback par niveau ; suggested questions. *Livrable : le chat parle au bon niveau.*
5. **P5 — Main tenue novice + finitions** : pas-à-pas « comment lire », cadrage novice, tests e2e « voir en tant que ».

---

## 9. Décisions clés (à valider)

| # | Décision | Recommandation |
|---|---|---|
| D1 | Surcharge **persistée** ou **éphémère** ? | ★ **Éphémère** (repart du profil) — cohérent avec « par défaut = mon niveau ». |
| D2 | Blocs avancés **cachés** ou **repliés** pour les novices ? | ★ **Repliés** (section « Détails avancés ») — honnêteté P1, novice curieux non bloqué. |
| D3 | Changer de vue **regénère-t-il** l'explication existante ? | ★ **Non automatique** : la vue re-rend les résultats instantanément ; l'explication existante garde son niveau (badge) + bouton « Regénérer en vue X » (1 crédit, explicite). |
| D4 | Périmètre backend v1 | ★ Surcharge audience (explication) + chat adaptatif + fallback par niveau. Le reste (regénérer, suggested questions) en P3/P4. |
| D5 | Libellés du switch | ★ Novice / Intermédiaire / Expert (i18n `profile.audience.*`), pas « Confirmé » (réservé aux Défis). |

## 10. Critères d'acceptation

- **[MUST]** À l'ouverture d'un résultat, tout s'affiche **au niveau du profil**. Un novice voit l'essentiel ; un expert voit tout.
- **[MUST]** Le sélecteur « Voir en tant que » change la vue **instantanément**, sans crédit ; sortir de son niveau affiche l'avertissement adéquat ; « Revenir à mon niveau » fonctionne.
- **[MUST]** Une explication générée en vue Novice emploie **analogies/métaphores** ; en vue Expert, la terminologie exacte. Le chat suit le niveau effectif.
- **[MUST]** Aucune donnée réelle supprimée (repliée seulement) ; tout repli LLM reste marqué « sans IA » (P2) ; température 0 (P4).
- **[MUST]** FR + EN complets ; aucun lien mort ; tokens du kit uniquement.
