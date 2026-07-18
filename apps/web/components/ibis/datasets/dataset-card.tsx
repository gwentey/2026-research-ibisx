"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRightIcon,
  CalendarIcon,
  ClockIcon,
  ColumnsIcon,
  DropletIcon,
  HistoryIcon,
  QuoteIcon,
  RowsIcon,
  ShieldCheckIcon,
  SplitIcon
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { DomainPattern } from "@/components/ibis/datasets/domain-pattern";
import { ProgressRing } from "@/components/ibis/progress-ring";
import type { DatasetCard as DatasetCardData } from "@/lib/api/generated";
import { formatCount, scoreColorClass } from "@/lib/datasets/constants";
import { primaryDomainVisual } from "@/lib/datasets/domain-visuals";
import { cn } from "@/lib/utils";

// Signature « cartes tonales texturées par domaine » (docs/refonte/05-catalogue.md) :
// vignette gradient + motif SVG + tuile-icône + monogramme fantôme propres au domaine,
// score éthique en médaillon chevauchant (ProgressRing des fondations), footer à
// révélation hover. Card/CardHeader/CardContent/CardFooter conservés (data-slot="card").

const MAX_TAGS = 3;

export function DatasetCard({ dataset }: { dataset: DatasetCardData }) {
  const t = useTranslations("datasets.card");
  const tDatasets = useTranslations("datasets");
  const locale = useLocale();
  const ethicalPercent = Math.round(dataset.ethical_score * 100);
  const visual = primaryDomainVisual(dataset.domain);
  const DomainIcon = visual.icon;
  // domain[0] porte la vignette ; le reste (autres domaines + tâches) reste en tags.
  const extraTags = [...dataset.domain.slice(1), ...dataset.task];

  return (
    <Card className="group gap-0 overflow-hidden pt-0 transition-shadow hover:shadow-md">
      {/* Vignette d'en-tête tonale du domaine */}
      <div
        className={cn(
          "relative h-24 overflow-hidden bg-gradient-to-br to-transparent",
          visual.tone.bgSoft,
          visual.tone.gradientFrom
        )}>
        <DomainPattern pattern={visual.pattern} className={visual.tone.patternText} />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-3 -right-3 text-6xl leading-none font-black opacity-10 select-none",
            visual.tone.text
          )}>
          {visual.monogram}
        </span>
        <div
          className={cn(
            "absolute top-4 left-4 flex size-9 items-center justify-center rounded-lg",
            visual.tone.bgTile,
            visual.tone.text
          )}>
          <DomainIcon className="size-5" />
        </div>
        <Badge
          variant="outline"
          className="bg-background/85 absolute top-3 right-3 backdrop-blur-sm">
          {dataset.access === "public" ? t("public") : t("private")}
        </Badge>
      </div>

      {/* Médaillon de score éthique, chevauchant la vignette (ProgressRing du wizard) */}
      <div className="-mt-7 flex px-5">
        <div className="bg-background relative flex size-14 items-center justify-center rounded-full border shadow-sm">
          <ProgressRing
            value={ethicalPercent}
            size={56}
            strokeWidth={4}
            trackClassName="stroke-border"
            progressClassName="stroke-current"
            className={scoreColorClass(ethicalPercent)}
          />
          <span
            className={cn(
              "absolute inset-0 grid place-items-center text-[11px] font-bold",
              scoreColorClass(ethicalPercent)
            )}>
            {ethicalPercent}%
          </span>
        </div>
      </div>

      <CardHeader className="gap-1 pt-2">
        <Link
          href={`/datasets/${dataset.id}`}
          className="line-clamp-1 font-semibold hover:underline">
          {dataset.display_name}
        </Link>
        <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <DomainIcon className="size-3" />
            {tDatasets(visual.labelKey as never)}
          </span>
          {dataset.year ? (
            <span className="flex items-center gap-1">
              <CalendarIcon className="size-3" />
              {dataset.year}
            </span>
          ) : null}
          {dataset.num_citations > 0 ? (
            <span className="flex items-center gap-1">
              <QuoteIcon className="size-3" />
              {dataset.num_citations} {t("citations")}
            </span>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        {dataset.objective ? (
          <p className="text-muted-foreground line-clamp-2 text-sm">{dataset.objective}</p>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="gap-1 font-normal">
            <RowsIcon className="size-3" />
            {formatCount(dataset.instances_number)} {t("instances")}
          </Badge>
          <Badge variant="outline" className="gap-1 font-normal">
            <ColumnsIcon className="size-3" />
            {formatCount(dataset.features_number)} {t("features")}
          </Badge>
          {dataset.global_missing_percentage !== null &&
          dataset.global_missing_percentage !== undefined ? (
            <Badge variant="outline" className="gap-1 font-normal">
              <DropletIcon className="size-3" />
              {dataset.global_missing_percentage}% {t("missing")}
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {dataset.split ? (
            <Badge variant="secondary" className="gap-1 font-normal">
              <SplitIcon className="size-3" />
              {t("split")}
            </Badge>
          ) : null}
          {dataset.anonymization_applied ? (
            <Badge variant="secondary" className="gap-1 font-normal">
              <ShieldCheckIcon className="size-3" />
              {t("anonymized")}
            </Badge>
          ) : null}
          {dataset.temporal_factors ? (
            <Badge variant="secondary" className="gap-1 font-normal">
              <HistoryIcon className="size-3" />
              {t("temporal")}
            </Badge>
          ) : null}
          {extraTags.slice(0, MAX_TAGS).map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
          {extraTags.length > MAX_TAGS ? (
            <Badge variant="outline">
              {t("moreTags", { count: extraTags.length - MAX_TAGS })}
            </Badge>
          ) : null}
        </div>
      </CardContent>

      {/* Footer à révélation hover : date de MAJ → bouton "Voir" plein-largeur */}
      <CardFooter className="relative h-10 border-t p-0">
        <div className="text-muted-foreground absolute inset-0 flex items-center gap-1.5 px-5 text-xs transition-opacity duration-200 group-hover:opacity-0">
          <ClockIcon className="size-3" />
          {t("updatedAgo", { date: new Date(dataset.updated_at).toLocaleDateString(locale) })}
        </div>
        <div className="absolute inset-0 flex items-center px-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <Button asChild size="sm" className="w-full">
            <Link href={`/datasets/${dataset.id}`}>
              {t("view")}
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
