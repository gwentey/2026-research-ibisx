"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { previewDataset } from "@/lib/api/generated";
import type { DatasetPreview } from "@/lib/api/generated";
import { formatCount } from "@/lib/datasets/constants";
import { cn } from "@/lib/utils";

export function PreviewTab({ datasetId }: { datasetId: string }) {
  const t = useTranslations("datasets.detail");
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    previewDataset({ path: { dataset_id: datasetId }, throwOnError: false }).then(
      ({ data }) => {
        if (data) {
          setPreview(data);
          setState("ready");
        } else {
          // P1 : erreur EXPLICITE — jamais d'aperçu simulé
          setState("error");
        }
      }
    );
  }, [datasetId]);

  if (state === "loading") return <Skeleton className="h-64 w-full" />;
  if (state === "error" || !preview) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("tabPreview")}</AlertTitle>
        <AlertDescription>{t("previewError")}</AlertDescription>
      </Alert>
    );
  }

  const stats = new Map(preview.column_stats.map((column) => [column.name, column]));

  const tiles = [
    { label: t("previewRowsLabel"), value: formatCount(preview.total_rows) },
    {
      label: t("previewColumnsLabel"),
      value: `${preview.displayed_columns.length}/${preview.total_columns}`
    },
    ...(preview.sampled
      ? [{ label: t("previewSeedLabel"), value: String(preview.random_state) }]
      : [])
  ];

  return (
    <div className="space-y-3">
      <div className={cn("grid gap-3", tiles.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardContent className="space-y-1 px-4 py-4">
              <p className="text-muted-foreground text-sm">{tile.label}</p>
              <p className="text-3xl font-semibold">{tile.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        {preview.sampled
          ? t("previewSampled", {
              rows: preview.rows.length,
              seed: preview.random_state,
              total: preview.total_rows
            })
          : t("previewFull", { total: preview.total_rows })}{" "}
        · {t("previewColumns", { shown: preview.displayed_columns.length, total: preview.total_columns })}
      </p>
      <Card className="py-0">
        <CardContent className="max-h-[32rem] overflow-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                {preview.displayed_columns.map((column) => {
                  const stat = stats.get(column);
                  const s = (stat?.stats ?? {}) as Record<string, unknown>;
                  return (
                    <TableHead key={column} className="min-w-28">
                      <div>
                        <p className="font-medium">{column}</p>
                        <p className="text-muted-foreground text-[10px] font-normal">
                          {stat?.dtype_interpreted} ·{" "}
                          {typeof s.unique_count === "number"
                            ? `${s.unique_count} ${t("statUnique")}`
                            : null}
                          {typeof s.mean === "number" ? ` · ${t("statMean")} ${Number(s.mean).toFixed(2)}` : null}
                        </p>
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.map((row, index) => (
                <TableRow key={index}>
                  {preview.displayed_columns.map((column) => (
                    <TableCell key={column} className="max-w-48 truncate text-xs">
                      {(row as Record<string, unknown>)[column] === null
                        ? "—"
                        : String((row as Record<string, unknown>)[column])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
