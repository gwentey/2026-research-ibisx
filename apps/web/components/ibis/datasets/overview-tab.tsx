"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckIcon, MinusIcon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { DatasetDetail, SimilarDataset } from "@/lib/api/generated";
import { ETHICAL_KEYS, formatCount, scoreColorClass } from "@/lib/datasets/constants";

function TristateIcon({ value }: { value: boolean | null }) {
  if (value === true) return <CheckIcon className="size-4 text-green-600 dark:text-green-400" />;
  if (value === false) return <XIcon className="size-4 text-red-600 dark:text-red-400" />;
  return <MinusIcon className="text-muted-foreground size-4" />;
}

export function OverviewTab({
  dataset,
  similar
}: {
  dataset: DatasetDetail;
  similar: SimilarDataset[];
}) {
  const t = useTranslations("datasets.detail");
  const te = useTranslations("datasets.ethics");
  const ethicalPercent = Math.round(dataset.ethical_score * 100);

  const infoRows: [string, string | null][] = [
    [t("objective"), dataset.objective],
    [t("sources"), dataset.sources],
    [t("availability"), dataset.availability]
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("generalInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {infoRows.map(([label, value]) =>
            value ? (
              <div key={label}>
                <p className="text-muted-foreground text-xs font-medium uppercase">{label}</p>
                <p className="mt-0.5">{value}</p>
              </div>
            ) : null
          )}
          <div className="flex flex-wrap gap-3 pt-1">
            {dataset.storage_uri ? (
              <a
                href={dataset.storage_uri}
                target="_blank"
                rel="noreferrer"
                className="text-sm underline">
                {t("externalLink")}
              </a>
            ) : null}
            {dataset.documentation_link ? (
              <a
                href={dataset.documentation_link}
                target="_blank"
                rel="noreferrer"
                className="text-sm underline">
                {t("docLink")}
              </a>
            ) : null}
            {dataset.citation_link ? (
              <a
                href={dataset.citation_link}
                target="_blank"
                rel="noreferrer"
                className="text-sm underline">
                {t("citationLink")}
              </a>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("qualityMetrics")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {dataset.completeness !== null && dataset.completeness !== undefined ? (
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>{t("completeness")}</span>
                <span className="font-medium">{dataset.completeness}%</span>
              </div>
              <Progress value={dataset.completeness} />
            </div>
          ) : null}
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>{t("ethicalScore")}</span>
              <span className={`font-medium ${scoreColorClass(ethicalPercent)}`}>
                {ethicalPercent}%
              </span>
            </div>
            <Progress value={ethicalPercent} />
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">{t("ethicalCompliance")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {ETHICAL_KEYS.map((key) => {
              const value = (dataset.ethical_criteria as Record<string, boolean | null>)[key];
              return (
                <div key={key} className="flex items-start gap-2 rounded-md border p-2">
                  <TristateIcon value={value ?? null} />
                  <div>
                    <p className="text-sm leading-tight">{te(key)}</p>
                    <p className="text-muted-foreground text-xs">
                      {value === true
                        ? te("present")
                        : value === false
                          ? te("absent")
                          : te("unknown")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {similar.length > 0 ? (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("similar")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map(({ dataset: candidate, reason }) => (
              <Link
                key={candidate.id}
                href={`/datasets/${candidate.id}`}
                className="hover:bg-muted rounded-md border p-3">
                <p className="font-medium">{candidate.display_name}</p>
                <p className="text-muted-foreground text-xs">
                  {t(`reason.${reason}`)} · {formatCount(candidate.instances_number)} ·{" "}
                  {Math.round(candidate.ethical_score * 100)}%
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {candidate.domain.slice(0, 2).map((domain) => (
                    <Badge key={domain} variant="outline">
                      {domain}
                    </Badge>
                  ))}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
