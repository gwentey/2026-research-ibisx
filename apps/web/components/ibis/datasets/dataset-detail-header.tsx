"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, ChevronLeftIcon, DownloadIcon, PencilIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { DomainPattern } from "@/components/ibis/datasets/domain-pattern";
import { downloadDatasetFile } from "@/lib/api/generated";
import type { DatasetDetail } from "@/lib/api/generated";
import { formatCount, scoreColorClass } from "@/lib/datasets/constants";
import { primaryDomainVisual } from "@/lib/datasets/domain-visuals";
import { cn } from "@/lib/utils";

// Bandeau immersif (P6, signature « fiche produit ») : identité au token du domaine
// (gradient + motif filigrane + médaillon) surmontée de tuiles-stats et des actions
// Télécharger / Modifier / Entraîner. Aucune logique métier — uniquement de la disposition.
export function DatasetDetailHeader({
  dataset,
  canEdit
}: {
  dataset: DatasetDetail;
  canEdit: boolean;
}) {
  const t = useTranslations("datasets");
  const td = useTranslations("datasets.detail");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const visual = primaryDomainVisual(dataset.domain);
  const ethicalPercent = Math.round(dataset.ethical_score * 100);
  const firstFile = dataset.files.find((file) => file.logical_role === "data_file") ?? dataset.files[0];

  // « Utiliser dans un projet » : pré-remplit le formulaire (nom suggéré + critères
  // domaine/tâche du dataset déjà cochés) plutôt que de tout faire resélectionner.
  const useInProjectHref = (() => {
    const params = new URLSearchParams();
    if (dataset.domain.length > 0) params.set("domains", dataset.domain.join(","));
    if (dataset.task.length > 0) params.set("tasks", dataset.task.join(","));
    params.set("name", td("projectFromDataset", { name: dataset.display_name }));
    return `/projects/new?${params.toString()}`;
  })();

  const download = async () => {
    if (!firstFile) return;
    // Téléchargement authentifié via le client généré (même logique que files-tab.tsx)
    const { data } = await downloadDatasetFile({
      path: { dataset_id: dataset.id, file_id: firstFile.id },
      parseAs: "blob",
      throwOnError: false
    });
    if (!(data instanceof Blob)) return;
    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${firstFile.original_filename.replace(/\.[^.]+$/, "")}.parquet`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const stats = [
    { label: t("card.instances"), value: formatCount(dataset.instances_number) },
    { label: t("card.features"), value: formatCount(dataset.features_number) },
    { label: td("files"), value: formatCount(dataset.files.length) },
    { label: t("card.missing"), value: `${dataset.global_missing_percentage ?? 0}%` }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild>
          <Link href="/datasets" aria-label={tCommon("back")}>
            <ChevronLeftIcon />
          </Link>
        </Button>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/datasets">{tNav("datasets")}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="line-clamp-1">{dataset.display_name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-xl border bg-gradient-to-br to-card",
          visual.tone.gradientFrom
        )}>
        <DomainPattern pattern={visual.pattern} className={visual.tone.patternText} />
        {/* Voile de lisibilité : dégradé card→transparent (gauche→droite) posé SOUS le bloc
            texte, AU-DESSUS du motif. Le titre/badges/description reposent sur un fond card
            quasi opaque (contraste net, clair ET sombre) ; le motif reste pleinement visible
            à droite, là où il n'y a pas de texte. On garde ainsi « joli ET lisible ». */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-card via-card/70 to-transparent"
        />
        <div className="relative space-y-3 p-5">
          <div className="flex flex-wrap items-start gap-4">
            <div
              className={cn(
                "flex size-14 shrink-0 items-center justify-center rounded-2xl",
                visual.tone.bgTile,
                visual.tone.text
              )}>
              <visual.icon className="size-6" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">{dataset.display_name}</h1>
                <Badge variant="outline">
                  {dataset.access === "public" ? t("card.public") : t("card.private")}
                </Badge>
                <Badge variant="secondary" className={scoreColorClass(ethicalPercent)}>
                  {t("card.ethical")} {ethicalPercent}%
                </Badge>
              </div>
              {dataset.objective ? (
                <p className="text-muted-foreground max-w-2xl text-sm leading-snug">
                  {dataset.objective}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-1">
                <div className="flex flex-wrap gap-1">
                  {[...dataset.domain, ...dataset.task].map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs whitespace-nowrap">
                  {dataset.year ? `${dataset.year} · ` : ""}
                  {dataset.num_citations} {t("card.citations")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className={cn(
            "grid flex-1 gap-3 text-sm *:space-y-1 *:rounded-md *:border *:p-3 *:text-center",
            "grid-cols-2 sm:grid-cols-4"
          )}>
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl font-semibold">{stat.value}</p>
              <p className="text-muted-foreground text-xs">{stat.label}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {firstFile ? (
            <Button variant="ghost" size="sm" onClick={() => void download()}>
              <DownloadIcon />
              {td("download")}
            </Button>
          ) : null}
          {canEdit ? (
            <Button variant="outline" asChild>
              <Link href={`/datasets/${dataset.id}/complete`}>
                <PencilIcon />
                {td("edit")}
              </Link>
            </Button>
          ) : null}
          <Button asChild>
            <Link href={useInProjectHref}>
              {td("useInProject")}
              <ArrowRightIcon />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
