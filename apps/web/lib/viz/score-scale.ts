// Échelle de score UNIQUE — 5 déclinaisons réutilisées dans toute l'application
// (heatmap de scoring, matrice de confusion, jauges KPI). La rampe de couleurs vit
// dans app/globals.css (--score-1..5, clair + sombre) : une seule source de vérité,
// jamais redéfinie ailleurs. Ici on ne fait que MAPPER une valeur [0,1] vers un palier
// puis vers un style de cellule. Le fond est toujours mélangé à --card à une intensité
// bornée → le texte --foreground reste lisible en clair comme sur le template sombre.
//
// Sémantique : rampe « qualité » neutre → émeraude. La couleur ne « monte » qu'en
// approchant 100 %, ce qui répond à la demande produit sans dénaturer le thème monochrome.

export type ScoreStep = 1 | 2 | 3 | 4 | 5;

/** Bornes des 5 paliers (alignées sur scoreColorClass : 40 / 60 / 75 / 90). */
export function scoreStep(value: number): ScoreStep {
  const v = Math.max(0, Math.min(1, value));
  if (v >= 0.9) return 5;
  if (v >= 0.75) return 4;
  if (v >= 0.6) return 3;
  if (v >= 0.4) return 2;
  return 1;
}

/** Token CSS du palier (utilisable en classe Tailwind `bg-score-3`, `text-score-5`, …). */
export function scoreToken(value: number): string {
  return `score-${scoreStep(value)}`;
}

/** Intensité de mélange (%) par palier — bornée à 58 % pour garantir le contraste du texte. */
const STEP_MIX: Record<ScoreStep, number> = { 1: 12, 2: 22, 3: 33, 4: 45, 5: 58 };

/** Fond de cellule de heatmap : mélange du palier avec --card. Lisible clair + sombre. */
export function scoreCellStyle(value: number): { backgroundColor: string } {
  const step = scoreStep(value);
  return {
    backgroundColor: `color-mix(in oklch, var(--score-${step}) ${STEP_MIX[step]}%, var(--card))`
  };
}

/** Variante libre : mélange à une intensité arbitraire (ex. légende, segments). */
export function scoreMix(step: ScoreStep, mix: number): string {
  return `color-mix(in oklch, var(--score-${step}) ${Math.max(0, Math.min(100, mix))}%, var(--card))`;
}

/** Les 5 paliers, pour dessiner une légende (0 → 100). */
export const SCORE_STEPS: ScoreStep[] = [1, 2, 3, 4, 5];
