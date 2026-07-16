# Rétro-ingénierie — Documentation / PRD / mémoire (IBIS-X)

⚠️ Deux couches de vérité : docs fondateurs 2025 auto-élogieux (métriques N=75, benchmarks partiellement fictifs) VS cahier des charges refonte juillet 2026 (audit 78 constats) qui les démonte.

## Mission
- Projet recherche M2 MIAGE Paris 1 Panthéon-Sorbonne, dir. Nourhène Ben Rabah, soutenu 22/09/2025. EXAI = nom recherche, IBIS-X = nom produit. Domaine initial : éducation.
- Problème : ML inaccessible aux non-experts sur 3 maillons disjoints → pipeline intégré : (1) sélection datasets critères techniques+éthiques, (2) pipeline ML guidé classif/régression, (3) XAI adaptative au profil.
- QR2 : guider un non-expert dans l'analyse ML. QR3 : recommander la méthode XAI selon modèle/données/besoins. QR1 (implicite) : sélection datasets.
- Public : non-spécialistes. Personas refonte : Étudiant·e (primaire, master/doctorat hors info), Chercheur·se (biais/éthique, reproductibilité), Enseignant·e (TD, parcours démontrable, zéro donnée fictive).
- Parcours mission linéaire : 1 PROJET → 2 DATASET → 3 ENTRAÎNEMENT → 4 EXPLICATION.

## Fondement scientifique
Khelifi, Tesnim, Nourhène Ben Rabah, Bénédicte Le Grand. "A Comprehensive Review of Educational Datasets: A Systematic Mapping Study (2022-2023)." Procedia Computer Science 246 (2024): 1780-1789. Taxonomie 26 critères / 3 catégories. IBIS-X = première opérationnalisation technique en scoring quantitatif.
Théorie Charge Cognitive (Sweller 1988) pour l'adaptation des explications.

## Critères (voir rapport service-selection pour formules)
10 éthiques : informed_consent, transparency, user_control, equity_non_discrimination, security_measures_in_place, data_quality_documented, anonymization_applied, record_keeping_policy_exists, purpose_limitation_respected, accountability_defined. Score = Σ/10.
Techniques : documentation 30% (metadata 0.15 + external doc 0.15), qualité 40% (manquants 0.2 + split 0.2), taille/richesse 30% (instances log 0.15 + features optimal 10-100 0.15). Normalisation dynamique sur champs dispo.
Popularité : min(1, log10(citations)/3). Nouveauté : (année-2000)/24.
Score final = Σ(score×poids)/Σ(poids). Défauts : éthique 0.4 / technique 0.4 / popularité 0.2.
Profils prédéfinis documentés : academic_research, industrial_application, rapid_prototyping.
⚠️ Audit P2 : 3 implémentations divergentes du scoring → source unique backend criterion_scores.

## 9 étapes documentées (mémoire, démonstration validée)
1 Aperçu du Dataset (contextualisation pédagogique, score qualité) / 2 Objectif de Prédiction (cible + IA classif vs régression) / 3 Nettoyage (multi-colonnes, score qualité 100) / 4 Division (stratifiée 80/20) / 5 Préparation Finale (StandardScaler/MinMax/Robust + One-Hot) / 6 Sélection Algorithme (DT vs RF + reco) / 7 Hyperparamètres (presets Équilibré/Haute précision/Rapide) / 8 Entraînement (4 phases 25% chacune, logs horodatés) / 9 Résultats (dashboard : score composite, F1-Macro, OOB, Accuracy).
Version doc technique : 1 Dataset Overview / 2 Data Configuration / 3 Data Cleaning / 4 Algorithm Selection / 5 Hyperparameters / 6-7 Hidden / 8 Summary / 9 Training Console. Refonte interne : 6 étapes.
Métrique principale : classif → F1-macro ; régression → MAE.

