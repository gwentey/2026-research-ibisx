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

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
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
