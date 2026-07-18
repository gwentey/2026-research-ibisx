import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressRing } from "@/components/ibis/progress-ring";
import { cn } from "@/lib/utils";
import { ServiceStatusDot, type ServiceHealthState } from "./service-status-dot";

// Carte-service (P6/lot 6, doc 12-status.md) : signature propre à /status — pastille
// d'état vivante (ServiceStatusDot) + jauge dérivée du ratio réel de sous-vérifications
// au vert (ProgressRing déjà extrait du wizard). Aucune donnée inventée : le ratio est
// calculé à partir des champs exposés par le client généré (HealthReport/WorkerHealthReport).
export function ServiceCard({
  icon: Icon,
  title,
  state,
  label,
  loaded,
  checkingLabel,
  ratio,
  children
}: {
  icon: LucideIcon;
  title: string;
  state: ServiceHealthState;
  label: string;
  loaded: boolean;
  checkingLabel: string;
  /** Part (0-100) des sous-vérifications au vert, pour la jauge. */
  ratio: number;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            <Icon className="text-muted-foreground size-4" />
            {title}
          </span>
          {loaded ? (
            <Badge
              variant={state === "ok" ? "default" : state === "down" ? "destructive" : "outline"}
              className="gap-1.5">
              <ServiceStatusDot state={state} />
              {label}
            </Badge>
          ) : (
            <Badge variant="outline">{checkingLabel}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!loaded ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="flex items-start gap-4">
            <div className="relative flex size-12 shrink-0 items-center justify-center">
              <ProgressRing
                value={ratio}
                size={48}
                strokeWidth={4}
                progressClassName={cn(
                  ratio === 100 ? "stroke-primary" : ratio === 0 ? "stroke-destructive" : "stroke-primary"
                )}
              />
              <span className="absolute text-[10px] font-semibold tabular-nums">
                {Math.round(ratio)}%
              </span>
            </div>
            <div className="min-w-0 flex-1 space-y-2 text-sm">{children}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ServiceSubRow({
  label,
  state,
  okLabel,
  koLabel
}: {
  label: string;
  state: "ok" | "down";
  okLabel: string;
  koLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground flex items-center gap-2 truncate">
        <ServiceStatusDot state={state} />
        {label}
      </span>
      <span
        className={cn(
          "shrink-0 text-xs font-medium",
          state === "ok" ? "text-green-600 dark:text-green-400" : "text-destructive"
        )}>
        {state === "ok" ? okLabel : koLabel}
      </span>
    </div>
  );
}
