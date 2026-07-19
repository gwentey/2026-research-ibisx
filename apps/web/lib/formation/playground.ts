// Logique PURE des bacs à sable (B3). Données d'ILLUSTRATION uniquement (jamais un vrai
// résultat d'entraînement — P1) : ces fonctions alimentent des schémas manipulables, pas le
// pipeline. Testables isolément.

export interface ScoredPoint {
  /** Score du modèle (0..1) attribué à l'exemple. */
  score: number;
  /** Vraie classe : positif (true) ou négatif (false). */
  positive: boolean;
}

export interface Confusion {
  tp: number; // vrais positifs
  fp: number; // faux positifs
  tn: number; // vrais négatifs
  fn: number; // faux négatifs
}

/** Matrice de confusion à un seuil donné : prédit positif ssi score >= seuil. */
export function confusionAt(points: ScoredPoint[], threshold: number): Confusion {
  const cm: Confusion = { tp: 0, fp: 0, tn: 0, fn: 0 };
  for (const point of points) {
    const predictedPositive = point.score >= threshold;
    if (point.positive && predictedPositive) cm.tp += 1;
    else if (!point.positive && predictedPositive) cm.fp += 1;
    else if (!point.positive && !predictedPositive) cm.tn += 1;
    else cm.fn += 1;
  }
  return cm;
}

export interface ConfusionMetrics {
  precision: number;
  recall: number;
  accuracy: number;
}

/** Précision / rappel / exactitude, définies à 0 (jamais NaN) quand le dénominateur est nul. */
export function confusionMetrics({ tp, fp, tn, fn }: Confusion): ConfusionMetrics {
  const safe = (num: number, den: number) => (den === 0 ? 0 : num / den);
  return {
    precision: safe(tp, tp + fp),
    recall: safe(tp, tp + fn),
    accuracy: safe(tp + tn, tp + fp + tn + fn)
  };
}

/** Nuage d'illustration par défaut pour le bac à sable « matrice de confusion ». */
export const DEMO_POINTS: ScoredPoint[] = [
  { score: 0.95, positive: true },
  { score: 0.88, positive: true },
  { score: 0.76, positive: true },
  { score: 0.68, positive: true },
  { score: 0.62, positive: true },
  { score: 0.58, positive: false },
  { score: 0.52, positive: true },
  { score: 0.48, positive: false },
  { score: 0.44, positive: true },
  { score: 0.38, positive: false },
  { score: 0.31, positive: false },
  { score: 0.24, positive: false },
  { score: 0.17, positive: false },
  { score: 0.09, positive: false }
];

export interface DepthPoint {
  depth: number;
  train: number; // exactitude d'entraînement (0..1)
  test: number; // exactitude de test (0..1)
}

/**
 * Courbe d'illustration du sur-apprentissage : l'exactitude d'entraînement monte de façon
 * monotone vers 1 ; l'exactitude de test monte, atteint un optimum, puis redescend quand
 * l'arbre devient trop profond (il mémorise le bruit). Écart train−test croissant.
 */
export function overfittingCurve(): DepthPoint[] {
  return [
    { depth: 1, train: 0.68, test: 0.66 },
    { depth: 2, train: 0.76, test: 0.74 },
    { depth: 3, train: 0.83, test: 0.8 },
    { depth: 4, train: 0.89, test: 0.83 },
    { depth: 5, train: 0.93, test: 0.82 },
    { depth: 6, train: 0.97, test: 0.78 },
    { depth: 7, train: 0.99, test: 0.72 },
    { depth: 8, train: 1.0, test: 0.67 }
  ];
}
