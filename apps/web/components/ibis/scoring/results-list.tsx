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
import { DomainPattern } from "@/components/ibis/datasets/domain-pattern";
import type { ScoredDataset } from "@/lib/api/generated";
import { scoreColorClass } from "@/lib/datasets/constants";
import { primaryDomainVisual } from "@/lib/datasets/domain-visuals";
import { cn } from "@/lib/utils";

// Cartes de recommandation (09 — projets) : rang, tuile de DOMAINE (icône +
// motif SVG local, langage du catalogue 05 mais en composition compacte —
// jamais de médaillon ni de vignette pleine largeur pour éviter la collision
// avec les signatures 05/06/10), score % coloré, tooltip de décomposition.
// ⚠️ Contrat e2e : Card = data-slot="card" ; le nom du dataset reste seul
// texte de son élément (match exact `getByText(display_name, {exact:true})`);
// `renderAction` fournit un lien role=link libellé scoring.train — inchangé.
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
  const tDatasets = useTranslations("datasets");

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-2">
        {results.map((result) => {
          const percent = Math.round(result.score * 100);
          const visual = primaryDomainVisual(result.dataset.domain);
          const DomainIcon = visual.icon;
          const tags = [...result.dataset.domain.slice(1), ...result.dataset.task];
          return (
            <Card
              key={result.dataset.id}
              className="py-3 transition-shadow hover:shadow-sm">
              <CardContent className="flex items-center gap-4">
                <span className="text-muted-foreground w-8 shrink-0 text-center font-mono text-sm">
                  #{result.rank}
                </span>
                <div
                  className={cn(
                    "relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg",
                    visual.tone.bgTile,
                    visual.tone.text
                  )}>
                  <DomainPattern pattern={visual.pattern} className={visual.tone.patternText} />
                  <DomainIcon className="relative size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/datasets/${result.dataset.id}`}
                    className="block truncate font-medium hover:underline">
                    {result.dataset.display_name}
                  </Link>
                  <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 truncate text-xs">
                    <span>{tDatasets(visual.labelKey as never)}</span>
                    {tags.length > 0 ? <span>· {tags.join(" · ")}</span> : null}
                  </div>
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
