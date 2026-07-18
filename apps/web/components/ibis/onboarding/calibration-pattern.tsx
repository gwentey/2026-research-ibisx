import { cn } from "@/lib/utils";

// Motif SVG local — signature réservée de l'onboarding (synthèse 00, ligne "03 Onboarding") :
// arcs concentriques évoquant des cercles d'étalonnage/calibration, cohérent avec le rôle
// réel de la page (calibrer le niveau d'explication IA). Purement décoratif, `currentColor`,
// opacité très faible et dégressive (~0.06 → 0.02) pour rester lisible en clair ET sombre.
// Réservé à cette page (règle anti-collision synthèse 00 : pas de "points"/halo/médaillon ici).

const RINGS = [
  { r: 70, opacity: 0.06 },
  { r: 140, opacity: 0.05 },
  { r: 215, opacity: 0.04 },
  { r: 300, opacity: 0.03 },
  { r: 390, opacity: 0.02 }
] as const;

export function CalibrationPattern({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 -z-10 h-full w-full", className)}
      viewBox="0 0 900 700"
      preserveAspectRatio="xMidYMid slice">
      <g className="text-foreground" transform="translate(450 230)">
        {RINGS.map((ring) => (
          <circle
            key={ring.r}
            cx={0}
            cy={0}
            r={ring.r}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            opacity={ring.opacity}
          />
        ))}
      </g>
    </svg>
  );
}
