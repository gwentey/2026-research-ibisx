"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2Icon, InfoIcon, TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import { useWizardStore } from "@/lib/wizard/store";
import { formatCount } from "@/lib/datasets/constants";

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
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-semibold">{formatCount(dataset.instances_number)}</p>
            <p className="text-muted-foreground text-sm">{t("rows")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-semibold">{formatCount(dataset.features_number)}</p>
            <p className="text-muted-foreground text-sm">{t("cols")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-semibold">
              {quality ? `${quality.quality_score}/100` : "…"}
            </p>
            <p className="text-muted-foreground text-sm" title={t("qualityHint")}>
              {t("quality")}
            </p>
          </CardContent>
        </Card>
      </div>
      {dataset.objective ? (
        <p className="text-muted-foreground text-sm">{dataset.objective}</p>
      ) : null}
      <Understand title={t("understand")} body={t("understandBody")} />
      {preview ? (
        <Card className="py-0">
          <CardContent className="max-h-72 overflow-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {preview.displayed_columns.slice(0, 10).map((column) => (
                    <TableHead key={column}>{column}</TableHead>
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
      <Button onClick={onNext}>{t("confirm")}</Button>
    </div>
  );
}

// ---------------------------------------------------------------- Étape 2
const TARGET_HINTS = ["target", "label", "class", "outcome", "species", "quality", "score", "g3", "survived"];

export function Step2Target({
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
  const t = useTranslations("wizard.step2");
  const tw = useTranslations("wizard");
  const store = useWizardStore();
  const columns = dataset.files[0]?.columns ?? [];

  const suggested = useMemo(
    () =>
      columns.find((column) =>
        TARGET_HINTS.some((hint) => column.name.toLowerCase().includes(hint))
      )?.name ?? null,
    [columns]
  );

  const selected = columns.find((column) => column.name === store.targetColumn);
  const qualityColumn = quality?.analysis.columns.find((c) => c.name === store.targetColumn);
  const isCategoricalTarget =
    selected !== undefined &&
    (selected.dtype_interpreted === "categorical" ||
      selected.dtype_interpreted === "text" ||
      selected.dtype_interpreted === "boolean" ||
      (qualityColumn !== undefined && !qualityColumn.is_numeric));
  const uniqueCount = Number(qualityColumn?.unique_count ?? (selected?.stats as { unique_count?: number } | undefined)?.unique_count ?? 0);
  // Heuristique déterministe locale (CDC É2) : catégoriel/petite cardinalité → classification
  const recommendedTask: "classification" | "regression" =
    isCategoricalTarget || (typeof uniqueCount === "number" && uniqueCount <= 10)
      ? "classification"
      : "regression";
  const blocking = store.taskType === "regression" && isCategoricalTarget;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-6">
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

          {store.targetColumn ? (
            <Alert>
              <InfoIcon />
              <AlertTitle>{t("aiTitle")}</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  {t("aiReco", {
                    task:
                      recommendedTask === "classification"
                        ? t("classification")
                        : t("regression"),
                    reason: t(
                      recommendedTask === "classification"
                        ? "reasonCategorical"
                        : "reasonNumeric",
                      { column: store.targetColumn, count: uniqueCount }
                    )
                  })}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => store.set("taskType", recommendedTask)}>
                  {t("aiApply")}
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <div>
            <Label>{t("taskLabel")}</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(["classification", "regression"] as const).map((task) => (
                <button
                  key={task}
                  type="button"
                  onClick={() => store.set("taskType", task)}
                  className={`rounded-md border p-3 text-left text-sm ${
                    store.taskType === task ? "border-primary bg-muted" : "hover:bg-muted"
                  }`}>
                  <p className="font-medium">{t(task)}</p>
                  <p className="text-muted-foreground text-xs">{t(`${task}Hint`)}</p>
                </button>
              ))}
            </div>
          </div>

          {blocking ? (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>{t("blockTitle")}</AlertTitle>
              <AlertDescription>
                {t("blockBody", { column: store.targetColumn ?? "" })}
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
      <Understand title={t("understand")} body={t("understandBody")} />
      <Button onClick={onNext} disabled={!store.targetColumn || !store.taskType || blocking}>
        {tw("next")}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- Étape 3
export function Step3Cleaning({
  quality,
  onNext
}: {
  quality: QualityData | null;
  onNext: () => void;
}) {
  const t = useTranslations("wizard.step3");
  const tw = useTranslations("wizard");
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
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>{t("cleanTitle")}</AlertTitle>
          <AlertDescription>{t("cleanBody")}</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">{t("intro")}</p>
            <Button variant="outline" size="sm" onClick={applyRecommendations}>
              {t("applyReco")}
            </Button>
          </div>
          <Card className="py-0">
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
                                className="bg-primary h-1.5 rounded"
                                style={{ width: `${Math.min(100, column.missing_percentage)}%` }}
                              />
                            </div>
                            <span className="text-xs">{column.missing_percentage}%</span>
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
                        <TableCell className="text-xs">
                          {t(`distributions.${column.distribution}` as never)}
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
                                  ["most_frequent", "constant", "drop_rows", "drop_column"].includes(s)
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
        </>
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
      <Button onClick={onNext} disabled={blockingColumns.length > 0}>
        {tw("next")}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- Étape 4
export function Step4Split({
  quality,
  onNext
}: {
  quality: QualityData | null;
  onNext: () => void;
}) {
  const t = useTranslations("wizard.step4");
  const tw = useTranslations("wizard");
  const store = useWizardStore();
  const total = quality?.analysis.row_count ?? 0;
  const testRows = Math.round(total * store.testSize);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Label>{t("testSize", { pct: Math.round(store.testSize * 100) })}</Label>
          <Slider
            value={[store.testSize * 100]}
            min={10}
            max={50}
            step={5}
            onValueChange={([value]) => store.set("testSize", value / 100)}
          />
          <div className="flex h-6 w-full overflow-hidden rounded-md text-[10px] text-white">
            <div
              className="bg-primary flex items-center justify-center"
              style={{ width: `${100 - store.testSize * 100}%` }}>
              {t("trainRows", { count: total - testRows })}
            </div>
            <div
              className="bg-muted-foreground flex items-center justify-center"
              style={{ width: `${store.testSize * 100}%` }}>
              {t("testRows", { count: testRows })}
            </div>
          </div>
          {store.taskType === "classification" ? (
            <p className="text-muted-foreground text-sm">{t("stratified")}</p>
          ) : null}
          <Badge variant="outline" className="font-mono">
            {t("seed")}
          </Badge>
        </CardContent>
      </Card>
      <Understand title={t("understand")} body={t("understandBody")} />
      <Button onClick={onNext}>{tw("next")}</Button>
    </div>
  );
}

// ---------------------------------------------------------------- Étape 5
export function Step5Prep({
  quality,
  onNext
}: {
  quality: QualityData | null;
  onNext: () => void;
}) {
  const t = useTranslations("wizard.step5");
  const tw = useTranslations("wizard");
  const store = useWizardStore();
  const hasOutliers = (quality?.analysis.columns ?? []).some(
    (column) => column.outliers.percentage > 10
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-5 pt-6">
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
            <div className="grid gap-2 sm:grid-cols-3">
              {(["standard", "minmax", "robust"] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => store.set("scalingMethod", method)}
                  className={`rounded-md border p-3 text-left text-sm ${
                    store.scalingMethod === method ? "border-primary bg-muted" : "hover:bg-muted"
                  }`}>
                  {t(`methods.${method}`)}
                </button>
              ))}
            </div>
          ) : null}
          {hasOutliers ? (
            <Alert>
              <InfoIcon />
              <AlertDescription>{t("robustReco")}</AlertDescription>
            </Alert>
          ) : null}

          <div>
            <Label>{t("encoding")}</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(["onehot", "ordinal"] as const).map((encoding) => (
                <button
                  key={encoding}
                  type="button"
                  onClick={() => store.set("encoding", encoding)}
                  className={`rounded-md border p-3 text-left text-sm ${
                    store.encoding === encoding ? "border-primary bg-muted" : "hover:bg-muted"
                  }`}>
                  {t(`encodings.${encoding}`)}
                </button>
              ))}
            </div>
          </div>
          <Badge variant="secondary">{t("applied")}</Badge>
        </CardContent>
      </Card>
      <Button onClick={onNext}>{tw("next")}</Button>
    </div>
  );
}
