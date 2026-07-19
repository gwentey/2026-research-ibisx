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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DatasetAttribution } from "@/components/ibis/datasets/dataset-attribution";
import { DomainPattern } from "@/components/ibis/datasets/domain-pattern";
import { ProgressRing } from "@/components/ibis/progress-ring";
import type { DatasetCard as DatasetCardData } from "@/lib/api/generated";
import { formatCount, scoreColorClass } from "@/lib/datasets/constants";
import { primaryDomainVisual } from "@/lib/datasets/domain-visuals";
import { cn } from "@/lib/utils";

// Signature « cartes tonales texturées par domaine » (docs/refonte/05-catalogue.md) :
// vignette gradient + motif SVG + tuile-icône propres au domaine, score éthique en
// médaillon chevauchant (ProgressRing des fondations), pied stable (date de MAJ +
// bouton « Voir la fiche » outline, flèche animée). Card/CardHeader/CardContent/CardFooter
// conservés (data-slot="card").

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
      {/* Vignette d'en-tête : fond de COULEUR UNIE et douce, propre au domaine (au lieu du
          gris). Motif de formes en filigrane neutre + tuile-icône blanche pour ressortir sur
          la couleur, dans les deux thèmes. */}
      <div className={cn("relative h-24 overflow-hidden", visual.vignette)}>
        <DomainPattern pattern={visual.pattern} className="text-foreground/[0.08]" />
        <div className="bg-background/80 text-foreground absolute top-4 left-4 flex size-9 items-center justify-center rounded-lg shadow-sm backdrop-blur-sm">
          <DomainIcon className="size-5" />
        </div>
        <Badge
          variant="outline"
          className="bg-background/85 absolute top-3 right-3 backdrop-blur-sm">
          {dataset.access === "public" ? t("public") : t("private")}
        </Badge>
      </div>

      {/* Médaillon de score éthique, chevauchant la vignette (ProgressRing du wizard).
          Libellé « Éthique » VISIBLE à côté + tooltip explicatif : on ne laisse plus un
          pourcentage nu sans dire ce qu'il mesure (plateforme éducative). */}
      <div className="-mt-7 flex items-end gap-2.5 px-5">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="bg-background relative flex size-14 cursor-help items-center justify-center rounded-full border shadow-sm">
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
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{t("ethicalHint")}</TooltipContent>
        </Tooltip>
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

      <CardContent className="flex-1 space-y-3 pb-5">
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

        {/* Provenance : badge « Vérifié » pour le catalogue curé, sinon avatar + pseudo de
            l'importeur. L'attribution est le garde-fou social du catalogue ouvert. */}
        <DatasetAttribution
          owner={dataset.owner}
          isVerified={dataset.is_verified}
          className="mt-3"
        />
      </CardContent>

      {/* Pied stable : date de MAJ à gauche, bouton « Voir la fiche » (outline) aligné à
          droite sur le filet. Flèche qui se translate au survol de la carte. */}
      <CardFooter className="justify-between border-t">
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <ClockIcon className="size-3" />
          {t("updatedAgo", { date: new Date(dataset.updated_at).toLocaleDateString(locale) })}
        </span>
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link href={`/datasets/${dataset.id}`}>
            {t("viewCard")}
            <ArrowRightIcon className="size-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
