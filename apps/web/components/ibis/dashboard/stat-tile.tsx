import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Stat tile (P6/lot 3, doc 04-dashboard.md) : reprend la hiérarchie du template
// website-analytics/stat-cards.tsx (label + signal en ligne haute, valeur en text-3xl
// dessous) et y ajoute une tuile-icône tonale (langage du wizard-shell). Chaque
// nuance chart-1..4 est purement tonale (monochrome) — jamais une couleur inventée.
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
  trend
}: {
  icon: LucideIcon;
  tone: StatTone;
  label: string;
  value: string;
  /** Signal qualitatif dérivé d'une vraie valeur (ex. success_rate) — jamais un delta inventé. */
  trend?: StatTrend | null;
}) {
  const TrendIcon = trend?.icon;

  return (
    <Card className="py-0">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONE_CLASS[tone])}>
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
          <dd className="text-3xl font-semibold tracking-tight">{value}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}
