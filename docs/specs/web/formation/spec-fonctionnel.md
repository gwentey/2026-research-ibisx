# Spec Fonctionnelle — web/formation [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | web/formation       |
| Version    | 0.1.0               |
| Date       | 2026-07-19          |
| Auteur     | retro-documenter    |
| Statut     | DRAFT               |
| Source     | Rétro-ingénierie    |

> **[DRAFT — à valider par le dev]** Cette spec a été générée par rétro-ingénierie
> à partir du code existant. Elle doit être relue et validée par un développeur
> qui connaît le contexte métier.

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [RETRO-021](../../../adr/RETRO-021.md) | Intégrité référentielle : les blocs "practice" ne citent que des Défis existants | Documenté (rétro) |

> *Table auto-générée par adr-linker. Ne pas éditer manuellement.*

---

## Contexte et objectif

Le module `web/formation` est l'Académie IA d'IBIS-X : une surface pédagogique structurée dont l'objectif déclaré est de casser le raccourci "IA = ChatGPT" en montrant aux apprenants la diversité des familles d'IA, le fonctionnement du machine learning, et les enjeux d'éthique et d'équité.

Le module est entièrement côté client (100 % front, aucun appel API). La progression est persistée dans `localStorage` sous la clé `ibis:formation`. Le pont avec la plateforme IBIS-X passe par les leçons "mise en pratique" qui redirigent vers de vrais Défis (enquêtes ML réelles de `web/challenges`).

L'académie est organisée en quatre cursus successifs (Éveil → Fondations → Praticien → Analyste), conférant cinq grades (Curieux → Éveillé → Apprenti → Praticien → Analyste). La Vague 1 livre les cursus Éveil (10 leçons) et Fondations (9 leçons) ; les cursus Praticien (15 leçons) et Analyste (11 leçons) sont déjà structurés dans le catalogue.

---

## Règles métier (déduites du code)

1. **Progression séquentielle des grades** : le grade de l'apprenant ne monte d'un cran que lorsque l'ensemble des leçons du cursus courant est terminé. Il est impossible de gagner le grade "Praticien" sans avoir achevé "Fondations", même si quelques leçons d'un cursus ultérieur ont été ouvertes.

2. **Complétion irréversible et idempotente** : terminer une leçon l'inscrit dans `lessonsDone`. Si la leçon est déjà présente, l'appel est sans effet. Aucun mécanisme de "marquer comme non-fait" n'est exposé à l'utilisateur.

3. **Fin de leçon conditionnelle au quiz** : les leçons comportant un bloc quiz ne peuvent être terminées (bouton "Terminer la leçon") qu'une fois la bonne réponse trouvée. Le réessai est libre et sans limite. Les leçons sans quiz se terminent sans condition.

4. **Leçons "mise en pratique" — conclusion par un Défi** : les leçons de type "mise en pratique" (bloc B8) ne présentent pas le bouton "Terminer la leçon" classique. La leçon se conclut en lançant le Défi associé : la progression est enregistrée *avant* la redirection, pour éviter qu'une interruption ne laisse la leçon en suspens.

5. **Verrou de cursus indicatif** : un cursus est présenté avec une indication visuelle "recommandé après…" si le cursus précédent n'est pas terminé. Ce verrou est purement indicatif — la navigation reste libre. L'UI oriente, elle ne bloque pas.

6. **Index de réponse hors i18n** : la bonne réponse à chaque quiz est stockée dans le catalogue TypeScript (`catalog.ts`, champ `answer: number`), jamais dans les fichiers de traduction. Cela empêche d'inspecter les fichiers i18n pour tricher.

7. **Notions gagnées sans doublons** : à la complétion d'une leçon, les cartes-notions de ses blocs `notion` sont ajoutées au deck personnel (`notionsOwned`) en utilisant un `Set`, ce qui garantit l'absence de doublons même en cas de re-complétion.

8. **Progression locale uniquement** : aucune synchronisation côté serveur. Vider le localStorage ou changer de navigateur remet la progression à zéro. Cette contrainte est explicite dans le code (`store.ts`, clé `ibis:formation`).

9. **Fingerprint du passeport** : le "code de progression" affiché sur le Passeport IA est un hash déterministe (Java-style : `h = h * 31 + charCode`) des slugs de leçons terminées (triés). Ce n'est pas un hash cryptographique : il vise la reproductibilité de la lecture, pas la sécurité.

10. **Intégrité référentielle formation → Défis** : tout bloc "practice" dans le catalogue doit référencer un slug de Défi présent dans `CHALLENGES` (`lib/challenges/catalog.ts`). Cette contrainte est vérifiée par `bridge.test.ts` et échoue la CI si un slug est mort.

