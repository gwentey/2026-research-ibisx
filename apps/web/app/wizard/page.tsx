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
import { MissionStepper } from "@/components/ibis/mission-stepper";
import {
  Step1Overview,
  Step2Target,
  Step3Cleaning,
  Step4Split,
  Step5Prep
} from "@/components/ibis/wizard/steps-1-5";
import { Step6Algorithm, Step7Hyperparameters, Step8Launch } from "@/components/ibis/wizard/steps-6-8";
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
import { cn } from "@/lib/utils";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div className="mx-auto mt-10 max-w-4xl space-y-4 px-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const steps = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MissionStepper current="training" />
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${projectId}`}>{t("backToProject")}</Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{dataset.display_name}</p>
      </div>

      {/* Stepper horizontal persistant — navigation libre sur les étapes déjà validées */}
      <nav className="flex flex-wrap gap-1">
        {steps.map((step) => (
          <button
            key={step}
            type="button"
            disabled={step > store.maxReachedStep}
            onClick={() => store.goTo(step)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              step === store.step
                ? "border-primary bg-primary text-primary-foreground font-medium"
                : step <= store.maxReachedStep
                  ? "hover:bg-muted"
                  : "text-muted-foreground/50 cursor-not-allowed"
            )}>
            {step}. {t(`steps.${step}` as never)}
          </button>
        ))}
      </nav>

      {store.step === 1 ? (
        <Step1Overview dataset={dataset} preview={preview} quality={quality} onNext={advance} />
      ) : null}
      {store.step === 2 ? (
        <Step2Target dataset={dataset} preview={preview} quality={quality} onNext={advance} />
      ) : null}
      {store.step === 3 ? <Step3Cleaning quality={quality} onNext={advance} /> : null}
      {store.step === 4 ? <Step4Split quality={quality} onNext={advance} /> : null}
      {store.step === 5 ? <Step5Prep quality={quality} onNext={advance} /> : null}
      {store.step === 6 ? (
        <Step6Algorithm algorithms={algorithms} quality={quality} onNext={advance} />
      ) : null}
      {store.step === 7 ? <Step7Hyperparameters algorithms={algorithms} onNext={advance} /> : null}
      {store.step >= 8 ? <Step8Launch dataset={dataset} /> : null}
    </div>
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
