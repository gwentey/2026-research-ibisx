import { cn } from "@/lib/utils";

// Illustration SVG partagée des pages d'état (404 / error) — refonte P3, lot 14.
// Signature réservée à cette surface (docs/refonte/00-synthese.md, matrice
// anti-collision) : panneau tramé plein écran + monogramme filaire. La trame est
// volontairement plus fine/dense que le motif "points" du hero dashboard (04) pour
// ne jamais s'y confondre — jamais réemployée ailleurs comme fond de page.
// 100% tokens (currentColor / stroke-foreground / stroke-chart-N), zéro image externe.
// Pas de hook (pas de useId) : composant pur, utilisable aussi bien depuis le
// Server Component `not-found.tsx` que depuis le Client Component `error.tsx`.
// Une seule instance par page ⇒ id de pattern statique et stable, pas de collision.

type SegmentId = "a" | "b" | "c" | "d" | "e" | "f" | "g";

const DIGIT_WIDTH = 16;
const DIGIT_HEIGHT = 32;

const SEGMENT_PATHS: Record<SegmentId, string> = {
  a: `M1 1H${DIGIT_WIDTH - 1}`,
  b: `M${DIGIT_WIDTH - 1} 1V${DIGIT_HEIGHT / 2}`,
  c: `M${DIGIT_WIDTH - 1} ${DIGIT_HEIGHT / 2}V${DIGIT_HEIGHT - 1}`,
  d: `M1 ${DIGIT_HEIGHT - 1}H${DIGIT_WIDTH - 1}`,
  e: `M1 ${DIGIT_HEIGHT / 2}V${DIGIT_HEIGHT - 1}`,
  f: `M1 1V${DIGIT_HEIGHT / 2}`,
  g: `M1 ${DIGIT_HEIGHT / 2}H${DIGIT_WIDTH - 1}`
};

// Segments allumés par chiffre (façon compteur digital, dans l'esprit filaire du
// ProgressRing) : "4" = f,g,b,c ; "0" = a,b,c,d,e,f. Les segments éteints restent
// visibles à très faible opacité pour l'effet "afficheur", jamais un pavé plein.
const DIGIT_SEGMENTS: Record<"0" | "4", SegmentId[]> = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "4": ["b", "c", "f", "g"]
};

function SevenSegmentDigit({ digit }: { digit: "0" | "4" }) {
  const active = new Set(DIGIT_SEGMENTS[digit]);
  return (
    <svg
      width={DIGIT_WIDTH}
      height={DIGIT_HEIGHT}
      viewBox={`0 0 ${DIGIT_WIDTH} ${DIGIT_HEIGHT}`}>
      {(Object.keys(SEGMENT_PATHS) as SegmentId[]).map((segment) => (
        <path
          key={segment}
          d={SEGMENT_PATHS[segment]}
          fill="none"
          strokeWidth={2.5}
          strokeLinecap="round"
          className={active.has(segment) ? "stroke-foreground/75" : "stroke-foreground/10"}
        />
      ))}
    </svg>
  );
}

function NotFoundMonogram() {
  return (
    <div className="flex items-center gap-2.5">
      <SevenSegmentDigit digit="4" />
      <SevenSegmentDigit digit="0" />
      <SevenSegmentDigit digit="4" />
    </div>
  );
}

// Anneau "connexion rompue" : reprend la technique du ProgressRing (wizard-shell)
// mais volontairement incomplet (~2/3 du tracé), traversé d'une rupture en zigzag —
// métaphore douce d'un circuit interrompu qu'on peut relancer, jamais un bug gadget.
function ErrorMonogram() {
  const size = 64;
  const strokeWidth = 4;
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const visible = circumference * (2 / 3);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${visible} ${circumference}`}
        transform={`rotate(-90 ${center} ${center})`}
        className="stroke-chart-2/70"
      />
      <path
        d="M22 40L30 24L36 34L44 20"
        fill="none"
        strokeWidth={strokeWidth * 0.65}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-chart-1"
      />
    </svg>
  );
}

export function StateIllustration({
  variant,
  className
}: {
  variant: "not-found" | "error";
  className?: string;
}) {
  const patternId = `state-illustration-trame-${variant}`;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "border-primary/10 bg-primary/5 relative aspect-[16/10] w-full overflow-hidden rounded-xl border",
        className
      )}>
      <svg className="absolute inset-0 h-full w-full text-primary/20">
        <defs>
          <pattern id={patternId} width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="7" cy="7" r="1" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        {variant === "not-found" ? <NotFoundMonogram /> : <ErrorMonogram />}
      </div>

      <div className="from-background/80 absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t to-transparent" />
    </div>
  );
}
