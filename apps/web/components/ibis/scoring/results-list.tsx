"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import type { ScoredDataset } from "@/lib/api/generated";
import { scoreColorClass } from "@/lib/datasets/constants";

/** Liste classée (CDC §6.4) : rang, score % coloré, tooltip de décomposition. */
export function ResultsList({
  results,
  criteria,
  renderAction
}: {
  results: ScoredDataset[];
  criteria: string[];
  renderAction?: (datasetId: string) => React.ReactNode;
}) {
  const t = useTranslations("scoring");

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-2">
        {results.map((result) => {
          const percent = Math.round(result.score * 100);
          return (
            <Card key={result.dataset.id} className="py-3">
              <CardContent className="flex items-center gap-4">
                <span className="text-muted-foreground w-10 shrink-0 text-center font-mono text-sm">
                  #{result.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/datasets/${result.dataset.id}`}
                    className="truncate font-medium hover:underline">
                    {result.dataset.display_name}
                  </Link>
                  <p className="text-muted-foreground truncate text-xs">
                    {[...result.dataset.domain, ...result.dataset.task].join(" · ")}
                  </p>
                </div>
                {renderAction ? renderAction(result.dataset.id) : null}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={`cursor-help font-mono text-lg font-semibold ${scoreColorClass(percent)}`}>
                      {percent}%
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="w-64">
                    <p className="mb-1 font-medium">{t("decomposition")}</p>
                    <div className="space-y-0.5">
                      {criteria.map((criterion) => {
                        const value =
                          (result.criterion_scores as Record<string, number>)[criterion] ?? 0;
                        return (
                          <div key={criterion} className="flex items-center gap-2 text-xs">
                            <span className="w-36 truncate">
                              {t(`criteria.${criterion}` as never)}
                            </span>
                            <div className="bg-muted-foreground/20 h-1.5 flex-1 rounded">
                              <div
                                className="bg-primary-foreground h-1.5 rounded"
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
                  </TooltipContent>
                </Tooltip>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
