"use client";

import { useTranslations } from "next-intl";
import { BookOpenIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Markdown } from "@/components/ui/custom/prompt/markdown";
import type { ExplanationResults } from "@/lib/api/generated";
import { cn } from "@/lib/utils";

// Recette de style markdown (pas de plugin prose dans ce projet → sélecteurs utilitaires).
const PROSE = cn(
  "text-sm leading-relaxed [&>*:first-child]:mt-0",
  "[&_p]:mb-3 [&_p:last-child]:mb-0",
  "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1",
  "[&_strong]:font-semibold [&_a]:text-primary [&_a]:underline",
  "[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold",
  "[&_h2]:mt-4 [&_h2]:mb-1.5 [&_h2]:text-sm [&_h2]:font-semibold",
  "[&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-medium",
  "[&_code]:text-xs",
  "[&_table]:my-3 [&_table]:w-full [&_table]:text-xs [&_th]:border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:px-2 [&_td]:py-1",
  "[&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:italic"
);

// Rendu d'une explication TERMINÉE : bandeau KPI, graphes viz_data, texte, chat.

type KpiTone = "good" | "warn" | "bad" | "neutral";

const TONE_TEXT: Record<KpiTone, string> = {
  good: "text-green-600 dark:text-green-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
  neutral: ""
};

const TONE_DOT: Record<KpiTone, string> = {
  good: "bg-green-600 dark:bg-green-400",
  warn: "bg-amber-600 dark:bg-amber-400",
  bad: "bg-red-600 dark:bg-red-400",
  neutral: "bg-muted-foreground/40"
};

function KpiTile({
  label,
  hint,
  value,
  tone
}: {
  label: string;
  hint: string;
  value: string;
  tone: KpiTone;
}) {
  return (
    <div className="bg-muted/30 flex h-full flex-col gap-1.5 rounded-lg border p-3" title={hint}>
      <p className="text-muted-foreground text-xs leading-tight">{label}</p>
      <p className={cn("flex items-start gap-1.5 text-sm leading-snug font-semibold", TONE_TEXT[tone])}>
        <span
          className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", TONE_DOT[tone])}
          aria-hidden
        />
        <span className="min-w-0">{value}</span>
      </p>
    </div>
  );
}

function KpiBoard({ kpis }: { kpis: Record<string, never> }) {
  const t = useTranslations("xai.kpis");
  const completeness = kpis["shap_completeness"] as
    | { error: number; satisfied: boolean }
    | undefined;
  const stability = kpis["stability"] as
    | { spearman_mean: number; label: string }
    | undefined;
  const fidelity = kpis["lime_fidelity"] as { r2: number; label: string } | undefined;
  const agreement = kpis["inter_method_agreement"] as { spearman: number } | undefined;
  const parsimony = kpis["parsimony"] as { k: number; total_features: number } | undefined;
  const seconds = kpis["computation_seconds"] as number | undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <p className="text-muted-foreground text-xs">{t("hint")}</p>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {completeness ? (
          <KpiTile
            label={t("completeness")}
            hint={t("completenessHint")}
            value={`${completeness.satisfied ? t("satisfied") : t("violated")} (${(completeness.error * 100).toFixed(2)}%)`}
            tone={completeness.satisfied ? "good" : "bad"}
          />
        ) : null}
        {stability ? (
          <KpiTile
            label={t("stability")}
            hint={t("stabilityHint")}
            value={`${t(`labels.${stability.label}` as never)} (ρ=${stability.spearman_mean})`}
            tone={
              stability.label === "very_stable"
                ? "good"
                : stability.label === "stable"
                  ? "warn"
                  : "bad"
            }
          />
        ) : null}
        {fidelity ? (
          <KpiTile
            label={t("fidelity")}
            hint={t("fidelityHint")}
            value={`${t(`labels.${fidelity.label}` as never)} (R²=${fidelity.r2})`}
            tone={fidelity.label === "high" ? "good" : fidelity.label === "medium" ? "warn" : "bad"}
          />
        ) : null}
        {agreement ? (
          <KpiTile
            label={t("agreement")}
            hint={t("agreementHint")}
            value={`ρ=${agreement.spearman}`}
            tone={agreement.spearman >= 0.7 ? "good" : agreement.spearman >= 0.4 ? "warn" : "bad"}
          />
        ) : null}
        {parsimony ? (
          <KpiTile
            label={t("parsimony")}
            hint={t("parsimonyHint")}
            value={t("parsimonyValue", { k: parsimony.k, total: parsimony.total_features })}
            tone="neutral"
          />
        ) : null}
        {seconds !== undefined ? (
          <KpiTile label={t("time")} hint="" value={`${seconds}s`} tone="neutral" />
        ) : null}
      </CardContent>
    </Card>
  );
}

