# Rétro-ingénierie — Frontend Angular (IBIS-X)

Angular 19 standalone + Angular Material 19, template Spike (thème sorbonne), ECharts 5.6 (heatmap, arbre), i18n FR/EN ngx-translate (fr.json 130Ko), JWT localStorage (ibis_x_access_token) + interceptor, polling partout (pas de WS/SSE), MatSnackBar.

## Routes
- '' landing publique (vidéo YouTube, boutons non câblés)
- ml-pipeline-wizard (plein écran, authGuard+onboardingGuard, queryParams datasetId/datasetName/projectId)
- app/starter (dashboard : 4 KPI — Total Expériences, Projets Actifs, Taux Succès %, Temps Moyen Entraînement ; activités récentes ; tutoriels vidéo ; actions rapides ; projets récents ; statut système)
- app/datasets (listing), /upload, /upload/wizard, /:id (détail), /:id/complete-metadata
- app/projects, /new, /:id, /:id/edit
- app/ml-pipeline (présentation), /dashboard, /experiment/:id (résultats), /experiments (liste)
- app/profile, /profile/credits-refill
- app/admin (+/datasets, /users, /ethical-templates) [adminGuard]
- app/analytics, app/documentation/user-guide, /technical-docs
- authentication/login, /register, /callback (OAuth), /error
- onboarding (4 étapes : education_level requis, age 13-120, ai_familiarity 1-5 ; garde bloquante)
Gardes : authGuard, nonAuthGuard, onboardingGuard, adminGuard/roleGuard, uploadGuard.

## Listing datasets
Grille de cartes + toggle grille/liste. Toolbar : recherche debounce 300ms (dataset_name), bouton Filtres (badge count) → MODALE, tri (7 options), refresh. Chips filtres actifs supprimables + Tout effacer. mat-paginator pageSize 24 [12,24,48,96]. 100% backend. Compteur aperçu temps réel (page_size:1). Carte : display_name, année, citations, badge accès, badge Éthique %, badge Représentativité, instances, % manquant, indicateurs Split/Anonyme/Temporel, tags domaines/tâches +N, Voir / Sélectionner (→ wizard) / Favori (TODO).

## Filtres UI (modale, 3 groupes)
- Catégories : domaines (grille cartes cliquables), tâches (mat-select multiple)
- Numérique : instances (double range-slider), features (2 inputs number), année (2 inputs)
- Qualité : cartes toggle is_split / is_anonymized / has_temporal_factors / is_public, score éthique min (number %), representativity_level (prévu)
⚠️ 2e implémentation dataset-filters.component plus riche non utilisée (redondance). Modèle inclut 10 filtres éthiques booléens non exposés en UI.

## Détail dataset (4 onglets)
Header Stripe-like + Alertes Qualité. 1. Vue d'ensemble : stats, infos générales, Conformité Éthique (grille check/cancel), score complétude manquants, Métriques Qualité (progress bars, badge « estimée » si simulé), similaires. 2. Fichiers & Structure : liste fichiers, table colonnes (position, nom, icône type, PII, PK, type, nullable, exemples chips). 3. Aperçu : bannière si is_fallback, table 50 lignes, stats/colonne. 4. Guide IA (async polling 2s).

## Scoring (dans formulaire projet)
Étape 3 : sliders 0-1 step 0.1 par critère : ethical_score (0.4), technical_score (0.4), popularity_score (0.2), anonymization (0), documentation (0), data_quality (0). % normalisé affiché. Reset défauts. Top 3 panneau latéral (rang, score coloré, tooltip décomposition criterion_scores backend). Heatmap ECharts comparaison multi-critères. previewRecommendations debounce 500ms → POST /datasets/score.

## Projets
Liste : cartes, recherche, FAB +, paginator [6,12,24,48]. Form : stepper vertical 3 étapes (Infos name/description ; Critères domain/task multiselect + plages + score éthique min select 30/50/70/90% + checkboxes ; Pondérations) + ui-mission-stepper (fil : Projet→Dataset→Entraînement→Explication) + aperçu temps réel. Détail : 2 onglets (Résumé : config, stats reco, Top 3 ; Toutes les recommandations : liste/heatmap toggle, Voir/Utiliser → wizard ML).

