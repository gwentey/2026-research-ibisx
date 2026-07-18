"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CheckIcon, ChevronRightIcon, MinusIcon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle
} from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { EthicalCriteriaGrid } from "@/components/ibis/datasets/ethical-criteria-grid";
import type { DatasetDetail, SimilarDataset } from "@/lib/api/generated";
import { formatCount, scoreColorClass } from "@/lib/datasets/constants";
import { primaryDomainVisual } from "@/lib/datasets/domain-visuals";
import { cn } from "@/lib/utils";

function IndicatorRow({ label, value }: { label: string; value: boolean | null }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {value === true ? (
        <CheckIcon className="size-4 shrink-0 text-green-600 dark:text-green-400" />
      ) : value === false ? (
        <XIcon className="size-4 shrink-0 text-red-600 dark:text-red-400" />
      ) : (
        <MinusIcon className="text-muted-foreground size-4 shrink-0" />
      )}
      <span className={value === null ? "text-muted-foreground" : ""}>{label}</span>
    </div>
  );
}

export function OverviewTab({
  dataset,
  similar
}: {
  dataset: DatasetDetail;
  similar: SimilarDataset[];
}) {
  const t = useTranslations("datasets.detail");
  const locale = useLocale();
  const ethicalPercent = Math.round(dataset.ethical_score * 100);

  const infoRows: [string, string | null][] = [
    [t("objective"), dataset.objective],
    [t("sources"), dataset.sources],
    [t("availability"), dataset.availability]
  ];

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <EthicalCriteriaGrid dataset={dataset} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("technicalSheet")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {infoRows.map(([label, value]) =>
            value ? (
              <div key={label}>
                <p className="text-muted-foreground text-xs font-medium uppercase">{label}</p>
                <p className="mt-0.5">{value}</p>
              </div>
            ) : null
          )}
          <div className="flex flex-wrap gap-3">
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

          {dataset.representativity_level || dataset.sample_balance_level ? (
            <>
              <Separator />
              <div className="grid gap-3 sm:grid-cols-2">
                {dataset.representativity_level ? (
                  <div>
                    <p className="text-muted-foreground text-xs font-medium uppercase">
                      {t("representativity")}
                    </p>
                    <Badge variant="secondary" className="mt-1 capitalize">
                      {dataset.representativity_level}
                    </Badge>
                    {dataset.representativity_description ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {dataset.representativity_description}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {dataset.sample_balance_level ? (
                  <div>
                    <p className="text-muted-foreground text-xs font-medium uppercase">
                      {t("sampleBalance")}
                    </p>
                    <Badge variant="secondary" className="mt-1 capitalize">
                      {dataset.sample_balance_level.replace(/_/g, " ")}
                    </Badge>
                    {dataset.sample_balance_description ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {dataset.sample_balance_description}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          <Separator />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <IndicatorRow label={t("indicatorSplit")} value={dataset.split} />
            <IndicatorRow label={t("indicatorAnonymized")} value={dataset.anonymization_applied} />
            <IndicatorRow label={t("indicatorTemporal")} value={dataset.temporal_factors} />
            <IndicatorRow
              label={t("indicatorMetadata")}
              value={dataset.metadata_provided_with_dataset}
            />
          </div>

          {dataset.features_description ? (
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase">
                {t("featuresDescription")}
              </p>
              <p className="mt-0.5">{dataset.features_description}</p>
            </div>
          ) : null}

          {dataset.has_missing_values ? (
            <div className="space-y-1">
              {dataset.missing_values_handling_method ? (
                <p>
                  <span className="text-muted-foreground text-xs font-medium uppercase">
                    {t("missingHandling")}
                  </span>{" "}
                  <span>{dataset.missing_values_handling_method}</span>
                </p>
              ) : null}
              {dataset.missing_values_description ? (
                <p className="text-muted-foreground text-xs">{dataset.missing_values_description}</p>
              ) : null}
            </div>
          ) : null}

          <p className="text-muted-foreground pt-1 text-xs">
            {t("addedOn", { date: formatDate(dataset.created_at) })}
            {dataset.updated_at !== dataset.created_at
              ? ` · ${t("updatedOn", { date: formatDate(dataset.updated_at) })}`
              : ""}
          </p>
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

      {similar.length > 0 ? (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("similar")}</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <ItemGroup>
              {similar.map(({ dataset: candidate, reason }, index) => {
                const visual = primaryDomainVisual(candidate.domain);
                return (
                  <div key={candidate.id}>
                    <Item asChild>
                      <Link href={`/datasets/${candidate.id}`}>
                        <ItemMedia
                          variant="icon"
                          className={cn("rounded-lg border-0", visual.tone.bgTile, visual.tone.text)}>
                          <visual.icon />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>{candidate.display_name}</ItemTitle>
                          <ItemDescription>
                            {t(`reason.${reason}`)} · {formatCount(candidate.instances_number)} ·{" "}
                            <span className={scoreColorClass(Math.round(candidate.ethical_score * 100))}>
                              {Math.round(candidate.ethical_score * 100)}%
                            </span>
                          </ItemDescription>
                        </ItemContent>
                        <ItemActions>
                          <ChevronRightIcon className="text-muted-foreground size-4" />
                        </ItemActions>
                      </Link>
                    </Item>
                    {index < similar.length - 1 ? <ItemSeparator /> : null}
                  </div>
                );
              })}
            </ItemGroup>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
