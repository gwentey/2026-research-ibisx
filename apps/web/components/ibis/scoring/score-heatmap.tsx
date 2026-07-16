"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDownIcon } from "lucide-react";

import type { ScoredDataset } from "@/lib/api/generated";
import { cn } from "@/lib/utils";

/** Couleur continue d'une cellule (0 → rouge, 1 → vert) — lisible clair/sombre. */
function cellStyle(value: number): React.CSSProperties {
  const hue = Math.round(value * 120); // 0 rouge → 120 vert
  return {
    backgroundColor: `hsl(${hue} 65% 45% / 0.85)`,
    color: "white"
  };
}

interface ScoreHeatmapProps {
  results: ScoredDataset[];
  criteria: string[];
}

/** Heatmap datasets × critères (CDC §6.4) — rendu DOM natif interactif :
 *  tri par colonne, clic ligne → détail du dataset. */
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
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">{t("heatmapHint")}</p>
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
                  <span
                    className="inline-block w-full rounded px-1 py-1.5 font-mono font-semibold"
                    style={cellStyle(result.score)}>
                    {Math.round(result.score * 100)}
                  </span>
                </td>
                {criteria.map((criterion) => {
                  const value =
                    (result.criterion_scores as Record<string, number>)[criterion] ?? 0;
                  return (
                    <td key={criterion} className="p-1 text-center">
                      <span
                        className="inline-block w-full rounded px-1 py-1.5 font-mono"
                        style={cellStyle(value)}
                        title={`${t(`criteria.${criterion}` as never)} : ${Math.round(value * 100)}%`}>
                        {Math.round(value * 100)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
