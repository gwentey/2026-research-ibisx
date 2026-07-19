# Spec Fonctionnelle — web/challenges [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | web/challenges      |
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

Aucun ADR RETRO créé pour cette feature — tous les candidats identifiés ont été rejetés par la politique ADR v2.3.0. Voir la section « Candidats ADR rejetés » dans la spec technique.

---

## Contexte et objectif

Le module `web/challenges` (appelé « Défis » dans l'interface) est une couche de gamification pédagogique greffée sur le produit réel IBIS-X. Il ne crée pas de nouvelles entités backend : il orchestre les surfaces déjà existantes (catalogue datasets, wizard ML, pages de résultats, copilote XAI) sous forme de missions guidées appelées « enquêtes ».

L'objectif est de permettre à un utilisateur novice de traverser un pipeline ML complet (ouverture d'un dataset → création d'un projet → entraînement → lecture des résultats → génération d'une explication) sans se perdre dans le produit, en maintenant un contexte narratif (une enquête réelle) tout au long du parcours.

---

## Règles métier (déduites du code)

1. **Chaque enquête est adossée à un dataset réellement seedé.** Le champ `datasetSlug` d'un défi doit correspondre au `dataset_name` d'un dataset présent dans `apps/api/seed_data/datasets.yaml`. Un test Vitest verrouille cette contrainte.

2. **Un défi a au moins 3 objectifs et inclut toujours `read_results`.** La liste `objectives` de chaque défi est définie statiquement dans le catalogue — elle ne peut pas être modifiée à l'exécution.

3. **Un objectif ne se coche que sur une vraie transition de l'application** (navigation vers une route réelle du produit, ou présence d'une explication complétée en base). Il ne peut jamais être coché manuellement par l'utilisateur, ni déclenché par un événement synthétique.

4. **La progression est persistée en localStorage uniquement, jamais côté serveur.** La clé de stockage est `ibis:challenges`. Le tableau `completed` (slugs de défis terminés) survit entre les sessions ; `activeSlug` et `done` portent le défi en cours entre les navigations.

5. **Le traceur de quête est réhydraté via le paramètre d'URL `?challenge=<slug>`.** Quand l'utilisateur quitte le groupe de routes `(app)` pour aller dans le wizard (qui vit sous une route racine distincte), le slug du défi actif est transmis dans l'URL pour que le traceur survive à la navigation inter-groupe.

6. **`markObjective` est idempotent.** Cocher un objectif déjà coché ne produit aucun effet. Un défi est marqué « complété » au moment où le dernier de ses objectifs est coché — cette opération n'est pas réversible dans la session courante.

7. **`quit` désactive le défi actif sans effacer le tableau des complétions.** L'historique des défis terminés est permanent (localStorage) ; seul le défi en cours est abandonné.

8. **Démarrer un nouveau défi réinitialise les objectifs en cours et redéploie le traceur replié.** Un repli hérité d'un défi précédent ne peut pas masquer le nouveau parcours.

9. **Le niveau d'un défi pilote l'audience XAI.** La constante `XAI_AUDIENCE_BY_LEVEL` établit le mapping : novice → novice, débutant → intermediate, confirmé → expert. Ce niveau est passé au copilote XAI lors de la génération d'explications dans le contexte d'un défi.

10. **Le coaching textuel n'est affiché qu'au niveau novice.** Les micro-consignes de coach dans le traceur ne s'affichent que si `challenge.level === "novice"`, qu'un objectif reste à faire, et qu'une clé i18n de type `items.<slug>.coach.<location>` existe pour la page courante.

11. **L'objectif `generate_explanation` n'est coché que lorsqu'une explication réelle (status `completed`) existe en base.** Le composant `ChallengeDebrief` interroge périodiquement (toutes les 4 s) l'API `listExplanations` jusqu'à trouver une explication complétée, puis coche l'objectif.

12. **Le débrief ne s'affiche que si l'expérience réussie appartient au défi actif.** L'appartenance est vérifiée en résolvant l'UUID du dataset du défi et en le comparant au `dataset_id` de l'expérience.

13. **La progression globale (anneau de progression sur la page `/challenges`) est masquée côté serveur.** Elle n'est rendue qu'après hydratation côté client pour éviter un mismatch entre rendu serveur et rendu client (localStorage non accessible en SSR).

14. **L'entrée dans le parcours dépose l'utilisateur à un point précis selon le mode d'entrée.** Mode `dataset` : navigation vers `/datasets/<id>?challenge=<slug>`. Mode `project_direct` : navigation vers `/projects/new?datasetId=<id>&datasetName=<slug>&name=<titre_encodé>&challenge=<slug>` avec le nom de projet pré-rempli pour éviter que le bouton « Créer et lancer » reste désactivé (champ requis).

