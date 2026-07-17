# Démo IBIS-X en 20 minutes — persona « enseignant » (CDC §12.5)

**Contexte joué** : Mme Diallo, enseignante de mathématiques, veut comprendre quels facteurs
prédisent la réussite de ses élèves — sans rien connaître au Machine Learning.

**Prérequis** (machine vierge, ~5 min avant la séance) :

```bash
cp .env.example .env        # générer JWT_SECRET ; renseigner INITIAL_ADMIN_EMAIL/PASSWORD
docker compose up -d
docker compose exec api ibis seed
```

Aucune clé externe n'est nécessaire : sans `OPENROUTER_API_KEY`, les textes IA passent en
repli déterministe **explicitement marqué** (« Généré sans IA ») — l'intégralité du parcours
fonctionne.

---

## Minute 0–2 — Landing et inscription

1. Ouvrir http://localhost:3000 → landing (promesse : « du dataset à l'explication »).
2. « Créer un compte » → email/mot de passe → **onboarding en 3 questions**
   (niveau d'études, âge, aisance IA 1–5). Montrer que la réponse à la 3ᵉ question
   pilotera plus tard le niveau de langage des explications.

## Minute 2–5 — Catalogue et éthique

3. Menu **Datasets** : 6 datasets réels (Iris, Student Performance, Titanic…).
4. Ouvrir **Student Performance (Math)** : 4 onglets. Insister sur l'onglet éthique :
   critères **tristate honnêtes** (vrai / faux / non renseigné — jamais inventés, P1).
5. Filtres : score éthique minimum, tâche « classification », valeurs manquantes.

## Minute 5–8 — Projet et recommandations

6. **Projets → Nouveau projet** : « Réussite de mes élèves », domaine éducation,
   pondérations profil « équilibré ». L'aperçu des recommandations se met à jour en direct.
7. Créer → page projet : datasets classés par **score pondéré décomposé** (heatmap
   disponible). Student Performance arrive en tête — expliquer pourquoi (poids × critères).

## Minute 8–14 — Entraînement guidé (9 étapes)

8. « Lancer un entraînement » sur Student Performance → **wizard 9 étapes** :
   - É1 aperçu (encart pédagogique « qu'est-ce qu'un dataset ? ») ;
   - É2 cible `G3` (suggérée) → tâche **régression** (recommandation expliquée) ;
   - É3 nettoyage : stratégies par colonne recommandées (médiane/mode) — montrer qu'on peut
     désactiver (le choix est **réellement appliqué**, contrat `applied` — anti-T1) ;
   - É4 split 80/20 stratifié, É5 normalisation, É6 arbre de décision (« explicabilité
     maximale »), É7 preset Équilibré ;
   - É8 récapitulatif → coût 1 crédit → **console temps réel** (SSE) : file, progression,
     logs du worker.
9. ~1 s plus tard : **résultats** — R², MAE, graphes (prédictions vs réel, résidus,
   importance des variables, arbre lisible). Encart « transformations réellement appliquées ».

## Minute 14–19 — Explicabilité et chat

10. Onglet **Explicabilité** → « Générer l'explication » (SHAP global automatique, justifié).
11. Montrer les **KPI de fiabilité** (complétude SHAP vérifiée, stabilité seeds 42–46,
    parcimonie) — tous **mesurés**, jamais des placeholders (anti-X1/X2).
12. Texte adaptatif : niveau « débutant » car aisance 2/5 à l'onboarding (badge du niveau).
    Sans clé LLM : badge « Généré sans IA (repli déterministe) » — l'honnêteté EST la démo.
13. **Chat** : « Quelle variable compte le plus ? » → réponse ancrée sur les vraies valeurs.

## Minute 19–20 — Dashboard et clôture

14. **Dashboard** : KPIs réels (1 expérience, taux de réussite 100 %, durée moyenne),
    activité récente, reprise de brouillon.
15. (Si temps) Compte admin : gestion des utilisateurs, recharge de crédits, templates
    éthiques par domaine, supervision des jobs.

---

**Plan B hors-ligne complet** : tout est local (Docker) — aucune dépendance réseau pendant la démo.
**Réinitialisation entre deux séances** : `docker compose down -v && docker compose up -d && docker compose exec api ibis seed`.
