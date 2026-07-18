"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2Icon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Columns3Icon,
  GaugeIcon,
  InfoIcon,
  LightbulbIcon,
  ListIcon,
  Rows3Icon,
  SparklesIcon,
  TableIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  XCircleIcon,
  XIcon
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import type { DatasetDetail, DatasetPreview } from "@/lib/api/generated";
import type { QualityData } from "@/app/wizard/page";
import { useWizardStore, type WizardState } from "@/lib/wizard/store";
import { formatCount } from "@/lib/datasets/constants";
import { cn } from "@/lib/utils";

const STRATEGIES = [
  "mean",
  "median",
  "most_frequent",
  "constant",
  "knn",
  "iterative",
  "drop_rows",
  "drop_column"
] as const;

function Understand({ title, body }: { title: string; body: string }) {
  return (
    <Alert>
      <InfoIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{body}</AlertDescription>
    </Alert>
  );
}

// ---------------------------------------------------------------- Validité (partagée avec la coquille)

export function targetMeta(dataset: DatasetDetail, quality: QualityData | null, state: WizardState) {
  const columns = dataset.files[0]?.columns ?? [];
  const selected = columns.find((column) => column.name === state.targetColumn);
  const qualityColumn = quality?.analysis.columns.find((c) => c.name === state.targetColumn);
  const isCategorical =
    selected !== undefined &&
    (selected.dtype_interpreted === "categorical" ||
      selected.dtype_interpreted === "text" ||
      selected.dtype_interpreted === "boolean" ||
      (qualityColumn !== undefined && !qualityColumn.is_numeric));
  const uniqueCount = Number(
    qualityColumn?.unique_count ??
      (selected?.stats as { unique_count?: number } | undefined)?.unique_count ??
      0
  );
  // Heuristique déterministe locale (CDC É2) : catégoriel/petite cardinalité → classification
  const recommendedTask: "classification" | "regression" =
    isCategorical || (typeof uniqueCount === "number" && uniqueCount <= 10)
      ? "classification"
      : "regression";
  return {
    selected,
    isCategorical,
    uniqueCount,
    recommendedTask,
    blocking: state.taskType === "regression" && isCategorical
  };
}

export function cleaningBlockingColumns(quality: QualityData | null, state: WizardState): string[] {
  return (quality?.analysis.columns ?? [])
    .filter(
      (c) =>
        c.name !== state.targetColumn &&
        c.missing_count > 0 &&
        c.missing_percentage > 30 &&
        !state.columnStrategies[c.name]
    )
    .map((c) => c.name);
}

