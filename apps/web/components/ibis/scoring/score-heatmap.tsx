"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger
} from "@/components/ui/hover-card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ScoredDataset } from "@/lib/api/generated";
import { scoreCellStyle, scoreMix, SCORE_STEPS } from "@/lib/viz/score-scale";
import { cn } from "@/lib/utils";

/** Légende de l'échelle 0 → 100 : les 5 paliers de la rampe partagée, du plus
 *  neutre (faible) au plus émeraude (élevé). Même source que les cellules. */
function HeatmapLegend({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs" role="img" aria-label={label}>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-muted-foreground font-mono">0</span>
      <div className="flex overflow-hidden rounded-full border" aria-hidden="true">
        {SCORE_STEPS.map((step) => (
          <span key={step} className="h-2 w-5" style={{ backgroundColor: scoreMix(step, 58) }} />
        ))}
      </div>
      <span className="text-muted-foreground font-mono">100</span>
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
                <th className="bg-muted/50 sticky left-0 z-10 min-w-40 p-2 text-left align-bottom font-medium">
                  {t("resultsTitle")}
                </th>
                <th className="bg-muted/50 p-2 align-bottom font-medium">{t("score")}</th>
                {/* En-têtes EN DIAGONALE (≈45°, façon Excel) : libellé complet lisible tête à
                    peine inclinée, colonnes étroites → matrice entière visible, header 2× moins
                    haut qu'en vertical. Le span est hors-flux (absolute) donc n'élargit pas la
                    colonne. Colonne-tampon finale à droite pour ne pas rogner le dernier libellé. */}
                {criteria.map((criterion) => {
                  const active = sortBy === criterion;
                  return (
                    <th
                      key={criterion}
                      className={cn(
                        "group/col bg-muted/50 hover:bg-muted relative h-[104px] cursor-pointer align-bottom font-medium transition-colors",
                        active && "border-primary border-b-2"
                      )}
                      onClick={() => setSortBy(active ? null : criterion)}
                      title={t(`criteria.${criterion}` as never)}>
                      <span
                        className={cn(
                          "absolute bottom-1.5 left-1/2 origin-bottom-left -rotate-45 pl-1 text-left tracking-tight whitespace-nowrap transition-colors",
                          active
                            ? "text-primary font-semibold"
                            : "text-foreground/75 group-hover/col:text-foreground"
                        )}>
                        {t(`criteria.${criterion}` as never)}
                      </span>
                    </th>
                  );
                })}
                {/* Tampon : réserve la place où le dernier libellé en diagonale « monte ». */}
                <th className="bg-muted/50 w-12" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((result) => (
                <tr
                  key={result.dataset.id}
                  className="hover:bg-muted/40 cursor-pointer border-t"
                  onClick={() => router.push(`/datasets/${result.dataset.id}`)}>
                  <td className="bg-background sticky left-0 z-10 max-w-48 truncate p-2 font-medium">
                    #{result.rank} {result.dataset.display_name}
                  </td>
                  <td className="p-1 text-center">
                    <HoverCard openDelay={150} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <span
                          className="text-foreground inline-block w-full cursor-help rounded px-1 py-1.5 text-center font-mono font-semibold transition-colors"
                          style={scoreCellStyle(result.score)}>
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
                              className="text-foreground inline-block w-full cursor-help rounded px-1 py-1.5 text-center font-mono transition-colors"
                              style={scoreCellStyle(value)}>
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
                  {/* Tampon (aligné avec l'en-tête). */}
                  <td aria-hidden="true" />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
}
