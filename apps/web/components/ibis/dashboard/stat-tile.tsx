import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import CountAnimation from "@/components/ui/custom/count-animation";
import { cn } from "@/lib/utils";

// Stat tile (P6/lot 3, doc 04-dashboard.md) : reprend la hiérarchie du template
// website-analytics/stat-cards.tsx (label + signal en ligne haute, valeur en text-3xl
// dessous) et y ajoute une tuile-icône tonale (langage du wizard-shell). Chaque
// nuance chart-1..4 est purement tonale (monochrome) — jamais une couleur inventée.
// Le chiffre « monte » à l'arrivée (CountAnimation, même motif que file-manager) quand
// une vraie valeur numérique est fournie ; sinon on affiche le texte tel quel (« — »).
type StatTone = "chart-1" | "chart-2" | "chart-3" | "chart-4";

const TONE_CLASS: Record<StatTone, string> = {
  "chart-1": "bg-chart-1/10 text-chart-1",
  "chart-2": "bg-chart-2/10 text-chart-2",
  "chart-3": "bg-chart-3/10 text-chart-3",
  "chart-4": "bg-chart-4/10 text-chart-4"
};

export interface StatTrend {
  icon: LucideIcon;
  label: string;
}

export function StatTile({
  icon: Icon,
  tone,
  label,
  value,
  count,
  suffix,
  trend
}: {
  icon: LucideIcon;
  tone: StatTone;
  label: string;
  /** Valeur textuelle de repli (ex. « — » quand la donnée est absente). Ignorée si `count` est fourni. */
  value: string;
  /** Vraie valeur numérique : déclenche le count-up 0 → count à l'arrivée. */
  count?: number | null;
  /** Suffixe collé au chiffre animé (ex. « % », « s »). */
  suffix?: string;
  /** Signal qualitatif dérivé d'une vraie valeur (ex. success_rate) — jamais un delta inventé. */
  trend?: StatTrend | null;
}) {
  const TrendIcon = trend?.icon;
  const hasCount = count !== null && count !== undefined;

  return (
    <Card className="py-0 transition-shadow duration-200 hover:shadow-md">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              TONE_CLASS[tone]
            )}>
            <Icon className="size-4" />
          </div>
          {trend && TrendIcon ? (
            <Badge variant="outline" className="gap-1">
              <TrendIcon className="size-3" />
              {trend.label}
            </Badge>
          ) : null}
        </div>
        <dl>
          <dt className="text-muted-foreground text-sm">{label}</dt>
          <dd className="font-display text-3xl tracking-tight tabular-nums">
            {hasCount ? (
              <>
                <CountAnimation number={count} />
                {suffix ? <span>{suffix}</span> : null}
              </>
            ) : (
              value
            )}
          </dd>
        </dl>
      </CardContent>
    </Card>
  );
}
