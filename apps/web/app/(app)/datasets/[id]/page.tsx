"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PencilIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FilesTab } from "@/components/ibis/datasets/files-tab";
import { GuideTab } from "@/components/ibis/datasets/guide-tab";
import { OverviewTab } from "@/components/ibis/datasets/overview-tab";
import { PreviewTab } from "@/components/ibis/datasets/preview-tab";
import { getDataset, getSimilarDatasets } from "@/lib/api/generated";
import type { DatasetDetail, SimilarDataset } from "@/lib/api/generated";
import { formatCount, scoreColorClass } from "@/lib/datasets/constants";
import { useAuthStore } from "@/lib/auth/store";

export default function DatasetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("datasets");
  const td = useTranslations("datasets.detail");
  const tCommon = useTranslations("common");
  const user = useAuthStore((state) => state.user);
  const [dataset, setDataset] = useState<DatasetDetail | null>(null);
  const [similar, setSimilar] = useState<SimilarDataset[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
    const [detailResult, similarResult] = await Promise.all([
      getDataset({ path: { dataset_id: id }, throwOnError: false }),
      getSimilarDatasets({ path: { dataset_id: id }, throwOnError: false })
    ]);
    if (!detailResult.data) {
      setState("error");
      return;
    }
    setDataset(detailResult.data);
    setSimilar(similarResult.data ?? []);
    setState("ready");
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (state === "error" || !dataset) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between py-6">
          <span>{t("error.title")}</span>
          <Button variant="outline" onClick={() => void load()}>
            {tCommon("retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const ethicalPercent = Math.round(dataset.ethical_score * 100);
  const canEdit =
    user?.role === "admin" || (user !== null && dataset.created_by === user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{dataset.display_name}</h1>
            <Badge variant="outline">
              {dataset.access === "public" ? t("card.public") : t("card.private")}
            </Badge>
            <Badge variant="secondary" className={scoreColorClass(ethicalPercent)}>
              {t("card.ethical")} {ethicalPercent}%
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {dataset.year ? `${dataset.year} · ` : ""}
            {formatCount(dataset.instances_number)} {t("card.instances")} ·{" "}
            {formatCount(dataset.features_number)} {t("card.features")} ·{" "}
            {dataset.global_missing_percentage ?? 0}% {t("card.missing")}
          </p>
          <div className="flex flex-wrap gap-1">
            {[...dataset.domain, ...dataset.task].map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit ? (
            <Button variant="outline" asChild>
              <Link href={`/datasets/${dataset.id}/complete`}>
                <PencilIcon />
                {td("edit")}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{td("tabOverview")}</TabsTrigger>
          <TabsTrigger value="files">{td("tabFiles")}</TabsTrigger>
          <TabsTrigger value="preview">{td("tabPreview")}</TabsTrigger>
          <TabsTrigger value="guide">{td("tabGuide")}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab dataset={dataset} similar={similar} />
        </TabsContent>
        <TabsContent value="files">
          <FilesTab dataset={dataset} />
        </TabsContent>
        <TabsContent value="preview">
          <PreviewTab datasetId={dataset.id} />
        </TabsContent>
        <TabsContent value="guide">
          <GuideTab dataset={dataset} onDatasetRefresh={setDataset} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
