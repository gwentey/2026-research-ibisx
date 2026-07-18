# 11 — Profil (`/profile`)

## Signature visuelle
**Une bannière-carte d'identité tonale (monogramme sur halo gradient + méta réelles en ligne) surplombe des onglets aérés composés en champs `Field`** — la seule page du parcours à adopter une logique « fiche compte », pédagogique sur le niveau d'expertise IA.
Mots-clés : bannière tonale, monogramme à halo, jauge de familiarité (1–5), champs `Field`, zone dangereuse encadrée.

## Disposition cible (wireframe ASCII)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [bannière tonale bg-gradient chart-2/10→transparent + motif points]     │
│                                                                           │
│   ┌────────┐   Pseudo ou prénom nom              [role.user ▢outline]  │
│   │ Avatar │   email@exemple.com                 [audience.novice ▢]   │
│   │ 64→72  │                                                            │
│   └────────┘   ┈┈┈┈┈┈┈┈┈┈┈┈┈┈ ItemGroup (3 stats réelles) ┈┈┈┈┈┈┈┈┈┈    │
│                 [CoinsIcon] N crédits │ [BrainIcon] Niveau IA 3/5 │      │
│                 [CalendarIcon] Membre depuis <created_at>                │
└─────────────────────────────────────────────────────────────────────────┘

