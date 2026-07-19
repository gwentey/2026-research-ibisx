"use client";

import { Fragment, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  BarChart3Icon,
  BrainCircuitIcon,
  DownloadIcon,
  LayersIcon,
  RotateCcwIcon,
  TargetIcon,
  TerminalIcon,
  TimerIcon,
  type LucideIcon
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MissionStepper } from "@/components/ibis/mission-stepper";
import { ChallengeDebrief } from "@/components/ibis/challenges/challenge-debrief";
import { CausalCaveat } from "@/components/ibis/causal-caveat";
import { LensSwitcher } from "@/components/ibis/lenses/lens-switcher";
import { LensReading } from "@/components/ibis/lenses/lens-reading";
import { FairnessPanel } from "@/components/ibis/fairness/fairness-panel";
import { XaiTab } from "@/components/ibis/xai/xai-tab";
import { extractInsights } from "@/lib/lenses/insights";
import { useLensStore } from "@/lib/lenses/store";
import type { LensId, RawResults } from "@/lib/lenses/types";
import {
  CompositeScoreCard,
  ConfusionMatrix,
  ImportanceChart,
  MetricTile,
  PrCurve,
  RegressionCharts,
  RocCurve,
  TreeView,
  metricRatio,
  metricTone
} from "@/components/ibis/experiments/result-charts";
import {
  downloadModel,
  getExperiment,
  getExperimentLogs,
  getExperimentResults
} from "@/lib/api/generated";
import type { ExperimentResults, ExperimentWithQueue, LogLine } from "@/lib/api/generated";

