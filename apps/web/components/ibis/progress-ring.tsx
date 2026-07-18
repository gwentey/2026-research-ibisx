import { cn } from "@/lib/utils";

// Anneau de progression SVG en tokens (extrait du wizard-shell pour réutilisation :
// wizard, complétion de métadonnées, score éthique du catalogue, etc.).
// Rendu identique au wizard pour size=36 / strokeWidth=3 (radius=14).

export function ProgressRing({
  value,
  size = 36,
  strokeWidth = 3,
  className,
  trackClassName = "stroke-border",
  progressClassName = "stroke-primary"
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  trackClassName?: string;
  progressClassName?: string;
}) {
  const center = size / 2;
  const radius = center - strokeWidth - 1;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("-rotate-90", className)}>
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className={trackClassName}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - (circumference * clamped) / 100}
        className={cn("transition-all duration-500", progressClassName)}
      />
    </svg>
  );
}
