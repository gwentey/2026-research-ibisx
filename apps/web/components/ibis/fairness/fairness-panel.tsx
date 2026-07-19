"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ScaleIcon, TriangleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { getDataset, getFairnessReport } from "@/lib/api/generated";
import { detectSensitiveFeatures } from "@/lib/lenses/insights";
import { cn } from "@/lib/utils";

interface FairnessGroup {
  value: string;
  size: number;
  accuracy: number | null;
  selection_rate?: number | null;
  tpr?: number | null;
}

interface FairnessReport {
  applicable: boolean;
  binary?: boolean;
  favorable?: string | null;
  sensitive_column?: string;
  total?: number;
  groups?: FairnessGroup[];
  disparities?: {
    accuracy_gap?: number | null;
    selection_rate_ratio?: number | null;
    tpr_gap?: number | null;
    four_fifths_pass?: boolean;
  };
}

function pct(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${Math.round(value * 100)} %`;
}

export function FairnessPanel({
  experimentId,
  datasetId,
  taskType
}: {
  experimentId: string;
  datasetId: string;
  taskType: string | undefined;
}) {
  const t = useTranslations("fairness");
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [report, setReport] = useState<FairnessReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Colonnes candidates : sensibles (détectées) + catégorielles à faibles modalités.
  useEffect(() => {
    let alive = true;
    void getDataset({ path: { dataset_id: datasetId }, throwOnError: false }).then((res) => {
      if (!alive) return;
      const columns = res.data?.files?.[0]?.columns ?? [];
      const names = columns.map((column) => column.name);
      const sensitive = names.filter((name) => detectSensitiveFeatures([name]).length > 0);
      const categorical = columns
        .filter((column) => ["categorical", "boolean"].includes(column.dtype_interpreted))
        .map((column) => column.name);
      setCandidates(Array.from(new Set([...sensitive, ...categorical])).slice(0, 8));
    });
    return () => {
      alive = false;
    };
  }, [datasetId]);

  // Rapport d'équité pour la colonne choisie.
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    setLoading(true);
    setError(null);
    setReport(null);
    void getFairnessReport({
      path: { experiment_id: experimentId },
      query: { sensitive_column: selected },
      throwOnError: false
    })
      .then((res) => {
        if (!alive) return;
        if (res.error || !res.data) {
          setError(t("errorGeneric"));
          return;
        }
        setReport(res.data as unknown as FairnessReport);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selected, experimentId, t]);

  if (taskType !== "classification") {
    return <p className="text-muted-foreground text-sm">{t("regressionNote")}</p>;
  }

  const binary = report?.binary ?? false;
  const disparity = report?.disparities;
  const disparityDetected = binary && disparity?.four_fifths_pass === false;

  return (
    <div className="space-y-5">
      <p className="text-muted-foreground text-sm">{t("intro")}</p>

      {/* Sélecteur de variable sensible */}
      {candidates.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noColumns")}</p>
      ) : (
        <div className="space-y-2">
          <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            {t("pick")}
          </span>
          <div className="flex flex-wrap gap-2">
            {candidates.map((column) => (
              <Button
                key={column}
                variant={selected === column ? "default" : "outline"}
                size="sm"
                onClick={() => setSelected(column)}>
                {column}
              </Button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : null}

      {error ? <p className="text-muted-foreground text-sm">{error}</p> : null}

      {report && report.applicable && report.groups ? (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ScaleIcon className="text-muted-foreground size-4" />
                <span className="text-sm font-medium">{report.sensitive_column}</span>
                {binary && report.favorable ? (
                  <span className="text-muted-foreground text-xs">
                    {t("favorable", { label: report.favorable })}
                  </span>
                ) : null}
              </div>
              {binary ? (
                <Badge variant={disparityDetected ? "destructive" : "secondary"}>
                  {disparityDetected ? (
                    <>
                      <TriangleAlertIcon className="size-3.5" />
                      {t("disparityDetected")}
                    </>
                  ) : (
                    t("disparityNone")
                  )}
                </Badge>
              ) : null}
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colGroup")}</TableHead>
                    <TableHead className="text-right">{t("colSize")}</TableHead>
                    {binary ? (
                      <>
                        <TableHead className="text-right">{t("colSelection")}</TableHead>
                        <TableHead className="text-right">{t("colTpr")}</TableHead>
                      </>
                    ) : null}
                    <TableHead className="text-right">{t("colAccuracy")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.groups.map((group) => (
                    <TableRow key={group.value}>
                      <TableCell className="font-medium">{group.value}</TableCell>
                      <TableCell className="text-right tabular-nums">{group.size}</TableCell>
                      {binary ? (
                        <>
                          <TableCell className="text-right tabular-nums">
                            {pct(group.selection_rate)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {pct(group.tpr)}
                          </TableCell>
                        </>
                      ) : null}
                      <TableCell className="text-right tabular-nums">
                        {pct(group.accuracy)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Disparités */}
            <dl className="grid gap-3 sm:grid-cols-3">
              {binary ? (
                <div>
                  <dt className="text-muted-foreground text-[11px] tracking-wide uppercase">
                    {t("selectionRatio")}
                  </dt>
                  <dd className="text-sm font-medium tabular-nums">
                    {pct(disparity?.selection_rate_ratio)}
                  </dd>
                </div>
              ) : null}
              {binary ? (
                <div>
                  <dt className="text-muted-foreground text-[11px] tracking-wide uppercase">
                    {t("tprGap")}
                  </dt>
                  <dd className="text-sm font-medium tabular-nums">{pct(disparity?.tpr_gap)}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground text-[11px] tracking-wide uppercase">
                  {t("accuracyGap")}
                </dt>
                <dd className="text-sm font-medium tabular-nums">{pct(disparity?.accuracy_gap)}</dd>
              </div>
            </dl>

            {/* Garde-fou : mesure ≠ preuve de discrimination */}
            <p
              className={cn(
                "text-muted-foreground border-muted-foreground/30 border-l-2 border-dashed pl-3 text-xs leading-relaxed"
              )}>
              {t("caveat")}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