---

## Cas d'usage (déduits)

### CU-001 — Parcourir l'académie et choisir un cursus

L'apprenant arrive sur `/formation`. Il voit sa progression globale (anneau, compteur leçons), son grade actuel, et les quatre cursus sous forme de cartes avec leur taux d'avancement individuel. Il peut accéder directement au glossaire ou au passeport. Le cursus verrouillé (non recommandé) est affiché avec un badge indicatif.

### CU-002 — Suivre une leçon de bout en bout

L'apprenant ouvre une leçon via `/formation/<cursus>/<lecon>`. Il lit les blocs dans l'ordre (mythe, explication visuelle, carte-notion, quiz). Si la leçon comporte un quiz, le bouton "Terminer" est grisé jusqu'à la bonne réponse. En cas d'erreur, la leçon affiche l'explication de la réponse et permet de réessayer. Une fois le quiz réussi, l'apprenant clique "Terminer" : la leçon est marquée complète, les notions sont ajoutées au deck, et l'apprenant est redirigé vers la leçon suivante (ou la page du cursus si c'était la dernière).

### CU-003 — Leçon "mise en pratique"

L'apprenant arrive sur une leçon de mise en pratique. Il voit le bouton "Lancer l'enquête" avec le titre du Défi cible. En cliquant, la leçon est marquée complète et l'apprenant est redirigé vers `/challenges/<slug>` pour faire le vrai Défi sur le vrai pipeline IBIS-X.

### CU-004 — Interagir avec un bac à sable (B3)

La leçon "La matrice de confusion" contient un bac à sable interactif : l'apprenant déplace un curseur de seuil (0.00–1.00) et observe en temps réel les changements dans la matrice 2×2 (VP, FP, VN, FN) et les métriques dérivées (précision, rappel, exactitude). Les données utilisées sont des points d'illustration, jamais des résultats réels. De même, "Le sur-apprentissage" propose un curseur de profondeur d'arbre affichant les courbes train/test d'une illustration.

### CU-005 — Consulter le glossaire

L'apprenant accède à `/formation/glossaire`. Il voit les 41 termes triés alphabétiquement, avec terme, définition et exemple. Un champ de recherche filtre en temps réel par terme ou définition. Chaque fiche porte un lien "En savoir plus" menant à la leçon qui a introduit ce terme.

### CU-006 — Consulter le Passeport IA

L'apprenant accède à `/formation/passeport`. Il voit son grade, son taux global, sa progression par cursus (coché/non-coché), et la liste de ses badges de compétence (gagnés ou verrouillés). Un code de progression (fingerprint) est affiché. Un bouton "Imprimer" déclenche `window.print()` — les éléments de navigation sont masqués via `print:hidden`.

### CU-007 — Survol contextuel d'un terme (GlossaryTerm)

Depuis n'importe quelle page de l'application utilisant le composant `<GlossaryTerm>`, l'apprenant survole un terme souligné en pointillé et voit une infobulle (HoverCard) avec le terme, sa définition, et un lien vers la leçon qui l'enseigne.

---

## Dépendances

- `web/challenges` — catalogue des Défis, source de vérité pour les slugs référencés par les blocs "practice" (vérifié par `bridge.test.ts`)
- `lib/datasets/domain-visuals` — icônes et couleurs de vignette par domaine (réutilisé depuis `web/datasets`)
- `components/ibis/progress-ring` — anneau de progression SVG (réutilisé depuis d'autres features)
- `components/ui/*` (shadcn/ui) — Card, Button, Badge, Input, Slider, HoverCard
- `next-intl` — traductions FR/EN (`messages/fr.json`, `messages/en.json`, espace `formation.*`)
- `zustand` + `persist` — state management avec persistence localStorage

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Calendrier des vagues** : les cursus Praticien et Analyste sont entièrement structurés dans le catalogue mais non reliés à des traductions complètes (potentiellement). La date de livraison effective de la Vague 2 n'est pas dans le code.
- **Certification** : la page Passeport affiche un état "certifié" (grade Praticien ou supérieur) mais aucune logique d'envoi d'email ou de génération de PDF n'est visible. L'impression via `window.print()` semble être la seule forme d'export envisagée.
- **Synchronisation multi-appareils** : la progression est purement locale. Si l'utilisateur accède depuis deux appareils, les progressions sont indépendantes. Le code ne contient aucun TODO sur une future synchronisation.
- **Blocs B6, B9, B10** : les types `translator`, `tutor`, `ia_vs_you` sont définis dans les types mais aucun composant correspondant n'est implémenté (renvoyés `null` dans le switch). La date de livraison n'est pas indiquée.
