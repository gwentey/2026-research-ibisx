"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AppGuard } from "@/components/ibis/auth-guard";
import { WizardShell } from "@/components/ibis/wizard/wizard-shell";
import {
  Step1Overview,
  Step2Target,
  Step3Cleaning,
  Step4Split,
  Step5Prep,
  cleaningBlockingColumns,
  targetMeta
} from "@/components/ibis/wizard/steps-1-5";
import {
  Step6Algorithm,
  Step7Hyperparameters,
  Step8Launch
} from "@/components/ibis/wizard/steps-6-8";
import {
  getDataset,
  getDraft,
  getQualityAnalysis,
  listAlgorithms,
  previewDataset,
  upsertDraft
} from "@/lib/api/generated";
import type { DatasetDetail, DatasetPreview } from "@/lib/api/generated";
import { serializeDraft, useWizardStore } from "@/lib/wizard/store";

export interface QualityData {
  quality_score: number;
  analysis: {
    row_count: number;
    column_count: number;
    columns: {
      name: string;
      is_numeric: boolean;
      missing_count: number;
      missing_percentage: number;
      unique_count: number;
      distribution: string;
      outliers: { count: number; percentage: number };
      recommended_strategy: string | null;
    }[];
    columns_to_clean: string[];
  };
  column_recommendations: Record<string, string>;
}

function WizardInner() {
  const t = useTranslations("wizard");
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const datasetId = searchParams.get("datasetId");
  const store = useWizardStore();
  const [dataset, setDataset] = useState<DatasetDetail | null>(null);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [quality, setQuality] = useState<QualityData | null>(null);
  const [algorithms, setAlgorithms] = useState<Record<string, unknown>[]>([]);
  const [ready, setReady] = useState(false);
  const [navLocked, setNavLocked] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!projectId || !datasetId) return;
    store.init(projectId, datasetId);
    const load = async () => {
      const [datasetResult, previewResult, qualityResult, algorithmsResult, draftResult] =
        await Promise.all([
          getDataset({ path: { dataset_id: datasetId }, throwOnError: false }),
          previewDataset({ path: { dataset_id: datasetId }, throwOnError: false }),
          getQualityAnalysis({ path: { dataset_id: datasetId }, throwOnError: false }),
          listAlgorithms({ throwOnError: false }),
          getDraft({
            query: { project_id: projectId, dataset_id: datasetId },
            throwOnError: false
          })
        ]);
      setDataset(datasetResult.data ?? null);
      setPreview(previewResult.data ?? null);
      setQuality((qualityResult.data as QualityData | undefined) ?? null);
      setAlgorithms((algorithmsResult.data as Record<string, unknown>[] | undefined) ?? []);
      const draft = draftResult.data;
      if (draft?.draft_state && !hydratedRef.current) {
        hydratedRef.current = true;
        useWizardStore.getState().hydrate(draft.draft_state as never);
        useWizardStore.getState().set("experimentId", draft.id);
        toast.info(t("draftResumed"));
      }
      setReady(true);
    };
    void load();
  }, [projectId, datasetId]);

  const saveDraft = useCallback(async () => {
    const state = useWizardStore.getState();
    if (!state.projectId || !state.datasetId) return;
    await upsertDraft({
      body: {
        project_id: state.projectId,
        dataset_id: state.datasetId,
        state: serializeDraft(state)
      },
      throwOnError: false
    });
  }, []);

  const advance = useCallback(() => {
    useWizardStore.getState().nextStep();
    void saveDraft(); // brouillon persisté à chaque étape validée (P5)
  }, [saveDraft]);

  if (!projectId || !datasetId) {
    return (
      <Card className="mx-auto mt-16 max-w-lg">
        <CardContent className="space-y-3 py-8 text-center">
          <p className="text-sm">{t("missingContext")}</p>
          <Button asChild variant="outline">
            <Link href="/projects">{t("backToProject")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (!ready || !dataset) {
    return (
      <div className="bg-muted/30 flex min-h-screen">
        <div className="bg-background hidden w-64 shrink-0 border-r p-5 lg:block">
          <Skeleton className="h-8 w-full" />
          <div className="mt-8 space-y-3">
            {[...Array(9)].map((_, index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        </div>
        <div className="mx-auto mt-10 w-full max-w-4xl space-y-4 px-4">
          <Skeleton className="h-12 w-1/2" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  // Validation centralisée : pilote le bouton « Étape suivante » de la barre basse
  const canNext = (() => {
    switch (store.step) {
      case 2: {
        const meta = targetMeta(dataset, quality, store);
        return Boolean(store.targetColumn) && Boolean(store.taskType) && !meta.blocking;
      }
      case 3:
        return cleaningBlockingColumns(quality, store).length === 0;
      case 6:
        return Boolean(store.algorithm);
      default:
        return true;
    }
  })();

  return (
    <WizardShell
      step={store.step}
      maxReachedStep={store.maxReachedStep}
      datasetName={dataset.display_name}
      projectId={projectId}
      canNext={canNext}
      navLocked={navLocked}
      onGoTo={(step) => store.goTo(step)}
      onNext={advance}>
      {store.step === 1 ? (
        <Step1Overview dataset={dataset} preview={preview} quality={quality} onNext={advance} />
      ) : null}
      {store.step === 2 ? (
        <Step2Target dataset={dataset} preview={preview} quality={quality} />
      ) : null}
      {store.step === 3 ? <Step3Cleaning quality={quality} /> : null}
      {store.step === 4 ? <Step4Split quality={quality} /> : null}
      {store.step === 5 ? <Step5Prep quality={quality} /> : null}
      {store.step === 6 ? <Step6Algorithm algorithms={algorithms} quality={quality} /> : null}
      {store.step === 7 ? <Step7Hyperparameters algorithms={algorithms} /> : null}
      {store.step >= 8 ? <Step8Launch dataset={dataset} onLockChange={setNavLocked} /> : null}
    </WizardShell>
  );
}

export default function WizardPage() {
  return (
    <AppGuard>
      <Suspense fallback={<Skeleton className="mx-auto mt-16 h-96 w-full max-w-4xl" />}>
        <WizardInner />
      </Suspense>
    </AppGuard>
  );
}
