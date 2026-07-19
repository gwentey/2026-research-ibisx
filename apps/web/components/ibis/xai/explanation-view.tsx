"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { BookOpenIcon, LayersIcon, SparklesIcon, TargetIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Markdown } from "@/components/ui/custom/prompt/markdown";
import { CausalCaveat } from "@/components/ibis/causal-caveat";
import type { ExplanationResults, XaiAudience } from "@/lib/api/generated";
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
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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

// Décalage (ms) entre deux blocs pendant la révélation « générée par l'IA ».
const REVEAL_STAGGER = 90;

export function ExplanationView({
  explanation,
  reveal = false,
  profileAudience = null,
  effectiveAudience,
  onRegenerate,
  regenerating = false
}: {
  explanation: ExplanationResults;
  // reveal : jouer la révélation IA échelonnée (uniquement après une génération fraîche,
  // pas quand on rouvre une explication de l'historique).
  reveal?: boolean;
  // Niveau du PROFIL : si l'explication a été générée à un autre niveau → badge « en vue X ».
  profileAudience?: XaiAudience | null;
  // Niveau EFFECTIF (vue courante) : si ≠ niveau de l'explication → proposer de regénérer.
  effectiveAudience?: XaiAudience;
  onRegenerate?: () => void;
  regenerating?: boolean;
}) {
  const t = useTranslations("xai");
  const tAudience = useTranslations("audience");
  const viz = (explanation.viz_data ?? {}) as Record<string, never>;

  // Niveau auquel cette explication A ÉTÉ générée (stocké côté back = niveau effectif au moment
  // de la génération). On l'affiche toujours, et on le distingue quand il sort du profil (§5.1).
  const generatedAudience = explanation.audience_level as XaiAudience;
  const audienceLabel = (a: XaiAudience) => tAudience(`short.${a}`);
  const differsFromProfile =
    profileAudience !== null && generatedAudience !== profileAudience;
  const canRegenerate =
    onRegenerate !== undefined &&
    effectiveAudience !== undefined &&
    generatedAudience !== effectiveAudience;
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

  // Contexte « QUEL exemple » (explication locale) — répond à « de quel élément parle-t-on ? ».
  const isLocal = explanation.type === "local";
  const instanceIndex = (explanation.instance_ref as { index?: number } | null)?.index;
  const predictedLabel = values["predicted_label"] as string | null | undefined;
  const predictionRaw = values["prediction"];
  const predictionText =
    predictedLabel != null && String(predictedLabel) !== ""
      ? String(predictedLabel)
      : predictionRaw !== undefined && predictionRaw !== null
        ? String(predictionRaw)
        : null;

  // Révélation en cascade : chaque bloc émerge d'un flou, décalé — le résultat se
  // « construit » sous les yeux (effet IA), pas un simple fondu. `both` → joue une fois.
  let order = 0;
  const step = (): { className: string; style?: CSSProperties } =>
    reveal
      ? {
          className: "ai-reveal",
          style: { "--ai-delay": `${order++ * REVEAL_STAGGER}ms` } as CSSProperties
        }
      : { className: "" };

  return (
    <div className="space-y-6">
      {/* Bandeau résultat — dit clairement CE QUI est expliqué, et POUR QUEL exemple en local. */}
      <div {...step()}>
        <div className="from-ai-violet/8 via-ai/4 to-ai-blue/8 relative overflow-hidden rounded-xl border bg-gradient-to-br px-4 py-3.5">
          {reveal ? <span className="ai-sheen" aria-hidden /> : null}
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="bg-ai/12 text-ai flex size-7 shrink-0 items-center justify-center rounded-lg">
                  {isLocal ? <TargetIcon className="size-4" /> : <LayersIcon className="size-4" />}
                </span>
                <h3 className="text-sm font-semibold">
                  {isLocal ? t("result.localTitle") : t("result.globalTitle")}
                </h3>
              </div>
              {isLocal ? (
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t("result.localFor", { index: instanceIndex ?? 0 })}{" "}
                  {predictionText ? (
                    <span className="text-foreground font-semibold">{predictionText}</span>
                  ) : null}
                  {t("result.localWhy")}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t("result.globalSubtitle")}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Niveau de restitution — réintroduit (§5.1). Accentué (couleur IA) quand
                  l'explication a été générée hors du niveau du profil. */}
              <Badge
                variant="outline"
                className={cn(differsFromProfile && "border-ai/40 text-ai")}>
                {differsFromProfile
                  ? t("text.generatedAs", { level: audienceLabel(generatedAudience) })
                  : t("text.audience", { level: audienceLabel(generatedAudience) })}
              </Badge>
              <Badge variant="outline">
                {t("text.method", { method: explanation.method_used ?? "" })}
              </Badge>
              {explanation.is_fallback ? (
                <Badge variant="secondary">{t("text.fallbackBadge")}</Badge>
              ) : (
                <Badge variant="outline" className="border-ai/40 text-ai">
                  {t("text.modelBadge", { model: explanation.model_used ?? "" })}
                </Badge>
              )}
            </div>
          </div>
          {explanation.method_justification ? (
            <p className="text-muted-foreground relative mt-2 text-xs leading-relaxed">
              {explanation.method_justification}
            </p>
          ) : null}
        </div>
      </div>

      {/* Regénérer-en-vue (§5.1, décision D3) : l'explication affichée a été rédigée à un autre
          niveau que la vue courante → on propose de la refaire au niveau effectif (1 crédit,
          choix explicite). La révélation ne s'y applique pas : c'est une commande, pas un résultat. */}
      {canRegenerate && effectiveAudience ? (
        <div className="border-ai/30 bg-ai/[0.04] flex flex-col gap-2.5 rounded-lg border border-dashed p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
            <SparklesIcon className="text-ai mt-0.5 size-3.5 shrink-0" />
            {t("text.regenerateHint", {
              generated: audienceLabel(generatedAudience),
              effective: audienceLabel(effectiveAudience)
            })}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="border-ai/40 text-ai hover:bg-ai/10 shrink-0"
            onClick={onRegenerate}
            disabled={regenerating}>
            <SparklesIcon />
            {t("text.regenerateAs", { level: audienceLabel(effectiveAudience) })}
            <Badge variant="secondary" className="ml-1 font-normal">
              {t("text.regenerateCost")}
            </Badge>
          </Button>
        </div>
      ) : null}

      <div {...step()}>
        <KpiBoard kpis={(explanation.quality_kpis ?? {}) as never} />
      </div>

      {/* Colonne principale étroite (écran − sidebar) : on empile en 1 colonne pour garder des
          cartes homogènes et sans trou, quel que soit le type d'explication. */}
      {globalImportance ? (
        <div {...step()}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("charts.importance", { method: explanation.method_used ?? "" })}
              </CardTitle>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {t("charts.importanceHint")}
              </p>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={chartConfig}
                className="w-full"
                style={{ height: globalImportance.length * 24 + 40 }}>
                <BarChart
                  data={[...globalImportance].reverse()}
                  layout="vertical"
                  margin={{ left: 40 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="feature" type="category" width={150} tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="var(--chart-1)" radius={3} />
                </BarChart>
              </ChartContainer>
              <CausalCaveat className="mt-3" />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {waterfall ? (
        <div {...step()}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("charts.waterfall")}</CardTitle>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {t("charts.waterfallHint")}
              </p>
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
              {/* Légende plein-texte : vert = pousse la prédiction vers le haut, rouge = vers le bas. */}
              <div className="text-muted-foreground mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm" style={{ background: "var(--score-4)" }} />
                  {t("charts.pushesUp")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-sm"
                    style={{ background: "var(--destructive)" }}
                  />
                  {t("charts.pushesDown")}
                </span>
              </div>
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
                        fill={entry.contribution >= 0 ? "var(--score-4)" : "var(--destructive)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {comparison ? (
        <div {...step()}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("charts.comparison")}</CardTitle>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {t("charts.comparisonHint")}
              </p>
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
        </div>
      ) : null}

      {explanation.text_explanation ? (
        <div {...step()}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpenIcon className="text-ai size-4" />
                {t("text.title")}
              </CardTitle>
              <p className="text-muted-foreground text-xs">{t("text.subtitle")}</p>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/40 rounded-md border p-4">
                <Markdown className={PROSE}>{explanation.text_explanation}</Markdown>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