// ---------------------------------------------------------------- Étape 1
export function Step1Overview({
  dataset,
  preview,
  quality,
  onNext
}: {
  dataset: DatasetDetail;
  preview: DatasetPreview | null;
  quality: QualityData | null;
  onNext: () => void;
}) {
  const t = useTranslations("wizard.step1");

  const stats = [
    {
      icon: Rows3Icon,
      value: formatCount(dataset.instances_number),
      label: t("rows")
    },
    {
      icon: Columns3Icon,
      value: formatCount(dataset.features_number),
      label: t("cols")
    }
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <stat.icon className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums">{stat.value}</p>
                <p className="text-muted-foreground text-sm">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                <GaugeIcon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-semibold tabular-nums">
                  {quality ? `${quality.quality_score}` : "…"}
                  <span className="text-muted-foreground text-sm font-normal">/100</span>
                </p>
                <p className="text-muted-foreground text-sm" title={t("qualityHint")}>
                  {t("quality")}
                </p>
              </div>
            </div>
            {quality ? <Progress value={quality.quality_score} className="mt-3 h-1.5" /> : null}
          </CardContent>
        </Card>
      </div>

      {dataset.objective ? (
        <div className="border-primary bg-card rounded-md border border-l-4 p-4">
          <p className="text-sm leading-relaxed">{dataset.objective}</p>
        </div>
      ) : null}

      <Understand title={t("understand")} body={t("understandBody")} />

      {preview ? (
        <Card className="gap-0 py-0">
          <CardHeader className="border-b py-3!">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <TableIcon className="text-muted-foreground size-4" />
              {t("preview")}
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-72 overflow-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {preview.displayed_columns.slice(0, 10).map((column) => (
                    <TableHead key={column} className="text-xs">
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.slice(0, 10).map((row, index) => (
                  <TableRow key={index}>
                    {preview.displayed_columns.slice(0, 10).map((column) => (
                      <TableCell key={column} className="max-w-40 truncate text-xs">
                        {String((row as Record<string, unknown>)[column] ?? "—")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-center pt-2">
        <Button size="lg" onClick={onNext}>
          <CheckIcon />
          {t("confirm")}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Étape 2
const TARGET_HINTS = ["target", "label", "class", "outcome", "species", "quality", "score", "g3", "survived"];

export function Step2Target({
  dataset,
  preview,
  quality
}: {
  dataset: DatasetDetail;
  preview: DatasetPreview | null;
  quality: QualityData | null;
}) {
  const t = useTranslations("wizard.step2");
  const store = useWizardStore();
  const [assistOpen, setAssistOpen] = useState(true);
  const columns = dataset.files[0]?.columns ?? [];

  const suggested = useMemo(
    () =>
      columns.find((column) =>
        TARGET_HINTS.some((hint) => column.name.toLowerCase().includes(hint))
      )?.name ?? null,
    [columns]
  );

  const meta = targetMeta(dataset, quality, store);
  const target = store.targetColumn;

  // P1 : exemples ancrés sur les VRAIES valeurs observées dans l'aperçu (jamais inventés)
  const observedValues = useMemo(() => {
    if (!target || !preview) return [];
    const values = new Set<string>();
    for (const row of preview.rows) {
      const value = (row as Record<string, unknown>)[target];
      if (value !== null && value !== undefined && String(value).trim() !== "") {
        values.add(String(value));
      }
      if (values.size >= 4) break;
    }
    return [...values];
  }, [preview, target]);

  const recommendedLabel =
    meta.recommendedTask === "classification" ? t("classification") : t("regression");

  const taskCard = (task: "classification" | "regression") => {
    const isRecommended = target !== null && meta.recommendedTask === task;
    const inappropriate = task === "regression" && target !== null && meta.isCategorical;
    const active = store.taskType === task;
    const Icon = task === "classification" ? ListIcon : TrendingUpIcon;
    return (
      <button
        type="button"
        onClick={() => store.set("taskType", task)}
        className={cn(
          "bg-card rounded-lg border p-4 text-left transition-all",
          active ? "border-primary ring-primary/30 ring-2" : "hover:border-primary/40"
        )}>
        <div className="flex items-center gap-2">
          <Icon className={cn("size-4", inappropriate ? "text-muted-foreground" : "text-primary")} />
          <p className="font-semibold">{t(task)}</p>
          {isRecommended && !inappropriate ? (
            <Badge className="ml-auto">{t("recommendedBadge")}</Badge>
          ) : active ? (
            <CheckCircle2Icon className="text-primary ml-auto size-4" />
          ) : null}
        </div>

        <p className="text-muted-foreground mt-3 text-xs font-medium uppercase tracking-wide">
          {t("forDataset")}
        </p>
        {inappropriate ? (
          <p className="text-destructive mt-1 flex items-start gap-1.5 text-sm">
            <XCircleIcon className="mt-0.5 size-3.5 shrink-0" />
            {t("notAppropriateBody", { column: target ?? "" })}
          </p>
        ) : (
          <p className="mt-1 text-sm leading-relaxed">
            {target
              ? task === "classification"
                ? t("classificationFor", { column: target })
                : t("regressionFor", { column: target })
              : t(`${task}Hint`)}
          </p>
        )}

        {target ? (
          <>
            <p className="text-muted-foreground mt-3 text-xs font-medium uppercase tracking-wide">
              {t("examples")}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {inappropriate ? (
                <span className="flex items-center gap-1.5">
                  <XIcon className="size-3" /> {t("notApplicable")}
                </span>
              ) : task === "classification" && observedValues.length > 0 ? (
                t("observedValues", { values: observedValues.join(" · ") })
              ) : task === "regression" ? (
                t("continuousValues", { column: target })
              ) : (
                t(`${task}Hint`)
              )}
            </p>
          </>
        ) : null}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Panneau d'assistance (disposition v1 : analyse → cartes comparatives → reco finale) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-ai flex items-center gap-2 text-base">
            <span className="bg-ai/10 text-ai flex size-7 shrink-0 items-center justify-center rounded-md">
              <SparklesIcon className="size-4" />
            </span>
            {t("aiTitle")}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            aria-expanded={assistOpen}
            onClick={() => setAssistOpen((open) => !open)}>
            {assistOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
            {assistOpen ? t("closeAssist") : t("openAssist")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t("targetLabel")}</Label>
            <Select
              value={store.targetColumn ?? undefined}
              onValueChange={(value) => store.set("targetColumn", value)}>
              <SelectTrigger className="mt-2 w-full max-w-md">
                <SelectValue placeholder={t("targetPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {columns.map((column) => (
                  <SelectItem key={column.id} value={column.name}>
                    {column.name} · {column.dtype_interpreted}
                    {column.name === suggested ? ` — ${t("suggested")}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {assistOpen ? (
            <div className="border-ai/30 bg-ai/5 space-y-3 rounded-md border p-4">
              <p className="text-sm">
                {t("analysisOf", { name: dataset.display_name })}
                {dataset.objective ? (
                  <span className="text-muted-foreground"> — {dataset.objective}</span>
                ) : null}
              </p>
              {target ? (
                <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
                  <span className="flex items-center gap-1.5">
                    <ListIcon className="text-ai size-3.5" />
                    <span className="text-muted-foreground">{t("targetInfo")} :</span>
                    <span className="font-medium">{target}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <GaugeIcon className="text-ai size-3.5" />
                    <span className="text-muted-foreground">{t("dtypeInfo")} :</span>
                    <span className="font-medium">
                      {meta.isCategorical ? t("dtypeCategorical") : t("dtypeNumeric")}
                    </span>
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div>
            <Label>{t("taskLabel")}</Label>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {taskCard("classification")}
              {taskCard("regression")}
            </div>
          </div>

          {assistOpen && target ? (
            <Alert className="border-ai/30 bg-ai/5 text-ai">
              <LightbulbIcon />
              <AlertTitle>{t("finalTitle")}</AlertTitle>
              <AlertDescription>
                {t("aiReco", {
                  task: recommendedLabel,
                  reason: t(
                    meta.recommendedTask === "classification"
                      ? "reasonCategorical"
                      : "reasonNumeric",
                    { column: target, count: meta.uniqueCount }
                  )
                })}
              </AlertDescription>
            </Alert>
          ) : null}

          {assistOpen && target ? (
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <Button
                className="bg-ai text-ai-foreground hover:bg-ai/90"
                onClick={() => store.set("taskType", meta.recommendedTask)}>
                <CheckCircle2Icon />
                {t("applyFinal", { task: recommendedLabel })}
              </Button>
              <Button variant="outline" onClick={() => setAssistOpen(false)}>
                <XIcon />
                {t("chooseMyself")}
              </Button>
            </div>
          ) : null}

          {meta.blocking ? (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>{t("blockTitle")}</AlertTitle>
              <AlertDescription>{t("blockBody", { column: target ?? "" })}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Understand title={t("understand")} body={t("understandBody")} />
    </div>
  );
}

// ---------------------------------------------------------------- Étape 3
export function Step3Cleaning({ quality }: { quality: QualityData | null }) {
  const t = useTranslations("wizard.step3");
  const store = useWizardStore();
  const columns = (quality?.analysis.columns ?? []).filter(
    (column) => column.missing_count > 0 && column.name !== store.targetColumn
  );
  const targetQuality = quality?.analysis.columns.find((c) => c.name === store.targetColumn);

  const applyRecommendations = () => {
    for (const column of columns) {
      if (column.recommended_strategy) {
        store.setStrategy(column.name, { strategy: column.recommended_strategy as never });
      }
    }
  };

  // Validation bloquante : > 30 % de manquants sans stratégie explicite (CDC É3)
  const blockingColumns = columns
    .filter((c) => c.missing_percentage > 30 && !store.columnStrategies[c.name])
    .map((c) => c.name);

  return (
    <div className="space-y-4">
      {columns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
              <CheckCircle2Icon className="size-6" />
            </div>
            <p className="font-semibold">{t("cleanTitle")}</p>
            <p className="text-muted-foreground max-w-md text-sm">{t("cleanBody")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row items-center justify-between border-b py-3!">
            <p className="text-muted-foreground text-sm">{t("intro")}</p>
            <Button variant="outline" size="sm" onClick={applyRecommendations}>
              <SparklesIcon />
              {t("applyReco")}
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("column")}</TableHead>
                  <TableHead>{t("missing")}</TableHead>
                  <TableHead>{t("distribution")}</TableHead>
                  <TableHead className="min-w-56">{t("strategy")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {columns.map((column) => {
                  const current = store.columnStrategies[column.name]?.strategy;
                  return (
                    <TableRow key={column.name}>
                      <TableCell className="font-medium">{column.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="bg-muted h-1.5 w-16 rounded">
                            <div
                              className={cn(
                                "h-1.5 rounded",
                                column.missing_percentage > 30
                                  ? "bg-destructive"
                                  : "bg-primary"
                              )}
                              style={{ width: `${Math.min(100, column.missing_percentage)}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums">
                            {column.missing_percentage}%
                          </span>
                        </div>
                        {column.outliers.percentage > 10 ? (
                          <p className="text-muted-foreground mt-1 text-[10px]">
                            {t("outliers", {
                              count: column.outliers.count,
                              pct: column.outliers.percentage
                            })}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-normal">
                          {t(`distributions.${column.distribution}` as never)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={current ?? undefined}
                          onValueChange={(value) =>
                            store.setStrategy(column.name, { strategy: value as never })
                          }>
                          <SelectTrigger size="sm" className="w-full">
                            <SelectValue
                              placeholder={
                                column.recommended_strategy
                                  ? `${t(`strategies.${column.recommended_strategy}` as never)} (${t("recommended")})`
                                  : "—"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {STRATEGIES.filter(
                              (s) =>
                                column.is_numeric ||
                                ["most_frequent", "constant", "drop_rows", "drop_column"].includes(
                                  s
                                )
                            ).map((strategy) => (
                              <SelectItem key={strategy} value={strategy}>
                                {t(`strategies.${strategy}` as never)}
                                {strategy === column.recommended_strategy
                                  ? ` — ${t("recommended")}`
                                  : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {targetQuality && targetQuality.missing_count > 0 ? (
        <Alert>
          <InfoIcon />
          <AlertDescription>
            {t("targetMissing", {
              column: store.targetColumn ?? "",
              count: targetQuality.missing_count
            })}
          </AlertDescription>
        </Alert>
      ) : null}
      {blockingColumns.length > 0 ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>
            {t("blockOver30", { columns: blockingColumns.join(", ") })}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- Étape 4
export function Step4Split({ quality }: { quality: QualityData | null }) {
  const t = useTranslations("wizard.step4");
  const store = useWizardStore();
  const total = quality?.analysis.row_count ?? 0;
  const testRows = Math.round(total * store.testSize);
  const trainPct = Math.round((1 - store.testSize) * 100);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t("testSize", { pct: Math.round(store.testSize * 100) })}</Label>
              <Badge variant="outline" className="font-mono text-xs">
                {trainPct} / {Math.round(store.testSize * 100)}
              </Badge>
            </div>
            <Slider
              value={[store.testSize * 100]}
              min={10}
              max={50}
              step={5}
              onValueChange={([value]) => store.set("testSize", value / 100)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex h-9 w-full overflow-hidden rounded-md border">
              <div
                className="bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium transition-all duration-300"
                style={{ width: `${100 - store.testSize * 100}%` }}>
                {t("trainRows", { count: total - testRows })}
              </div>
              <div
                className="bg-muted text-foreground flex items-center justify-center text-xs transition-all duration-300"
                style={{ width: `${store.testSize * 100}%` }}>
                {t("testRows", { count: testRows })}
              </div>
            </div>
            {store.taskType === "classification" ? (
              <p className="text-muted-foreground text-sm">{t("stratified")}</p>
            ) : null}
          </div>

          <Badge variant="outline" className="font-mono">
            {t("seed")}
          </Badge>
        </CardContent>
      </Card>
      <Understand title={t("understand")} body={t("understandBody")} />
    </div>
  );
}

// ---------------------------------------------------------------- Étape 5
export function Step5Prep({ quality }: { quality: QualityData | null }) {
  const t = useTranslations("wizard.step5");
  const store = useWizardStore();
  const hasOutliers = (quality?.analysis.columns ?? []).some(
    (column) => column.outliers.percentage > 10
  );

  const optionCard = (key: string, active: boolean, onClick: () => void, label: string) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className={cn(
        "bg-card flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-all",
        active ? "border-primary ring-primary/30 ring-2 font-medium" : "hover:border-primary/40"
      )}>
      {active ? <CheckCircle2Icon className="text-primary size-4 shrink-0" /> : null}
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <Label>{t("scaling")}</Label>
                <p className="text-muted-foreground text-xs">{t("scalingHint")}</p>
              </div>
              <Switch
                checked={store.scalingEnabled}
                onCheckedChange={(checked) => store.set("scalingEnabled", checked)}
              />
            </div>
            {store.scalingEnabled ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {(["standard", "minmax", "robust"] as const).map((method) =>
                  optionCard(
                    method,
                    store.scalingMethod === method,
                    () => store.set("scalingMethod", method),
                    t(`methods.${method}`)
                  )
                )}
              </div>
            ) : null}
            {hasOutliers ? (
              <Alert className="mt-3">
                <InfoIcon />
                <AlertDescription>{t("robustReco")}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <div>
            <Label>{t("encoding")}</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(["onehot", "ordinal"] as const).map((encoding) =>
                optionCard(
                  encoding,
                  store.encoding === encoding,
                  () => store.set("encoding", encoding),
                  t(`encodings.${encoding}`)
                )
              )}
            </div>
          </div>
          <Badge variant="secondary">{t("applied")}</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
