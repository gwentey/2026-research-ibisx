"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CalendarIcon, ColumnsIcon, DropletIcon, RowsIcon, ShieldCheckIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type { DatasetCard as DatasetCardData } from "@/lib/api/generated";
import { formatCount, scoreColorClass } from "@/lib/datasets/constants";

const MAX_TAGS = 3;

export function DatasetCard({ dataset }: { dataset: DatasetCardData }) {
  const t = useTranslations("datasets.card");
  const ethicalPercent = Math.round(dataset.ethical_score * 100);
  const tags = [...dataset.domain, ...dataset.task];

  return (
    <Card className="flex h-full flex-col gap-4">
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/datasets/${dataset.id}`}
            className="line-clamp-1 font-semibold hover:underline">
            {dataset.display_name}
          </Link>
          <Badge variant="outline">
            {dataset.access === "public" ? t("public") : t("private")}
          </Badge>
        </div>
        <div className="text-muted-foreground flex items-center gap-3 text-xs">
          {dataset.year ? (
            <span className="flex items-center gap-1">
              <CalendarIcon className="size-3" />
              {dataset.year}
            </span>
          ) : null}
          <span className={`flex items-center gap-1 font-medium ${scoreColorClass(ethicalPercent)}`}>
            <ShieldCheckIcon className="size-3" />
            {t("ethical")} {ethicalPercent}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {dataset.objective ? (
          <p className="text-muted-foreground line-clamp-2 text-sm">{dataset.objective}</p>
        ) : null}
        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="flex items-center gap-1">
            <RowsIcon className="size-3" />
            {formatCount(dataset.instances_number)} {t("instances")}
          </span>
          <span className="flex items-center gap-1">
            <ColumnsIcon className="size-3" />
            {formatCount(dataset.features_number)} {t("features")}
          </span>
          {dataset.global_missing_percentage !== null &&
          dataset.global_missing_percentage !== undefined ? (
            <span className="flex items-center gap-1">
              <DropletIcon className="size-3" />
              {dataset.global_missing_percentage}% {t("missing")}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {dataset.split ? <Badge variant="secondary">{t("split")}</Badge> : null}
          {dataset.anonymization_applied ? (
            <Badge variant="secondary">{t("anonymized")}</Badge>
          ) : null}
          {dataset.temporal_factors ? <Badge variant="secondary">{t("temporal")}</Badge> : null}
          {tags.slice(0, MAX_TAGS).map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
          {tags.length > MAX_TAGS ? (
            <Badge variant="outline">{t("moreTags", { count: tags.length - MAX_TAGS })}</Badge>
          ) : null}
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href={`/datasets/${dataset.id}`}>{t("view")}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