## KPI XAI documentés (objectifs, PAS implémentés)
- Complétude : axiome efficience SHAP Σφᵢ + E[f(X)] = f(x), respecté si erreur <1%.
- Stabilité/cohérence : corrélation explications instances similaires/perturbations.
- Robustesse. Fidélité : loss approximation locale LIME.
- Par profil : novice → interpretability/actionability/understandability (pénalité >10 features) ; expert → theoretical_soundness, computational_efficiency, method_appropriateness.
- Score global explication : technique 40% + UX 40% + domaine 20%.
- Reproductibilité P4 : 2 exécutions → SHAP identiques (random_state=42 partout, temp LLM 0).
- Adaptation audience : novice (analogies, 100 mots), intermédiaire (business, 200), expert (axiomes, 300). audience_level × ai_familiarity.
- Sélection auto : arbre → TreeExplainer (30-320× plus rapide), sinon LIME/Kernel.

## Audit consolidé (juillet 2026) — 78 constats dont 28 critiques
3 maux systémiques : contrats front/back désalignés ; substitution silencieuse de données fictives ; duplication non maîtrisée.
Critiques : T1 config nettoyage ignorée à l'entraînement ; T2 3/5 stratégies crashent ; T3 scaling toujours appliqué ; T6 entraînement silencieux sur données synthétiques ; T8 IA recommande algos non entraînables ; X1 dashboard XAI 100% fictif ; X2 « SHAP » = importances relabellisées ; X3 WebSHAP = Math.random ; X4 SHAP non déterministe ; X9 chatbot bloquant 60s ; P1 assistant IA = setTimeout + texte en dur ; P2 3 scorings ; S1/S2 endpoints admin/PUT/DELETE sans contrôle rôle ; S4 import Kaggle return False ; S7 clé OpenAI versionnée dans git ; S9 0% couverture tests.
Dette : main.py 7900 l. (service-selection tout compris), wizard 4301 l., experiment-results 5868 l., 1558 !important, 2 design systems, 4 vocabulaires nettoyage, 3 services LLM.

## Refonte 2026 (branche refonte/phase-1-fiabilite)
Phase 1 Fiabilité 100% (nettoyage v2 appliqué, fin données inventées, SHAP seedé, chat async, couche IA commune OpenRouter). Phase 2 Design system 100% (tokens IX, purge Spike). Phase 3 Parcours ~70% (reste : wizard 6 étapes + WizardStateService, page résultats 4 onglets, catalogue+fiche). Phase 4 Qualité ~60% (reste : i18n exhaustif, tests intégration, e2e déterminisme SHAP, découpage monolithe).
Décisions D1-D6 : fiabilité d'abord ; dashboard XAI supprimé/fusionné ; i18n FR/EN zéro texte en dur ; vraie IA + fallback signalé ; algos restreints aux entraînables ; esthétique Apple-like.
7 principes : P1 jamais de donnée inventée non signalée · P2 IA honnête (is_fallback, model_used) · P3 une seule source de vérité · P4 reproductibilité · P5 l'utilisateur sait toujours où il est · P6 un seul langage graphique · P7 maintenable par un seul dev (composants ≤400 l.).
Design tokens : primaire bleu encre #2540A6 (Sorbonne), ambre = précaution/IA, Inter / IBM Plex Mono, spacing 4px, motion 150/240/360ms.

## Pourquoi microservices/minikube (abandonné)
Séparation responsabilités, scalabilité indépendante, workers GPU séparés ; Docker Compose écarté (« moins représentatif »). Constat : microservices = cause de désynchronisation front/back et duplication. Minikube plafonné 7,57 GB RAM, OOMKilled récurrents sur XAI. Prod Azure AKS + ACR + cert-manager.

## Roadmap jamais réalisée
Counterfactuals, export PDF, multilingue ES/DE/IT, XAI deep learning, comparaison multi-modèles, API publique, AutoML sélection XAI.

## Fichiers de référence
docs/cahier-des-charges/00-vision-et-mission.md, 01-audit-consolide.md, 02-specifications-fonctionnelles.md, 04-design-system.md, 06-suivi-des-evolutions.md ; memoire/README_Module_Selection_Datasets.md, CORRECTION_Scoring_Formules.md, ML_Pipeline_Documentation_Complete.md, README_Systeme_Recommandation_XAI.md.
