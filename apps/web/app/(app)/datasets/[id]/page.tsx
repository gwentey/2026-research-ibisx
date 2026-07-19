"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ClipboardListIcon, FolderIcon, SparklesIcon, TableIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatasetDetailHeader } from "@/components/ibis/datasets/dataset-detail-header";
import { DatasetHowToUse } from "@/components/ibis/datasets/dataset-how-to-use";
import { FilesTab } from "@/components/ibis/datasets/files-tab";
import { GuideTab } from "@/components/ibis/datasets/guide-tab";
import { OverviewTab } from "@/components/ibis/datasets/overview-tab";
import { PreviewTab } from "@/components/ibis/datasets/preview-tab";
import { getDataset, getSimilarDatasets } from "@/lib/api/generated";
import type { DatasetDetail, SimilarDataset } from "@/lib/api/generated";
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

  const canEdit =
    user?.role === "admin" || (user !== null && dataset.created_by === user.id);

  return (
    <div className="space-y-6">
      <DatasetDetailHeader dataset={dataset} canEdit={canEdit} />

      {/* Guide éducatif « Comment utiliser ce dataset ? » (remplace l'ancien « Où situer ce
          dataset », jugé déroutant) : parcours en 3 temps qui APPREND quoi faire ensuite. */}
      <DatasetHowToUse />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">
            <ClipboardListIcon />
            {td("tabOverview")}
          </TabsTrigger>
          <TabsTrigger value="files">
            <FolderIcon />
            {td("tabFiles")}
          </TabsTrigger>
          <TabsTrigger value="preview">
            <TableIcon />
            {td("tabPreview")}
          </TabsTrigger>
          <TabsTrigger value="guide">
            <SparklesIcon />
            {td("tabGuide")}
          </TabsTrigger>
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