const chartConfig = { serie: { label: "", color: "var(--chart-1)" } };

export function ExplanationView({ explanation }: { explanation: ExplanationResults }) {
  const t = useTranslations("xai");
  const viz = (explanation.viz_data ?? {}) as Record<string, never>;
  const values = (explanation.values ?? {}) as Record<string, never>;
  const globalImportance = viz["global_importance"] as
    | { feature: string; value: number }[]
    | undefined;
  const waterfall = viz["waterfall"] as
    | { feature: string; contribution: number }[]
    | undefined;
  const comparison = viz["method_comparison"] as
    | { shap: { feature: string; value: number }[]; lime: { feature: string; value: number }[] }
    | undefined;

  return (
    <div className="space-y-6">
      <div className="bg-muted/30 space-y-2 rounded-lg border px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("result.title")}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">
              {t("text.method", { method: explanation.method_used ?? "" })}
            </Badge>
            {explanation.is_fallback ? (
              <Badge variant="secondary">{t("text.fallbackBadge")}</Badge>
            ) : (
              <Badge variant="outline">
                {t("text.modelBadge", { model: explanation.model_used ?? "" })}
              </Badge>
            )}
            <Badge variant="outline">
              {t("text.audience", { level: explanation.audience_level })}
            </Badge>
          </div>
        </div>
        {explanation.method_justification ? (
          <p className="text-muted-foreground text-xs">{explanation.method_justification}</p>
        ) : null}
      </div>

      <KpiBoard kpis={(explanation.quality_kpis ?? {}) as never} />

      <div className="grid items-start gap-4 xl:grid-cols-2">
        {globalImportance ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("charts.importance", { method: explanation.method_used ?? "" })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={chartConfig}
                className="w-full"
                style={{ height: globalImportance.length * 24 + 40 }}>
                <BarChart data={[...globalImportance].reverse()} layout="vertical" margin={{ left: 40 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="feature" type="category" width={150} tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="var(--chart-1)" radius={3} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        ) : null}

        {waterfall ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("charts.waterfall")}</CardTitle>
              <p className="text-muted-foreground text-xs">
                {values["base_value"] !== undefined
                  ? t("charts.baseValue", { value: String(values["base_value"]) })
                  : null}{" "}
                {values["prediction"] !== undefined
                  ? t("charts.prediction", {
                      value: String(values["prediction"]),
                      label: String(values["predicted_label"] ?? "")
                    })
                  : null}
              </p>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={chartConfig}
                className="w-full"
                style={{ height: waterfall.length * 26 + 40 }}>
                <BarChart data={[...waterfall].reverse()} layout="vertical" margin={{ left: 40 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="feature" type="category" width={150} tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <Bar dataKey="contribution" radius={3}>
                    {[...waterfall].reverse().map((entry, index) => (
                      <Cell
                        key={index}
                        fill={
                          entry.contribution >= 0 ? "var(--score-4)" : "var(--destructive)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        ) : null}

        {comparison ? (
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{t("charts.comparison")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {(["shap", "lime"] as const).map((method) => (
                <div key={method}>
                  <p className="mb-1 text-xs font-medium uppercase">{method}</p>
                  {comparison[method].map((item) => (
                    <div key={item.feature} className="flex items-center gap-2 text-xs">
                      <span className="w-32 truncate">{item.feature}</span>
                      <div className="bg-muted h-1.5 flex-1 rounded">
                        <div
                          className="bg-primary h-1.5 rounded"
                          style={{
                            width: `${Math.min(100, (item.value / Math.max(...comparison[method].map((i) => i.value), 1e-9)) * 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {explanation.text_explanation ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpenIcon className="text-muted-foreground size-4" />
              {t("text.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/40 rounded-md border p-4">
              <Markdown className={PROSE}>{explanation.text_explanation}</Markdown>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