/** Pill de contexte (en-tête résultats) — pastille tonale + icône, données réelles uniquement. */
function ContextPill({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs">
      <Icon className="size-3.5" />
      {children}
    </span>
  );
}

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

  // Regard métier actif : par défaut celui choisi au profil (localStorage), jusqu'à ce que
  // l'utilisateur bascule manuellement. Dimension orthogonale à XaiAudience — mêmes chiffres.
  const storeDiscipline = useLensStore((state) => state.discipline);
  const [activeLens, setActiveLens] = useState<LensId | null>(null);
  const [lensTouched, setLensTouched] = useState(false);
  useEffect(() => {
    if (!lensTouched) setActiveLens(storeDiscipline);
  }, [storeDiscipline, lensTouched]);

  const insights = useMemo(
    () => extractInsights((results ?? {}) as unknown as RawResults),
    [results]
  );

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

  // Libellé humain de la métrique principale, transmis au regard « économiste ».
  const primaryKey = insights.primaryMetric?.key;
  const metricLabel =
    primaryKey && t.has(`metrics.${primaryKey}` as never)
      ? t(`metrics.${primaryKey}` as never)
      : undefined;

  const confusion = viz["confusion_matrix"] as
    | { classes: string[]; matrix: number[][] }
    | undefined;
  const rocCurve = viz["roc_curve"] as
    | { points: { fpr: number; tpr: number }[]; auc: number }
    | undefined;
  const prCurve = viz["pr_curve"] as
    | { points: { precision: number; recall: number }[] }
    | undefined;

  // Cartes secondaires réutilisées à deux endroits (colonne droite de l'arbre, sinon pleine largeur).
  const appliedCard = results?.applied_preprocessing ? (
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
  ) : null;

  const logsCard =
    logs.length > 0 ? (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("logs")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ItemGroup className="max-h-64 overflow-auto rounded-md border">
            {logs.map((line, index) => (
              <Fragment key={index}>
                {index > 0 ? <ItemSeparator /> : null}
                <Item size="sm">
                  <ItemMedia variant="icon">
                    <TerminalIcon />
                  </ItemMedia>
                  <ItemContent>
                    <ItemDescription className="text-foreground font-mono text-xs">
                      {line.message}
                    </ItemDescription>
                  </ItemContent>
                  <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                    {new Date(line.ts).toLocaleTimeString()}
                  </span>
                </Item>
              </Fragment>
            ))}
          </ItemGroup>
        </CardContent>
      </Card>
    ) : null;

  // Graphes de classification (matrice + courbes) — grille équilibrée : cartes de même
  // hauteur par rangée ; l'orphelin d'une rangée impaire s'étend sur toute la largeur
  // (pas de vide béant à droite de la matrice).
  const classificationCharts = [
    confusion ? (
      <ConfusionMatrix key="cm" classes={confusion.classes} matrix={confusion.matrix} />
    ) : null,
    rocCurve ? <RocCurve key="roc" points={rocCurve.points} auc={rocCurve.auc} /> : null,
    prCurve ? <PrCurve key="pr" points={prCurve.points} /> : null
  ].filter(Boolean) as ReactNode[];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <MissionStepper current="explanation" />
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
            <BarChart3Icon className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {t("resultsTitle")}
                </h1>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {results?.algorithm ? (
                    <ContextPill icon={BrainCircuitIcon}>{results.algorithm}</ContextPill>
                  ) : null}
                  {results?.task_type ? (
                    <ContextPill icon={TargetIcon}>{results.task_type}</ContextPill>
                  ) : null}
                  {results?.class_names && results.class_names.length > 0 ? (
                    <ContextPill icon={LayersIcon}>
                      {t("contextPills.classes", { count: results.class_names.length })}
                    </ContextPill>
                  ) : null}
                  {experiment.duration_seconds ? (
                    <ContextPill icon={TimerIcon}>{`${experiment.duration_seconds}s`}</ContextPill>
                  ) : null}
                </div>
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
        </div>
      </div>

      <ChallengeDebrief experiment={experiment} results={results} />

      {results ? (
        <div className="space-y-4">
          <LensSwitcher
            value={activeLens}
            onChange={(value) => {
              setLensTouched(true);
              setActiveLens(value);
            }}
          />
          {activeLens ? (
            <LensReading lensId={activeLens} insights={insights} metricLabel={metricLabel} />
          ) : null}
        </div>
      ) : null}

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">{t("tabPerformance")}</TabsTrigger>
          <TabsTrigger value="fairness">{t("tabFairness")}</TabsTrigger>
          <TabsTrigger value="xai">{t("tabXai")}</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          {composite ? (
            <CompositeScoreCard
              value={composite.value}
              label={t(`composite.${composite.label}` as never)}
              methodText={t("composite.method", { method: composite.method })}
              primaryMetric={
                results &&
                typeof results.metrics.primary_metric === "string" &&
                typeof results.metrics[results.metrics.primary_metric as string] === "number"
                  ? {
                      label: t(`metrics.${results.metrics.primary_metric}` as never),
                      value: String(results.metrics[results.metrics.primary_metric as string])
                    }
                  : null
              }
            />
          ) : null}

          {results ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              {METRIC_ORDER.filter((key) => typeof results.metrics[key] === "number").map(
                (key) => {
                  const numericValue = results.metrics[key] as number;
                  const tone = metricTone(key, numericValue);
                  const ratio = metricRatio(key, numericValue);
                  return (
                    <MetricTile
                      key={key}
                      label={t(`metrics.${key}` as never)}
                      displayValue={String(numericValue)}
                      tone={tone}
                      ratio={ratio}
                      qualityLabel={ratio !== null ? t(`metricQuality.${tone}` as never) : undefined}
                      isPrimary={results.metrics.primary_metric === key}
                      primaryLabel={t("metrics.primary")}
                      hint={
                        t.has(`metricHints.${key}` as never)
                          ? t(`metricHints.${key}` as never)
                          : undefined
                      }
                    />
                  );
                }
              )}
            </div>
          ) : null}

          {classificationCharts.length > 0 ? (
            <div className="grid items-stretch gap-4 lg:grid-cols-2">
              {classificationCharts.map((chart, index) => {
                const spanFull =
                  classificationCharts.length % 2 === 1 &&
                  index === classificationCharts.length - 1;
                return (
                  <div key={index} className={spanFull ? "lg:col-span-2" : undefined}>
                    {chart}
                  </div>
                );
              })}
            </div>
          ) : null}

          {viz["feature_importance"] ? (
            <div className="space-y-3">
              <ImportanceChart importance={viz["feature_importance"] as never[]} />
              <CausalCaveat />
            </div>
          ) : null}

          {viz["predicted_vs_actual"] ? (
            <RegressionCharts
              predVsActual={viz["predicted_vs_actual"] as never[]}
              residuals={viz["residuals"] as never[]}
              histogram={viz["residuals_histogram"] as never[]}
            />
          ) : null}

          {viz["tree_structure"] ? (
            appliedCard || logsCard ? (
              // Arbre à gauche, transformations + journal à droite. `items-stretch` : l'arbre
              // s'étire à la hauteur de la colonne de droite (pas de vide sous une carte trop courte).
              <div className="grid items-stretch gap-4 lg:grid-cols-2">
                <TreeView tree={viz["tree_structure"] as never} />
                <div className="space-y-4">
                  {appliedCard}
                  {logsCard}
                </div>
              </div>
            ) : (
              <TreeView tree={viz["tree_structure"] as never} />
            )
          ) : (
            <>
              {appliedCard}
              {logsCard}
            </>
          )}
        </TabsContent>

        <TabsContent value="fairness">
          {experiment ? (
            <FairnessPanel
              experimentId={id}
              datasetId={experiment.dataset_id}
              taskType={results?.task_type}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="xai">
          <XaiTab experimentId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
