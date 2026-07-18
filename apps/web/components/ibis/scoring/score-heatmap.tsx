"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDownIcon } from "lucide-react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger
} from "@/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ScoredDataset } from "@/lib/api/generated";
import { cn } from "@/lib/utils";

/** Plancher visuel (%) : même un score nul reste lisible comme cellule de la grille. */
const INTENSITY_FLOOR = 6;
/** Bascule du texte clair/sombre selon l'intensité du fond mélangé. */
const TEXT_FLIP_THRESHOLD = 0.55;

/** Intensité tonale monochrome : mélange du token `primary` avec le fond de carte,
 *  proportionnel au score (0 → fond neutre, 1 → `primary` plein). Remplace l'ancien
 *  dégradé `hsl()` rouge→vert codé en dur — la charte impose une charte monochrome. */
function cellStyle(value: number): React.CSSProperties {
  const clamped = Math.min(1, Math.max(0, value));
  const intensity = Math.max(INTENSITY_FLOOR, Math.round(clamped * 100));
  return {
    backgroundColor: `color-mix(in oklch, var(--primary) ${intensity}%, var(--card))`
  };
}

function cellTextClass(value: number): string {
  return value >= TEXT_FLIP_THRESHOLD ? "text-primary-foreground" : "text-foreground";
}

/** Légende de l'échelle 0 → 100 : même formule de mélange que les cellules. */
function HeatmapLegend({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs" role="img" aria-label={label}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-muted-foreground">0</span>
      <div
        className="h-2 w-24 rounded-full border"
        style={{ background: "linear-gradient(to right, var(--card), var(--primary))" }}
        aria-hidden="true"
      />
      <span className="font-mono text-muted-foreground">100</span>
    </div>
  );
}

interface ScoreHeatmapProps {
  results: ScoredDataset[];
  criteria: string[];
}

/** Heatmap datasets × critères (CDC §6.4) — rendu DOM natif interactif :
 *  tri par colonne, clic ligne → détail du dataset, survol → détail riche. */
export function ScoreHeatmap({ results, criteria }: ScoreHeatmapProps) {
  const t = useTranslations("scoring");
  const router = useRouter();
  const [sortBy, setSortBy] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (!sortBy) return results;
    return [...results].sort(
      (a, b) =>
        ((b.criterion_scores as Record<string, number>)[sortBy] ?? 0) -
        ((a.criterion_scores as Record<string, number>)[sortBy] ?? 0)
    );
  }, [results, sortBy]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">{t("heatmapHint")}</p>
          <HeatmapLegend label={t("heatmapLegend")} />
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="bg-muted/50 sticky left-0 min-w-40 p-2 text-left font-medium">
                  {t("resultsTitle")}
                </th>
                <th className="bg-muted/50 p-2 font-medium">{t("score")}</th>
                {criteria.map((criterion) => (
                  <th
                    key={criterion}
                    className={cn(
                      "bg-muted/50 hover:bg-muted min-w-16 cursor-pointer p-2 align-bottom font-medium",
                      sortBy === criterion && "text-primary"
                    )}
                    onClick={() => setSortBy(sortBy === criterion ? null : criterion)}
                    title={t(`criteria.${criterion}` as never)}>
                    <span className="flex items-end justify-center gap-0.5">
                      <span className="max-w-20 truncate">
                        {t(`criteria.${criterion}` as never)}
                      </span>
                      {sortBy === criterion ? <ArrowDownIcon className="size-3" /> : null}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((result) => (
                <tr
                  key={result.dataset.id}
                  className="hover:bg-muted/40 cursor-pointer border-t"
                  onClick={() => router.push(`/datasets/${result.dataset.id}`)}>
                  <td className="bg-background sticky left-0 max-w-48 truncate p-2 font-medium">
                    #{result.rank} {result.dataset.display_name}
                  </td>
                  <td className="p-1 text-center">
                    <HoverCard openDelay={150} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <span
                          className={cn(
                            "inline-block w-full cursor-help rounded px-1 py-1.5 text-center font-mono font-semibold transition-colors",
                            cellTextClass(result.score)
                          )}
                          style={cellStyle(result.score)}>
                          {Math.round(result.score * 100)}
                        </span>
                      </HoverCardTrigger>
                      <HoverCardContent align="start" className="w-72 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {result.dataset.display_name}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {[...result.dataset.domain, ...result.dataset.task].join(" · ")}
                            </p>
                          </div>
                          <span className="text-muted-foreground shrink-0 font-mono text-xs">
                            #{result.rank}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-xs font-medium">
                            {t("decomposition")}
                          </p>
                          {criteria.map((criterion) => {
                            const value =
                              (result.criterion_scores as Record<string, number>)[criterion] ?? 0;
                            return (
                              <div key={criterion} className="flex items-center gap-2 text-xs">
                                <span className="w-28 shrink-0 truncate">
                                  {t(`criteria.${criterion}` as never)}
                                </span>
                                <div className="bg-muted h-1.5 flex-1 rounded-full">
                                  <div
                                    className="bg-primary h-1.5 rounded-full"
                                    style={{ width: `${Math.round(value * 100)}%` }}
                                  />
                                </div>
                                <span className="w-8 text-right font-mono">
                                  {Math.round(value * 100)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </td>
                  {criteria.map((criterion) => {
                    const value =
                      (result.criterion_scores as Record<string, number>)[criterion] ?? 0;
                    return (
                      <td key={criterion} className="p-1 text-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={cn(
                                "inline-block w-full cursor-help rounded px-1 py-1.5 text-center font-mono transition-colors",
                                cellTextClass(value)
                              )}
                              style={cellStyle(value)}>
                              {Math.round(value * 100)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {t(`criteria.${criterion}` as never)} · {Math.round(value * 100)}
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
}