┌─ Tabs (profile / security / preferences / credits) ─────────────────────┐
│  Profil ▏Sécurité ▏Préférences ▏Crédits                                 │
├───────────────────────────────────────────────────────────────────────┤
│  Card > FieldGroup                                                      │
│   Field(avatar) — miniature + bouton changer + aide                     │
│   FieldSeparator                                                        │
│   Field responsive : Pseudo | Prénom | Nom                              │
│                                                                           │
│  [onglet Préférences]                                                   │
│   Field responsive : Langue | Niveau d'études                           │
│   FieldSeparator « Adapter l'explicabilité »                            │
│   ExpertiseGauge (jauge 1-5 pédagogique, liée à xai_audience)           │
│   Field : sélecteur audience + FieldDescription = xaiAudienceHelp        │
│                                                                           │
│  [onglet Sécurité]                                                      │
│   Card mot de passe (Field courant/nouveau) — inchangé fonctionnellement │
│   Card destructive « Zone dangereuse » (bordure destructive, inchangée)  │
│                                                                           │
│  [onglet Crédits]                                                       │
│   Card avec grand compteur + texte d'aide (déjà présent, resté simple)  │
└───────────────────────────────────────────────────────────────────────┘
```

La bannière est un bloc à part (pas une `Card` classique) : `rounded-xl border bg-gradient-to-br from-primary/8 via-chart-2/8 to-transparent` avec motif SVG local en superposition `opacity-[0.04] text-foreground`. Elle ne réutilise PAS le header à tuile-icône du wizard (`bg-primary/10 rounded-xl` + icône lucide) — signature différenciée : ici le sujet est une **personne** (avatar), pas une **étape** (icône).

## Blocs template à reprendre
- `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/app/dashboard/(auth)/pages/profile/components/profile-card.tsx` lignes 12-23 (avatar centré + nom + badge de rôle inline) et lignes 24-37 (`bg-muted grid grid-cols-3 divide-x rounded-md border text-center *:py-3` — la grille 3 stats). À adapter : remplacer post/projects/members par **crédits / niveau IA / membre depuis** (données réelles uniquement), et passer d'un layout centré-carte à un layout bannière horizontale.
- `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/app/dashboard/(auth)/pages/profile/components/complete-your-profile.tsx` lignes 4-19 : pattern `Progress` + pourcentage à côté — inspire la jauge d'expertise (remplacer `%` par le libellé du palier `onboarding.familiarity.N`).
- `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/app/dashboard/(auth)/pages/settings/account/page.tsx` lignes 96-148 : montre le pattern `Form`/`FormField` de react-hook-form — **ne pas copier tel quel** (le v2 n'utilise pas react-hook-form ici, formulaires contrôlés simples), mais en retenir la structure `FormItem > FormLabel + Control + FormDescription` : c'est exactement ce que `Field/FieldLabel/FieldContent/FieldDescription` (déjà dans `apps/web/components/ui/field.tsx`, non utilisé actuellement) permettent de reproduire sans react-hook-form.
- `shadcn-ui-kit-dashboard-main/shadcn-ui-kit-dashboard-main/app/dashboard/(auth)/pages/settings/components/sidebar-nav.tsx` lignes 51-77 : pattern de nav à icônes lucide + état actif `bg-muted` — **non retenu comme layout** (on garde les `Tabs` horizontales pour préserver le contrat `?tab=` utilisé par `ibis-nav-user.tsx`), mais les icônes par section (UserIcon/ShieldIcon/PaletteIcon/CreditCardIcon) sont à reprendre sur les `TabsTrigger` existants pour renforcer la lisibilité.
- v1 `2025-research-exai/frontend/src/app/pages/profile/profile.component.html` lignes 21-167 : colonne gauche = carte identité + carte crédits + zone danger ; lignes 169-420 : colonne droite = formulaires. **Idée reprise** (pas le CSS) : la proximité visuelle immédiate entre identité/avatar et crédits/danger — traduite ici en bannière unique en tête de page plutôt qu'une colonne latérale (le contenu v2 est plus compact que v1, une colonne dédiée serait trop vide).

## Composants ibis à créer / modifier
- **Nouveau** `apps/web/components/ibis/profile/profile-header.tsx` : bannière identité (avatar + nom + email + badges rôle/audience + `ItemGroup` de 3 stats réelles). Reçoit `user: UserRead` + `avatarUrl`. Remplace le bloc `<div className="flex items-start justify-between...">` actuel de `apps/web/app/(app)/profile/page.tsx` lignes 32-38.
- **Nouveau** `apps/web/components/ibis/profile/expertise-gauge.tsx` : jauge pédagogique à 5 segments (`primary` rempli progressivement) affichant le palier `ai_familiarity`/`xai_audience` avec libellé du palier courant (réutilise `onboarding.familiarity.N` et `profile.audience.*`, déjà traduits). Insérée dans `preferences-tab.tsx` avant le `Select` d'audience, avec une `FieldDescription` = `profile.xaiAudienceHelp` (existant).
- `apps/web/components/ibis/profile/profile-tab.tsx` : remplacer `<Label>+<Input>` (lignes 92-123) par `Field/FieldLabel/FieldContent/FieldDescription` (import depuis `@/components/ui/field`), et le bloc avatar (lignes 72-90) par un `Field orientation="horizontal"` avec `FieldContent`.
- `apps/web/components/ibis/profile/preferences-tab.tsx` : même remplacement pour le `grid gap-6 sm:grid-cols-2` (lignes 74-138) → `FieldGroup` avec `Field` par sélecteur + insertion de l'`ExpertiseGauge`.
- `apps/web/components/ibis/profile/security-tab.tsx` : remplacer les `<Label>+<Input>` (lignes 93-115) par `Field`. La carte destructive (lignes 126-163, `border-destructive/40`) reste identique dans l'esprit — juste migrée en `Field` pour l'input email de confirmation du `Dialog`.
- `apps/web/app/(app)/profile/page.tsx` : insérer `<ProfileHeader user={user} />` avant les `Tabs` (remplace le `<div className="flex items-start justify-between...">` + le `<Badge variant="outline">{t(role.${user.role})}</Badge>` isolé, qui migre dans la bannière). **Garder** `TABS`, `searchParams.get("tab")` et les 4 `TabsTrigger` value tels quels (contrat avec `ibis-nav-user.tsx` → `/profile?tab=credits`).
- `apps/web/components/ibis/layout/ibis-nav-user.tsx` : aucune modification requise (le lien `?tab=credits` continue de fonctionner).

## Palette tonale & motifs (monochrome)
- Bannière : `bg-gradient-to-br from-primary/8 via-chart-2/8 to-transparent` (clair et sombre — opacités faibles, jamais de teinte saturée). Motif SVG local en surimpression : grille de points `opacity-[0.04]` en `text-foreground`, ou variante « lignes obliques » — un seul motif, réservé à cette page pour ne pas entrer en collision avec d'autres surfaces.
- Avatar : `ring-4 ring-background` + `shadow-sm` pour le détacher du fond dégradé ; fallback monogramme sur `bg-gradient-to-br from-primary/15 to-chart-2/15`.
- `ItemGroup`/`Item` des 3 stats : `ItemMedia variant="icon"` (icônes lucide `CoinsIcon`, `BrainIcon`/`SparklesIcon`, `CalendarIcon`) sur fond `bg-muted` neutre (déjà le défaut du composant, pas de couleur ajoutée).
- Badges rôle/audience : **variant `outline` ou `secondary` uniquement** — ne pas utiliser les variants `info`/`warning`/`success` de `badge.tsx` (lignes 17-25 : ils encodent du bleu/orange/vert en dur, hors charte monochrome du thème `default`).
- `ExpertiseGauge` : 5 segments, `bg-primary` pour les paliers atteints, `bg-primary/15` (ou `bg-border`) pour les paliers restants — pas de dégradé arc-en-ciel façon jauge de compétence classique.
- Zone dangereuse : conserve `border-destructive/40` + `text-destructive` (déjà en place, token du thème — autorisé, ce n'est pas un hex arbitraire).

## Données réelles utilisées (client généré, `UserRead`)
`email`, `pseudo`, `given_name`, `family_name`, `role` (`UserRole`), `credits`, `ai_familiarity` (0–5 ou null), `xai_audience` (`novice|intermediate|expert`), `education_level`, `locale`, `has_avatar`, `has_password`, `created_at`, `is_active`, `onboarding_completed`. Avatar binaire via `useAvatarUrl()` (`apps/web/components/ibis/use-avatar.ts`) + `userInitials(pseudo, email)`. Aucune donnée supplémentaire à inventer — « membre depuis » = `new Intl.DateTimeFormat(locale, {dateStyle:"long"}).format(new Date(user.created_at))`, formatage local, pas de clé i18n de valeur (seulement le libellé).

## Nouvelles clés i18n (fr — l'implémenteur ajoutera en)
```
profile.memberSince: "Membre depuis {date}"
profile.statCredits: "Crédits"
profile.statExpertise: "Niveau IA"
profile.expertiseTitle: "Votre niveau d'expertise"
profile.expertiseLevel: "Palier {level} sur 5"
```
Tout le reste est déjà couvert par les clés existantes : `profile.title/subtitle/tabProfile/tabSecurity/tabPreferences/tabCredits/pseudo/givenName/familyName/avatarHelp/changeAvatar/roleLabel/role.*/xaiAudienceHelp/audience.*/aiFamiliarity/educationLevel/creditsBalance/creditsHelp/dangerZone/deleteAccount/deleteWarning` et `onboarding.familiarity.1..5` (réutilisées pour les libellés de palier de la jauge — ne pas dupliquer). ~5 nouvelles clés.

## Risques (e2e, parité i18n, perfs) + parades
- **e2e** : `/profile` n'apparaît dans aucun sélecteur de `apps/web/e2e/mission.spec.ts` (vérifié — zéro occurrence) → risque nul sur le parcours mission. Seul point de couplage externe : `apps/web/components/ibis/layout/ibis-nav-user.tsx` lignes 84-91 navigue vers `/profile` et `/profile?tab=credits` — **garder** les 4 `value` des `TabsTrigger` (`profile/security/preferences/credits`) strictement identiques.
- **Parité i18n** : les 5 nouvelles clés doivent être ajoutées dans `messages/fr.json` ET `messages/en.json` (test vitest de parité) avant merge.
- **Perf/flash** : `useAvatarUrl()` est asynchrone (fetch blob) — la bannière doit prévoir un état de chargement du monogramme (le `AvatarFallback` s'affiche déjà pendant le fetch, pas de nouveau state nécessaire) pour éviter un saut de mise en page une fois l'avatar résolu.
- **Cohérence badges** : si un développeur réutilise par réflexe `variant="success"` pour `is_active`, ça romprait la charte monochrome — à signaler en review.

## Primitives ui manquantes à copier depuis la source template
Aucune. `Field`/`FieldGroup`/`FieldLabel`/`FieldContent`/`FieldDescription`/`FieldSeparator` (`apps/web/components/ui/field.tsx`) et `Item`/`ItemGroup`/`ItemMedia`/`ItemContent` (`apps/web/components/ui/item.tsx`) existent déjà dans `apps/web/components/ui/` — actuellement inutilisés dans le codebase (`grep` ne remonte que leur définition), cette page en devient le premier consommateur.