## Wizard ML : 9 étapes UI (stepTitles)
1 Sélection du Dataset / 2 Définition de l'Objectif (colonne cible auto-suggérée, tâche classif/régression, IA) / 3 Nettoyage (analyse qualité, tableau par colonne, stratégies 8 canoniques, validation bloquante >30% manquants, Appliquer recommandations) / 4 Division (testSize slider 10-50% déf 20, random_state 42, auto-validée) / 5 Préparation Finale (scaling toggle+méthode standard/minmax/robust, encodage onehot/ordinal, outliers iqr/zscore, auto-validée) / 6 Choix Algorithme (cartes via GET /algorithms : decision_tree, random_forest) / 7 Hyperparamètres (formulaire dynamique number/select/boolean min/max/défaut, assistant IA) / 8 Entraînement (récap + checkbox confirmation + crédits, startTraining) / 9 Résultats (console logs).
Store WizardStateService (signals, 6 étapes logiques vs 9 visuelles). Polling 1500ms GET /experiments/:id (status+progress). Détection file : progress 0% >60s → overlay queue_position. completed → GET results. Monolithe 4078 lignes.

## Résultats expérience (2 onglets)
Général : anneau SVG score global, grille métriques (classif : accuracy, precision, recall, f1, roc_auc, pr_auc, macros, confusion, report ; régression : mae, mse, rmse, r2), explication pédagogique, visualisations (arbre ECharts interactif app-real-tree-visualization ; confusion/ROC/PR/importance/regression = PNG backend <img>), guide d'interprétation, recommandations, Télécharger modèle .joblib, Export PDF, Nouvelle Expérience.
XAI : résumé contextuel (algo, dataset, niveau novice/intermediate/expert dérivé ai_familiarity), insights, questions suggérées, app-xai-explanation-request (Générer Explication IA), app-xai-explanation-results (texte adapté niveau + badges méthode/type + viz + temps), app-xai-chat-interface (5 questions max).
Modèles XAI : types global/local/feature_importance, méthodes shap/lime/auto, FeatureImportance{name,value,rank}, SHAPExplanationData, XAIDashboardStats (KPI définis mais dashboard mock supprimé).

## Auth front
Login : Google OAuth + email/password + remember me. Register : SignupData (+ onboarding fields). auth.service : login form-urlencoded, register, users/me CRUD, claim-credits. Rôles admin/contributor/user, menu admin dynamique. Profil : avatar upload, crédits + recharge, changement mdp, suppression compte (dialog confirmation email).

## Layout
Sidebar (logo, sections Navigation / Data & Analysis (Datasets, Projects, ML Pipeline) / Documentation / Administration si admin), collapsible. Topbar : toggle, recherche globale Ctrl+K, langue FR/EN drapeaux, cloche notifications (activités récentes), menu profil. Breadcrumb. FAB « Ajouter dataset ». PAS de dark mode exposé. Vestiges Spike : drawer Apps Calendar/Chat/Email non fonctionnels.

## Annexes
Analytics (période, métriques usage, cartes graphes). Admin ethical-templates (config défauts éthiques par domaine). Crédits (indicator, refill, claim périodique). Upload wizard : drag-drop → analyse → formulaire métadonnées. Composants ui-* partagés (badge, card, confirm-dialog, kpi-tile, mission-stepper, page-header, score-bar, states).

## Appels REST front (réels)
auth : /auth/jwt/login, /auth/google/*, /auth/register, /users/me*, claim-credits.
datasets : GET /datasets (+filtres), /:id, /:id/details, /stats, /domains, /tasks, /:id/preview, /:id/quality, /:id/distribution, /:id/similar, metadata completion ×3, missing-data-analysis, POST /datasets/preview, POST /datasets, POST /datasets/score.
projects : CRUD + /:id/recommendations.
ml-pipeline (/api/v1/ml-pipeline) : POST/GET experiments, results, algorithms, data-quality/analyze, suggest-strategy, cleaning/validate, ai-analysis ×3 + polling, download-model.
xai (/api/v1/xai) : POST /explanations, GET /:id (poll 2s), results, liste, chat (create, ask, tasks/:id poll 1.5s, messages), metrics/user.
admin : ethical-templates CRUD+, users, users/count.

## Points refonte
- 2 systèmes de filtres ; wizard monolithe ; 9 visuelles vs 6 logiques.
- Vestiges template ; favoris TODO ; /settings /help sans routes.
- Tout en polling → SSE/WS candidat.
- Viz = PNG backend → composants natifs à re-décider.
- Dark mode absent ; i18n FR/EN à garder ; onboarding obligatoire ; crédits transverses.
