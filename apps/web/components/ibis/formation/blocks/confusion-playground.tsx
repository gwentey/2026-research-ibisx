"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FlaskConicalIcon } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { confusionAt, confusionMetrics, DEMO_POINTS } from "@/lib/formation/playground";
import { cn } from "@/lib/utils";

// Bac à sable « matrice de confusion » (B3). On déplace le SEUIL de décision et l'on voit, en
// direct, les 4 cases (VP/FP/VN/FN) et les métriques bouger. Données d'ILLUSTRATION (P1) :
// jamais un vrai résultat d'entraînement.
export function ConfusionPlayground() {
  const t = useTranslations("formation.playgrounds");
  const [pct, setPct] = useState(50); // seuil en % (0..100)
  const threshold = pct / 100;

  const cm = useMemo(() => confusionAt(DEMO_POINTS, threshold), [threshold]);
  const metrics = useMemo(() => confusionMetrics(cm), [cm]);
  const asPct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="bg-card space-y-4 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{t("confusion.title")}</p>
        <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
          <FlaskConicalIcon className="size-3.5" />
          {t("illustration")}
        </span>
      </div>
      <p className="text-muted-foreground text-sm">{t("confusion.intro")}</p>

      {/* Axe des scores : points par classe + trait de seuil, zone « prédit positif » ombrée. */}
      <div className="space-y-1.5">
        <div className="relative h-16 rounded-lg border">
          <div
            className="bg-primary/[0.06] absolute inset-y-0 right-0 rounded-r-lg"
            style={{ width: `${100 - pct}%` }}
            aria-hidden
          />
          <div
            className="bg-primary absolute inset-y-0 w-0.5"
            style={{ left: `${pct}%` }}
            aria-hidden
          />
          {DEMO_POINTS.map((point, i) => (
            <span
              key={i}
              className={cn(
                "absolute size-2.5 -translate-x-1/2 rounded-full",
                point.positive
                  ? "bg-score-5 top-3"
                  : "border-muted-foreground/60 bottom-3 border bg-transparent"
              )}
              style={{ left: `${point.score * 100}%` }}
              aria-hidden
            />
          ))}
        </div>
        <div className="text-muted-foreground flex items-center justify-between text-[11px]">
          <span className="inline-flex items-center gap-1">
            <span className="bg-score-5 inline-block size-2 rounded-full" /> {t("confusion.legendPos")}
          </span>
          <span>{t("confusion.predictedPositive")} →</span>
          <span className="inline-flex items-center gap-1">
            <span className="border-muted-foreground/60 inline-block size-2 rounded-full border" />{" "}
            {t("confusion.legendNeg")}
          </span>
        </div>
      </div>

      {/* Seuil */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("confusion.thresholdLabel")}</span>
          <span className="font-mono font-medium">{threshold.toFixed(2)}</span>
        </div>
        <Slider value={[pct]} min={0} max={100} step={1} onValueChange={([v]) => setPct(v)} />
      </div>

      {/* Matrice 2×2 — cases correctes en score, erreurs en sourdine. */}
      <div className="grid grid-cols-[auto_1fr_1fr] gap-1.5 text-center text-sm">
        <span />
        <span className="text-muted-foreground text-[11px]">{t("confusion.predPos")}</span>
        <span className="text-muted-foreground text-[11px]">{t("confusion.predNeg")}</span>

        <span className="text-muted-foreground flex items-center text-[11px]">
          {t("confusion.actualPos")}
        </span>
        <Cell label={t("confusion.tp")} value={cm.tp} good />
        <Cell label={t("confusion.fn")} value={cm.fn} />

        <span className="text-muted-foreground flex items-center text-[11px]">
          {t("confusion.actualNeg")}
        </span>
        <Cell label={t("confusion.fp")} value={cm.fp} />
        <Cell label={t("confusion.tn")} value={cm.tn} good />
      </div>

      {/* Métriques dérivées */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric label={t("confusion.precision")} value={asPct(metrics.precision)} />
        <Metric label={t("confusion.recall")} value={asPct(metrics.recall)} />
        <Metric label={t("confusion.accuracy")} value={asPct(metrics.accuracy)} />
      </div>

      <p className="text-muted-foreground text-sm leading-relaxed">{t("confusion.caption")}</p>
    </div>
  );
}

function Cell({ label, value, good }: { label: string; value: number; good?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border py-2",
        good ? "border-score-5/40 bg-score-5/10" : "bg-muted/40"
      )}>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-muted-foreground text-[10px] tracking-wide uppercase">{label}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-lg py-2">
      <div className="font-semibold tabular-nums">{value}</div>
      <div className="text-muted-foreground text-[10px] tracking-wide uppercase">{label}</div>
    </div>
  );
}
