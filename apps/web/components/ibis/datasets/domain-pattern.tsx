"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

// Motifs SVG locaux (refonte P3 : zéro image externe). `currentColor` → la nuance et
// l'opacité viennent du parent (ex. text-chart-2/20). Chaque instance a un id unique
// (useId) pour éviter toute collision de <pattern> sur une grille de nombreuses cartes.

export type DomainPatternId =
  | "grid"
  | "cross"
  | "chevrons"
  | "dots"
  | "waves"
  | "diagonals"
  | "rings"
  | "circuit"
  | "hatch";

/** Contenu d'une tuile de motif (répétée par <pattern>), dessiné en currentColor. */
function PatternTile({ pattern }: { pattern: DomainPatternId }) {
  switch (pattern) {
    case "grid":
      return (
        <path
          d="M20 0V20M0 20H20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
      );
    case "cross":
      return (
        <path
          d="M10 6V14M6 10H14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      );
    case "chevrons":
      return (
        <path
          d="M2 14L10 6L18 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "dots":
      return <circle cx="10" cy="10" r="1.6" fill="currentColor" />;
    case "waves":
      return (
        <path
          d="M0 12C6 4 14 20 20 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      );
    case "diagonals":
      return (
        <path d="M-2 18L18 -2M6 26L26 6" fill="none" stroke="currentColor" strokeWidth="1.25" />
      );
    case "rings":
      return (
        <>
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1" />
        </>
      );
    case "circuit":
      return (
        <>
          <path
            d="M0 12H24M12 0V24"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.75"
          />
          <circle cx="12" cy="12" r="1.8" fill="currentColor" />
          <circle cx="0" cy="12" r="1.4" fill="currentColor" />
          <circle cx="12" cy="0" r="1.4" fill="currentColor" />
        </>
      );
    case "hatch":
      return (
        <path
          d="M-1 5L5 -1M-1 13L13 -1M7 13L13 7"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.75"
        />
      );
  }
}

/** Tailles de tuile par motif (userSpaceOnUse). */
const TILE_SIZE: Record<DomainPatternId, number> = {
  grid: 20,
  cross: 20,
  chevrons: 20,
  dots: 20,
  waves: 20,
  diagonals: 24,
  rings: 24,
  circuit: 24,
  hatch: 12
};

export function DomainPattern({
  pattern,
  className
}: {
  pattern: DomainPatternId;
  className?: string;
}) {
  const id = useId();
  const size = TILE_SIZE[pattern];

  return (
    <svg
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}>
      <defs>
        <pattern
          id={id}
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
          patternContentUnits="userSpaceOnUse">
          <PatternTile pattern={pattern} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
