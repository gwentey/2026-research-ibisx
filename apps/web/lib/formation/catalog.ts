import type { Cursus } from "./types";

export { XAI_AUDIENCE_BY_LEVEL, GRADE_ORDER } from "./types";

// Catalogue de l'académie — VAGUE 1 : cursus « Éveil » (0) + « Fondations » (1).
// STRUCTURE UNIQUEMENT : tout le texte (titres, mythes, explications, quiz, notions) vit dans
// l'i18n `formation.*` (fr.json / en.json), jamais ici (P3). Les blocs "practice" pointent vers
// un Défi RÉELLEMENT présent dans lib/challenges/catalog.ts (P5, vérifié par bridge.test.ts).
//
// Convention de clés i18n :
//  - leçon  : formation.lessons.<lessonSlug>.{title, summary, <blockId>...}
//  - notion : formation.notions.<notionId>.{term, definition, example}
//  - module : formation.modules.<moduleSlug>.{title, tagline}
//  - cursus : formation.cursus.<cursusSlug>.{title, tagline, subtitle}

export const CURSUS: Cursus[] = [
  {
    slug: "eveil",
    level: "novice",
    grade: "eveille",
    domain: "research",
    order: 0,
    modules: [
      {
        slug: "ia-pas-que-chatgpt",
        lessons: [
          {
            slug: "le-grand-malentendu",
            blocks: [
              { type: "myth", id: "myth" },
              { type: "visual", id: "visual" },
              { type: "notion", id: "ia-generative-vs-predictive", notion: "ia-generative-vs-predictive" },
              { type: "quiz", id: "quiz", answer: 1, choices: 3 }
            ]
          },
          {
            slug: "chatgpt-demystifie",
            blocks: [
              { type: "myth", id: "myth" },
              { type: "visual", id: "visual" },
              { type: "notion", id: "llm-predicteur", notion: "llm-predicteur" },
              { type: "quiz", id: "quiz", answer: 2, choices: 3 }
            ]
          },
          {
            slug: "lia-predictive",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "ia-predictive", notion: "ia-predictive" },
              { type: "quiz", id: "quiz", answer: 0, choices: 3 }
            ]
          },
          {
            slug: "la-carte-des-ia",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "familles-ia", notion: "familles-ia" },
              { type: "quiz", id: "quiz", answer: 1, choices: 3 }
            ]
          }
        ]
      },
      {
        slug: "comment-une-machine-apprend",
        lessons: [
          {
            slug: "apprendre-par-lexemple",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "apprentissage-supervise", notion: "apprentissage-supervise" },
              { type: "quiz", id: "quiz", answer: 2, choices: 3 }
            ]
          },
          {
            slug: "les-donnees-carburant",
            blocks: [
              { type: "myth", id: "myth" },
              { type: "visual", id: "visual" },
              { type: "notion", id: "donnees-carburant", notion: "donnees-carburant" },
              { type: "quiz", id: "quiz", answer: 0, choices: 3 }
            ]
          },
          {
            slug: "un-modele-cest-quoi",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "modele", notion: "modele" },
              { type: "quiz", id: "quiz", answer: 1, choices: 3 }
            ]
          }
        ]
      },
      {
        slug: "a-quoi-ca-sert",
        lessons: [
          {
            slug: "lia-au-quotidien",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "ia-quotidien", notion: "ia-quotidien" },
              { type: "quiz", id: "quiz", answer: 2, choices: 3 }
            ]
          },
          {
            slug: "ce-que-lia-ne-sait-pas",
            blocks: [
              { type: "myth", id: "myth" },
              { type: "visual", id: "visual" },
              { type: "notion", id: "limites-ia", notion: "limites-ia" },
              { type: "quiz", id: "quiz", answer: 0, choices: 3 }
            ]
          },
          {
            slug: "quand-lia-se-trompe",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "biais-introduction", notion: "biais-introduction" },
              { type: "quiz", id: "quiz", answer: 1, choices: 3 }
            ]
          }
        ]
      }
    ]
  },
  {
    slug: "fondations",
    level: "novice",
    grade: "apprenti",
    domain: "education",
    order: 1,
    modules: [
      {
        slug: "le-vocabulaire-du-ml",
        lessons: [
          {
            slug: "lignes-et-colonnes",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "observations-variables", notion: "observations-variables" },
              { type: "quiz", id: "quiz", answer: 1, choices: 3 }
            ]
          },
          {
            slug: "features-et-cible",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "features-cible", notion: "features-cible" },
              { type: "quiz", id: "quiz", answer: 0, choices: 3 }
            ]
          },
          {
            slug: "classification-vs-regression",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "classification-vs-regression", notion: "classification-vs-regression" },
              { type: "quiz", id: "quiz", answer: 2, choices: 3 }
            ]
          }
        ]
      },
      {
        slug: "le-jeu-de-donnees",
        lessons: [
          {
            slug: "dou-viennent-les-donnees",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "catalogue-ethique", notion: "catalogue-ethique" },
              { type: "quiz", id: "quiz", answer: 1, choices: 3 }
            ]
          },
          {
            slug: "train-test",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "train-test", notion: "train-test" },
              { type: "quiz", id: "quiz", answer: 0, choices: 3 }
            ]
          },
          {
            slug: "la-qualite-des-donnees",
            blocks: [
              { type: "myth", id: "myth" },
              { type: "visual", id: "visual" },
              { type: "notion", id: "qualite-donnees", notion: "qualite-donnees" },
              { type: "quiz", id: "quiz", answer: 2, choices: 3 }
            ]
          }
        ]
      },
      {
        slug: "entrainer-un-premier-modele",
        lessons: [
          {
            slug: "quest-ce-quentrainer",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "entrainer", notion: "entrainer" },
              { type: "quiz", id: "quiz", answer: 1, choices: 3 }
            ]
          },
          {
            slug: "larbre-de-decision",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "arbre-decision", notion: "arbre-decision" },
              { type: "quiz", id: "quiz", answer: 0, choices: 3 }
            ]
          },
          {
            slug: "ta-premiere-enquete",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "practice", id: "practice", challenge: "titanic-1912" }
            ]
          }
        ]
      }
    ]
  },
  {
    slug: "praticien",
    level: "debutant",
    grade: "praticien",
    domain: "healthcare",
    order: 2,
    modules: [
      {
        slug: "preparer-les-donnees",
        lessons: [
          {
            slug: "valeurs-manquantes",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "valeurs-manquantes", notion: "valeurs-manquantes" },
              { type: "quiz", id: "quiz", answer: 1, choices: 3 }
            ]
          },
          {
            slug: "encoder-les-categories",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "encodage", notion: "encodage" },
              { type: "quiz", id: "quiz", answer: 0, choices: 3 }
            ]
          },
          {
            slug: "mettre-a-lechelle",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "mise-a-lechelle", notion: "mise-a-lechelle" },
              { type: "quiz", id: "quiz", answer: 2, choices: 3 }
            ]
          },
          {
            slug: "la-fuite-de-donnees",
            blocks: [
              { type: "myth", id: "myth" },
              { type: "visual", id: "visual" },
              { type: "notion", id: "fuite-de-donnees", notion: "fuite-de-donnees" },
              { type: "quiz", id: "quiz", answer: 0, choices: 3 }
            ]
          }
        ]
      },
      {
        slug: "les-algorithmes",
        lessons: [
          {
            slug: "de-larbre-a-la-foret",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "foret-aleatoire", notion: "foret-aleatoire" },
              { type: "quiz", id: "quiz", answer: 1, choices: 3 }
            ]
          },
          {
            slug: "la-regression-logistique",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "regression-logistique", notion: "regression-logistique" },
              { type: "quiz", id: "quiz", answer: 2, choices: 3 }
            ]
          },
          {
            slug: "comment-choisir-un-algo",
            blocks: [
              { type: "myth", id: "myth" },
              { type: "visual", id: "visual" },
              { type: "notion", id: "choix-algorithme", notion: "choix-algorithme" },
              { type: "quiz", id: "quiz", answer: 0, choices: 3 }
            ]
          }
        ]
      },
      {
        slug: "evaluer-honnetement",
        lessons: [
          {
            slug: "laccuracy-et-son-piege",
            blocks: [
              { type: "myth", id: "myth" },
              { type: "visual", id: "visual" },
              { type: "notion", id: "accuracy-piege", notion: "accuracy-piege" },
              { type: "quiz", id: "quiz", answer: 1, choices: 3 }
            ]
          },
          {
            slug: "precision-rappel-f1",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "precision-rappel-f1", notion: "precision-rappel-f1" },
              { type: "quiz", id: "quiz", answer: 2, choices: 3 }
            ]
          },
          {
            slug: "la-matrice-de-confusion",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "playground", id: "playground", playground: "confusion-threshold" },
              { type: "notion", id: "matrice-de-confusion", notion: "matrice-de-confusion" },
              { type: "quiz", id: "quiz", answer: 0, choices: 3 }
            ]
          },
          {
            slug: "le-surapprentissage",
            blocks: [
              { type: "myth", id: "myth" },
              { type: "visual", id: "visual" },
              { type: "playground", id: "playground", playground: "overfitting-depth" },
              { type: "notion", id: "surapprentissage", notion: "surapprentissage" },
              { type: "quiz", id: "quiz", answer: 1, choices: 3 }
            ]
          }
        ]
      },
      {
        slug: "comprendre-pourquoi",
        lessons: [
          {
            slug: "la-boite-noire",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "boite-noire", notion: "boite-noire" },
              { type: "quiz", id: "quiz", answer: 1, choices: 3 }
            ]
          },
          {
            slug: "importance-et-shap",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "importance-shap", notion: "importance-shap" },
              { type: "quiz", id: "quiz", answer: 0, choices: 3 }
            ]
          },
          {
            slug: "importance-nest-pas-cause",
            blocks: [
              { type: "myth", id: "myth" },
              { type: "visual", id: "visual" },
              { type: "notion", id: "correlation-causalite", notion: "correlation-causalite" },
              { type: "quiz", id: "quiz", answer: 2, choices: 3 }
            ]
          },
          {
            slug: "ta-deuxieme-enquete",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "practice", id: "practice", challenge: "eleves-decrochage" }
            ]
          }
        ]
      }
    ]
  },
  {
    slug: "analyste",
    level: "confirme",
    grade: "analyste",
    domain: "finance",
    order: 3,
    modules: [
      {
        slug: "mesurer-lincertitude",
        lessons: [
          {
            slug: "un-seul-split-est-fragile",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "validation-croisee", notion: "validation-croisee" },
              { type: "quiz", id: "quiz", answer: 1, choices: 3 }
            ]
          },
          {
            slug: "intervalles-de-confiance",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "intervalle-confiance", notion: "intervalle-confiance" },
              { type: "quiz", id: "quiz", answer: 0, choices: 3 }
            ]
          },
          {
            slug: "la-reproductibilite",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "reproductibilite", notion: "reproductibilite" },
              { type: "quiz", id: "quiz", answer: 2, choices: 3 }
            ]
          }
        ]
      },
      {
        slug: "ethique-et-equite",
        lessons: [
          {
            slug: "dou-viennent-les-biais",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "biais-sources", notion: "biais-sources" },
              { type: "quiz", id: "quiz", answer: 1, choices: 3 }
            ]
          },
          {
            slug: "auditer-lequite",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "equite-fairness", notion: "equite-fairness" },
              { type: "quiz", id: "quiz", answer: 0, choices: 3 }
            ]
          },
          {
            slug: "anatomie-dun-fiasco",
            blocks: [
              { type: "case_study", id: "case" },
              { type: "quiz", id: "quiz", answer: 2, choices: 3 }
            ]
          },
          {
            slug: "ta-troisieme-enquete",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "practice", id: "practice", challenge: "equite-revenus" }
            ]
          }
        ]
      },
      {
        slug: "correlation-et-causalite",
        lessons: [
          {
            slug: "correlation-nest-pas-causalite",
            blocks: [
              { type: "myth", id: "myth" },
              { type: "visual", id: "visual" },
              { type: "notion", id: "correlations-fallacieuses", notion: "correlations-fallacieuses" },
              { type: "quiz", id: "quiz", answer: 0, choices: 3 }
            ]
          },
          {
            slug: "les-trois-registres",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "prediction-inference-causalite", notion: "prediction-inference-causalite" },
              { type: "quiz", id: "quiz", answer: 1, choices: 3 }
            ]
          }
        ]
      },
      {
        slug: "du-resultat-au-livrable",
        lessons: [
          {
            slug: "lempreinte-de-reproductibilite",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "empreinte-repro", notion: "empreinte-repro" },
              { type: "quiz", id: "quiz", answer: 2, choices: 3 }
            ]
          },
          {
            slug: "vers-un-resultat-citable",
            blocks: [
              { type: "visual", id: "visual" },
              { type: "notion", id: "resultat-citable", notion: "resultat-citable" },
              { type: "quiz", id: "quiz", answer: 0, choices: 3 }
            ]
          }
        ]
      }
    ]
  }
];

/** Résout un cursus par slug. */
export function getCursus(slug: string): Cursus | undefined {
  return CURSUS.find((cursus) => cursus.slug === slug);
}

/** Cursus triés par ordre de progression. */
export function cursusInOrder(): Cursus[] {
  return [...CURSUS].sort((a, b) => a.order - b.order);
}

/** Résout une leçon (et son cursus/module) par slug de leçon. */
export function findLesson(lessonSlug: string) {
  for (const cursus of CURSUS) {
    for (const mod of cursus.modules) {
      const lesson = mod.lessons.find((l) => l.slug === lessonSlug);
      if (lesson) return { cursus, module: mod, lesson };
    }
  }
  return undefined;
}

/** Toutes les leçons du catalogue, à plat, dans l'ordre. */
export function allLessons() {
  return CURSUS.flatMap((cursus) =>
    cursus.modules.flatMap((mod) => mod.lessons.map((lesson) => ({ cursus, module: mod, lesson })))
  );
}