---

## Cas d'usage (déduits)

### CU-001 — Parcourir la bibliothèque de défis

L'utilisateur accède à `/challenges`. Il voit les défis regroupés par niveau (novice, débutant, confirmé), chaque défi affiché sous forme de carte avec son titre, accroche, type de tâche ML, pastille de niveau, et statut (à relever / relevé). Un anneau de progression global affiche le pourcentage de défis terminés.

### CU-002 — Lire le briefing d'une enquête

L'utilisateur clique sur une carte de défi. Il arrive sur `/challenges/<slug>` qui affiche : le titre et accroche, la narration de l'enquête (contexte et enjeux), la liste numérotée des objectifs à accomplir, la récompense attendue, et le bouton « Démarrer ». L'UUID du dataset est pré-résolu en arrière-plan dès le chargement.

### CU-003 — Démarrer une enquête et naviguer dans le produit

L'utilisateur clique « Démarrer ». Le store est activé (`start(slug)`), puis l'utilisateur est redirigé vers la fiche du dataset (mode `dataset`) ou la page de création de projet (mode `project_direct`). Le traceur de quête apparaît en bas de toutes les pages de l'application et affiche le titre du défi, l'objectif en cours, et la progression par pips.

### CU-004 — Valider des objectifs automatiquement

Le traceur coche les objectifs au fil des navigations réelles : ouverture d'une fiche dataset → `open_dataset`, arrivée sur le wizard → `create_project`, arrivée sur une page de résultats → `launch_training` + `read_results`. L'objectif `generate_explanation` est coché dès qu'une explication de status `completed` est détectée via polling.

### CU-005 — Replier et déployer le traceur

L'utilisateur peut replier le traceur en cliquant sur la flèche. Une pastille compacte reste visible au centre-bas de l'écran avec le titre du défi et le pourcentage. L'utilisateur peut redéployer le traceur depuis la pastille. Ceci n'affecte pas la progression.

### CU-006 — Voir le débrief sur la page de résultats

Quand l'utilisateur arrive sur la page de résultats d'une expérience réussie appartenant au défi actif, un encart `ChallengeDebrief` s'affiche en haut de la page. Il affiche la métrique principale réelle du modèle, un texte d'encouragement contextualisé par niveau, et un CTA vers l'explication XAI si `generate_explanation` est encore à faire. Un bouton « Défi suivant » propose un défi non encore terminé.

### CU-007 — Abandonner une enquête

L'utilisateur clique « Quitter » dans le traceur. Le défi actif est désactivé, les objectifs en cours sont effacés, mais les défis déjà complétés restent dans le localStorage. Le traceur disparaît.

---

## Dépendances

- **`lib/datasets/domain-visuals`** — langage visuel par domaine (couleur de vignette, icône, motif SVG), partagé avec `web/datasets`.
- **`lib/api/generated`** — client TypeScript généré depuis l'OpenAPI : `listDatasets` (résolution UUID), `listExplanations` (vérification objectif XAI).
- **`components/ibis/datasets/domain-pattern`** — composant de motif SVG tonal, partagé avec `web/datasets`.
- **`components/ibis/progress-ring`** — anneau de progression SVG, utilisé sur la page catalogue.
- **`(app)/experiments/[id]/page.tsx`** — consomme `ChallengeDebrief`, intègre `QuestTracker`.
- **`app/wizard/page.tsx`** — intègre `QuestTracker` hors du groupe `(app)`.
- **`(app)/layout.tsx`** — intègre `QuestTracker` pour toutes les routes du groupe `(app)`.
- **`next-intl`** — tous les textes narratifs (titres, briefings, objectifs, coach) vivent dans les messages i18n `challenges.*`.

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- Le CDC référencé dans les commentaires (`docs/parcours/CAHIER-DES-CHARGES.md`) n'a pas été lu — il peut contenir des règles métier supplémentaires non implémentées.
- La clé i18n `challenges.items.<slug>.coach.<location>` est vérifiée par `t.has()` avant affichage : il n'est pas possible de déterminer depuis le code seul quels défis novices ont des coach hints pour quelles pages.
- La logique de « défi suivant » dans `ChallengeDebrief` sélectionne le premier défi non terminé toutes catégories confondues (pas le suivant dans le même niveau) : cette règle métier demanderait confirmation.
- Il n'existe pas de mécanisme de reset de progression exposé à l'utilisateur. C'est intentionnel ou une dette ?
- Le catalogue contient 12 missions mais discovery.md en mentionne « 6 enquêtes réelles » (commentaire initial dans `catalog.ts`). La distinction entre les 6 missions du premier livrable et les 4+2 missions ajoutées ensuite n'est pas formalisée dans les règles produit.
