"use client";

import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { scoreCellStyle } from "@/lib/viz/score-scale";
import { cn } from "@/lib/utils";

// Rendu 100 % client des DONNÉES de visualisation (viz_data JSON) — Recharts (P6).

// Studio analytique (10-experiments-xai) : médaillon de score composite, réservé à cette
// surface (cf. docs/refonte/00-synthese.md — signature exclusive experiments).
export function CompositeScoreCard({
  value,
  label,
  methodText,
  primaryMetric
}: {
  value: number;
  label: string;
  methodText: string;
  primaryMetric?: { label: string; value: string } | null;
}) {
  return (
    <Card className="from-primary/8 to-chart-2/15 overflow-hidden border-0 bg-gradient-to-br py-0">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="bg-background flex flex-1 items-center gap-4 rounded-lg p-4">
          <div
            className="relative flex size-24 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(var(--primary) ${value * 3.6}deg, var(--muted) 0deg)`
            }}
            title={methodText}>
            <div className="bg-background flex size-19 items-center justify-center rounded-full">
              <span className="text-xl font-bold">{Math.round(value)}</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-lg font-semibold">{label}</p>
            <p className="text-muted-foreground text-xs">{methodText}</p>
          </div>
        </div>
        {primaryMetric ? (
          <div className="bg-muted flex shrink-0 flex-col items-center justify-center rounded-xl p-4 sm:w-40">
            <span className="text-3xl font-semibold">{primaryMetric.value}</span>
            <span className="text-muted-foreground text-center text-xs">{primaryMetric.label}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export type MetricTone = "good" | "medium" | "low" | "neutral";

/** Métriques bornées [0,1] où le seuil qualitatif a un sens (pas les métriques d'erreur). */
const RATIO_METRIC_KEYS = new Set([
  "accuracy",
  "precision",
  "recall",
  "f1_score",
  "precision_macro",
  "recall_macro",
  "f1_macro",
  "roc_auc",
  "pr_auc",
  "oob_score",
  "r2"
]);

/** Seuils dérivés de la donnée réelle (aucune valeur inventée) — même logique que scoreColorClass. */
export function metricTone(key: string, value: number): MetricTone {
  if (!RATIO_METRIC_KEYS.has(key)) return "neutral";
  const ratio = Math.max(0, Math.min(1, value));
  if (ratio >= 0.8) return "good";
  if (ratio >= 0.6) return "medium";
  return "low";
}

export function metricRatio(key: string, value: number): number | null {
  if (!RATIO_METRIC_KEYS.has(key)) return null;
  return Math.max(0, Math.min(1, value));
}

const TONE_DOT: Record<MetricTone, string> = {
  good: "bg-chart-1",
  medium: "bg-chart-3",
  low: "bg-chart-4",
  neutral: "bg-muted-foreground/40"
};

export function MetricTile({
  label,
  displayValue,
  tone,
  ratio,
  qualityLabel,
  isPrimary,
  primaryLabel,
  hint
}: {
  label: string;
  displayValue: string;
  tone: MetricTone;
  ratio: number | null;
  qualityLabel?: string;
  isPrimary?: boolean;
  primaryLabel?: string;
  hint?: string;
}) {
  return (
    <Card className={cn("gap-1.5 py-3", tone === "low" && "border-destructive/40")}>
      <CardContent className="space-y-1.5 px-3">
        <div className="flex items-center justify-between gap-1.5">
          <p className="text-muted-foreground flex min-w-0 items-center gap-1 text-[11px]">
            <span className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tone])} aria-hidden />
            <span className="truncate">{label}</span>
          </p>
          {isPrimary ? (
            <Badge variant="secondary" className="shrink-0 px-1 py-0 text-[9px]">
              {primaryLabel}
            </Badge>
          ) : null}
        </div>
        <p className="text-lg leading-tight font-semibold" title={hint}>
          {displayValue}
        </p>
        {ratio !== null ? (
          <div className="space-y-1">
            <Progress value={ratio * 100} className="h-1" indicatorColor={TONE_DOT[tone]} />
            {qualityLabel ? (
              <p className="text-muted-foreground text-[10px] leading-tight">{qualityLabel}</p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ConfusionMatrix({
  classes,
  matrix
}: {
  classes: string[];
  matrix: number[][];
}) {
  const t = useTranslations("experiments.charts");
  const max = Math.max(1, ...matrix.flat());
  const n = classes.length;

  // Diagonale (prédiction correcte) : rampe verte du score, intensité relative au max.
  // Hors diagonale (erreur) : rouge sémantique SOBRE, mélangé à --card, borné à 50 %.
  // Aucune couleur en dur — tout passe par les tokens (lisible clair ET sombre).
  const cellStyle = (value: number, correct: boolean): { backgroundColor: string } => {
    if (correct) return scoreCellStyle(value / max);
    const pct = value === 0 ? 0 : Math.min(50, 12 + 38 * (value / max));
    return { backgroundColor: `color-mix(in oklch, var(--destructive) ${pct}%, var(--card))` };
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{t("confusion")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5">
            <span
              className="bg-score-4 ring-score-5/60 size-3 rounded-sm ring-1 ring-inset"
              aria-hidden
            />
            {t("confusionCorrect")}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="size-3 rounded-sm"
              style={{ backgroundColor: "color-mix(in oklch, var(--destructive) 45%, var(--card))" }}
              aria-hidden
            />
            {t("confusionError")}
          </span>
        </div>
        <div className="max-w-full overflow-x-auto">
          <table className="mx-auto border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="p-0" />
                <th className="p-0" />
                <th
                  colSpan={n}
                  className="text-muted-foreground pb-1 text-center text-[11px] font-medium">
                  {t("confusionCols")}
                </th>
              </tr>
              <tr>
                <th className="p-0" />
                <th className="p-0" />
                {classes.map((name) => (
                  <th
                    key={name}
                    className="text-muted-foreground max-w-20 truncate p-1 font-normal"
                    title={name}>
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => (
                <tr key={classes[i]}>
                  {i === 0 ? (
                    <th
                      rowSpan={n}
                      className="text-muted-foreground p-0 align-middle text-[11px] font-medium">
                      <span className="block rotate-180 whitespace-nowrap [writing-mode:vertical-rl]">
                        {t("confusionRows")}
                      </span>
                    </th>
                  ) : null}
                  <th
                    className="text-muted-foreground max-w-20 truncate p-1 pr-2 text-right font-normal"
                    title={classes[i]}>
                    {classes[i]}
                  </th>
                  {row.map((value, j) => {
                    const correct = i === j;
                    return (
                      <td key={j} className="p-0">
                        <div
                          className={cn(
                            "text-foreground flex size-12 items-center justify-center rounded font-mono text-sm tabular-nums",
                            correct && "ring-score-4/60 font-semibold ring-1 ring-inset",
                            value === 0 && !correct && "text-muted-foreground/50"
                          )}
                          style={cellStyle(value, correct)}
                          title={`${classes[i]} → ${classes[j]} : ${value}`}>
                          {value}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

const lineConfig = { serie: { label: "", color: "var(--chart-1)" } };

export function RocCurve({ points, auc }: { points: { fpr: number; tpr: number }[]; auc: number }) {
  const t = useTranslations("experiments.charts");
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">
          {t("roc")} — AUC {auc}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={lineConfig} className="h-56 w-full">
          <LineChart data={points}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="fpr" type="number" domain={[0, 1]} tickCount={6} />
            <YAxis dataKey="tpr" type="number" domain={[0, 1]} tickCount={6} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} strokeDasharray="4 4" />
            <Line dataKey="tpr" stroke="var(--chart-1)" dot={false} strokeWidth={2} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function PrCurve({ points }: { points: { precision: number; recall: number }[] }) {
  const t = useTranslations("experiments.charts");
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{t("pr")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={lineConfig} className="h-56 w-full">
          <LineChart data={points}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="recall" type="number" domain={[0, 1]} tickCount={6} />
            <YAxis dataKey="precision" type="number" domain={[0, 1]} tickCount={6} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="precision" stroke="var(--chart-2)" dot={false} strokeWidth={2} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function ImportanceChart({
  importance
}: {
  importance: { feature: string; importance: number }[];
}) {
  const t = useTranslations("experiments.charts");
  const data = importance.slice(0, 15).reverse();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("importance")}</CardTitle>
        <p className="text-muted-foreground text-xs">{t("importanceHint")}</p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={lineConfig} className="w-full" style={{ height: data.length * 26 + 40 }}>
          <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
            <XAxis type="number" hide />
            <YAxis dataKey="feature" type="category" width={140} tick={{ fontSize: 10 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="importance" fill="var(--chart-1)" radius={3} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

interface TreeNode {
  type: "split" | "leaf";
  feature?: string;
  threshold?: number;
  prediction?: string | number;
  samples: number;
  left?: TreeNode;
  right?: TreeNode;
}

function TreeNodeView({ node, depth }: { node: TreeNode; depth: number }) {
  if (node.type === "leaf") {
    return (
      <div className="bg-muted text-foreground w-fit max-w-full rounded-md border px-2.5 py-1.5 text-xs">
        <span className="font-semibold">{String(node.prediction)}</span>{" "}
        <span className="text-muted-foreground">({node.samples})</span>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="border-primary/40 bg-background text-foreground w-fit max-w-full rounded-md border px-2.5 py-1.5 font-mono text-xs">
        {node.feature} ≤ {node.threshold}{" "}
        <span className="text-muted-foreground">({node.samples})</span>
      </div>
      <div className="border-border/70 ml-5 space-y-2 border-l pl-4">
        {node.left ? <TreeNodeView node={node.left} depth={depth + 1} /> : null}
        {node.right ? <TreeNodeView node={node.right} depth={depth + 1} /> : null}
      </div>
    </div>
  );
}

export function TreeView({
  tree
}: {
  tree: { root: TreeNode; max_depth_exported: number; note: string | null };
}) {
  const t = useTranslations("experiments.charts");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("tree")}</CardTitle>
        <p className="text-muted-foreground text-xs">
          {t("treeNote", { note: tree.note ?? "—", depth: tree.max_depth_exported })}
        </p>
      </CardHeader>
      <CardContent className="max-h-96 overflow-auto">
        <TreeNodeView node={tree.root} depth={1} />
      </CardContent>
    </Card>
  );
}

export function RegressionCharts({
  predVsActual,
  residuals,
  histogram
}: {
  predVsActual: { actual: number; predicted: number }[];
  residuals: { predicted: number; residual: number }[];
  histogram: { bin: number; count: number }[];
}) {
  const t = useTranslations("experiments.charts");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("predVsActual")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={lineConfig} className="h-56 w-full">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="actual" name={t("actual")} type="number" />
              <YAxis dataKey="predicted" name={t("predicted")} type="number" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Scatter data={predVsActual} fill="var(--chart-1)" />
            </ScatterChart>
          </ChartContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("residuals")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={lineConfig} className="h-56 w-full">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="predicted" name={t("predicted")} type="number" />
              <YAxis dataKey="residual" type="number" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ReferenceLine y={0} strokeDasharray="4 4" />
              <Scatter data={residuals} fill="var(--chart-2)" />
            </ScatterChart>
          </ChartContainer>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">{t("residualsHist")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={lineConfig} className="h-48 w-full">
            <BarChart data={histogram}>
              <XAxis dataKey="bin" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--chart-1)" radius={2} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
