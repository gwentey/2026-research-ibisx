"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { DownloadIcon, RotateCcwIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MissionStepper } from "@/components/ibis/mission-stepper";
import { XaiTab } from "@/components/ibis/xai/xai-tab";
import {
  ConfusionMatrix,
  ImportanceChart,
  PrCurve,
  RegressionCharts,
  RocCurve,
  TreeView
} from "@/components/ibis/experiments/result-charts";
import {
  downloadModel,
  getExperiment,
  getExperimentLogs,
  getExperimentResults
} from "@/lib/api/generated";
import type { ExperimentResults, ExperimentWithQueue, LogLine } from "@/lib/api/generated";

const METRIC_ORDER = [
  "f1_macro",
  "accuracy",
  "precision_macro",
  "recall_macro",
  "f1_score",
  "precision",
  "recall",
  "roc_auc",
  "pr_auc",
  "oob_score",
  "mae",
  "rmse",
  "mse",
  "r2"
];

export default function ExperimentResultsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("experiments");
  const tCommon = useTranslations("common");
  const [experiment, setExperiment] = useState<ExperimentWithQueue | null>(null);
  const [results, setResults] = useState<ExperimentResults | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    const [experimentResult, resultsResult, logsResult] = await Promise.all([
      getExperiment({ path: { experiment_id: id }, throwOnError: false }),
      getExperimentResults({ path: { experiment_id: id }, throwOnError: false }),
      getExperimentLogs({ path: { experiment_id: id }, throwOnError: false })
    ]);
    if (!experimentResult.data) {
      setState("error");
      return;
    }
    setExperiment(experimentResult.data);
    setResults(resultsResult.data ?? null);
    setLogs(logsResult.data ?? []);
    setState("ready");
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const download = async () => {
    const { data } = await downloadModel({
      path: { experiment_id: id },
      parseAs: "blob",
      throwOnError: false
    });
    if (!(data instanceof Blob)) return;
    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ibisx-model-${id}.joblib`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (state === "loading") return <Skeleton className="h-96 w-full" />;
  if (state === "error" || !experiment) {
    return (
      <Card>
        <CardContent className="py-8 text-center">{tCommon("error")}</CardContent>
      </Card>
    );
  }

  const viz = (results?.viz_data ?? {}) as Record<string, never>;
  const composite = results?.composite as
    | { value: number; label: string; method: string }
    | undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <MissionStepper current="explanation" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("resultsTitle")}</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {results?.algorithm} · {results?.task_type} ·{" "}
              {experiment.duration_seconds ? `${experiment.duration_seconds}s` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void download()}>
              <DownloadIcon />
              {t("actions.download")}
            </Button>
            <Button variant="outline" asChild>
              <Link
                href={`/wizard?projectId=${experiment.project_id}&datasetId=${experiment.dataset_id}`}>
                <RotateCcwIcon />
                {t("actions.rerun")}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">{t("tabPerformance")}</TabsTrigger>
          <TabsTrigger value="xai">{t("tabXai")}</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          {composite ? (
            <Card>
              <CardContent className="flex items-center gap-6 pt-6">
                <div
                  className="relative flex size-24 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(var(--primary) ${composite.value * 3.6}deg, var(--muted) 0deg)`
                  }}
                  title={t("composite.method", { method: composite.method })}>
                  <div className="bg-background flex size-19 items-center justify-center rounded-full">
                    <span className="text-xl font-bold">{Math.round(composite.value)}</span>
                  </div>
                </div>
                <div>
                  <p className="text-lg font-semibold">
                    {t(`composite.${composite.label}` as never)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t("composite.method", { method: composite.method })}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {results ? (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {METRIC_ORDER.filter((key) => typeof results.metrics[key] === "number").map(
                (key) => (
                  <Card key={key} className="py-4">
                    <CardContent>
                      <p className="text-muted-foreground flex items-center gap-1 text-xs">
                        {t(`metrics.${key}` as never)}
                        {results.metrics.primary_metric === key ? (
                          <Badge variant="secondary" className="text-[9px]">
                            {t("metrics.primary")}
                          </Badge>
                        ) : null}
                      </p>
                      <p
                        className="text-xl font-semibold"
                        title={
                          t.has(`metricHints.${key}` as never)
                            ? t(`metricHints.${key}` as never)
                            : undefined
                        }>
                        {String(results.metrics[key])}
                      </p>
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {viz["confusion_matrix"] ? (
              <ConfusionMatrix
                classes={(viz["confusion_matrix"] as { classes: string[] }).classes}
                matrix={(viz["confusion_matrix"] as { matrix: number[][] }).matrix}
              />
            ) : null}
            {viz["roc_curve"] ? (
              <RocCurve
                points={(viz["roc_curve"] as { points: never[] }).points}
                auc={(viz["roc_curve"] as { auc: number }).auc}
              />
            ) : null}
            {viz["pr_curve"] ? (
              <PrCurve points={(viz["pr_curve"] as { points: never[] }).points} />
            ) : null}
            {viz["feature_importance"] ? (
              <ImportanceChart importance={viz["feature_importance"] as never[]} />
            ) : null}
            {viz["tree_structure"] ? <TreeView tree={viz["tree_structure"] as never} /> : null}
          </div>
          {viz["predicted_vs_actual"] ? (
            <RegressionCharts
              predVsActual={viz["predicted_vs_actual"] as never[]}
              residuals={viz["residuals"] as never[]}
              histogram={viz["residuals_histogram"] as never[]}
            />
          ) : null}

          {results?.applied_preprocessing ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {t("appliedTitle")}
                  <Badge variant="secondary" className="font-mono">
                    {t("appliedBadge")}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-muted-foreground list-disc pl-5 font-mono text-xs leading-relaxed">
                  {((results.applied_preprocessing.steps as string[]) ?? []).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {logs.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("logs")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="bg-muted max-h-48 overflow-auto rounded-md p-3 font-mono text-xs">
                  {logs.map((line, index) => (
                    <li key={index}>
                      {new Date(line.ts).toLocaleTimeString()} — {line.message}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="xai">
          <XaiTab experimentId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
