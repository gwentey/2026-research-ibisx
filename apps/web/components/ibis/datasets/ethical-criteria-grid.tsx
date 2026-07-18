"use client";

import { useTranslations } from "next-intl";
import { CheckIcon, MinusIcon, XIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DatasetDetail } from "@/lib/api/generated";
import { ETHICAL_KEYS } from "@/lib/datasets/constants";
import { cn } from "@/lib/utils";

// Grille tristate héroïque (P6, cœur pédagogique) : les 10 critères éthiques (ETHICAL_KEYS)
// avec un résumé chiffré et une mini-barre segmentée en tête. Couleurs sémantiques reprises
// telles quelles de l'ancien TristateIcon (overview-tab) — aucune teinte inventée.
export function EthicalCriteriaGrid({ dataset }: { dataset: DatasetDetail }) {
  const t = useTranslations("datasets.detail");
  const te = useTranslations("datasets.ethics");
  const criteria = dataset.ethical_criteria as Record<string, boolean | null>;
  const values = ETHICAL_KEYS.map((key) => criteria[key] ?? null);
  const confirmed = values.filter((value) => value === true).length;
  const absent = values.filter((value) => value === false).length;
  const unknown = values.length - confirmed - absent;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <CardTitle className="text-base">{t("ethicalCompliance")}</CardTitle>
          <p className="text-muted-foreground text-sm">
            {t("ethicsSummary", { confirmed })}
            {absent > 0 ? ` · ${t("ethicsAbsentCount", { count: absent })}` : ""}
            {unknown > 0 ? ` · ${t("ethicsUnknownCount", { count: unknown })}` : ""}
          </p>
        </div>
        <div className="bg-muted flex h-2 w-full overflow-hidden rounded-full">
          {confirmed > 0 ? (
            <div
              className="bg-green-600/70 dark:bg-green-400/70"
              style={{ width: `${(confirmed / ETHICAL_KEYS.length) * 100}%` }}
            />
          ) : null}
          {absent > 0 ? (
            <div
              className="bg-red-600/70 dark:bg-red-400/70"
              style={{ width: `${(absent / ETHICAL_KEYS.length) * 100}%` }}
            />
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {ETHICAL_KEYS.map((key) => {
            const value = criteria[key] ?? null;
            return (
              <div key={key} className="flex items-start gap-3 rounded-lg border p-3">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg",
                    value === null ? "bg-muted" : "bg-foreground/5"
                  )}>
                  {value === true ? (
                    <CheckIcon className="size-4 text-green-600 dark:text-green-400" />
                  ) : value === false ? (
                    <XIcon className="size-4 text-red-600 dark:text-red-400" />
                  ) : (
                    <MinusIcon className="text-muted-foreground size-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm leading-tight">{te(key)}</p>
                  <p className="text-muted-foreground text-xs">
                    {value === true ? te("present") : value === false ? te("absent") : te("unknown")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
