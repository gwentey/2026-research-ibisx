"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FlaskConicalIcon } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { overfittingCurve } from "@/lib/formation/playground";
import { cn } from "@/lib/utils";

// Bac à sable « sur-apprentissage » (B3). On augmente la PROFONDEUR de l'arbre et l'on voit
// l'exactitude d'entraînement grimper vers 100 % pendant que celle de test décroche : l'écart
// = le sur-apprentissage. Données d'ILLUSTRATION (P1).
const CURVE = overfittingCurve();
const W = 300;
const H = 120;
const PAD = 8;
const Y_MIN = 0.6;
const Y_MAX = 1.0;

function x(depth: number): number {
  const dMin = CURVE[0].depth;
  const dMax = CURVE[CURVE.length - 1].depth;
  return PAD + ((depth - dMin) / (dMax - dMin)) * (W - 2 * PAD);
}
function y(acc: number): number {
  return PAD + (1 - (acc - Y_MIN) / (Y_MAX - Y_MIN)) * (H - 2 * PAD);
}
function path(key: "train" | "test"): string {
  return CURVE.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.depth)} ${y(p[key])}`).join(" ");
}

export function OverfittingPlayground() {
  const t = useTranslations("formation.playgrounds");
  const [depth, setDepth] = useState(4);
  const point = useMemo(() => CURVE.find((p) => p.depth === depth) ?? CURVE[0], [depth]);
  const gap = point.train - point.test;
  const asPct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="bg-card space-y-4 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{t("overfitting.title")}</p>
        <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
          <FlaskConicalIcon className="size-3.5" />
          {t("illustration")}
        </span>
      </div>
      <p className="text-muted-foreground text-sm">{t("overfitting.intro")}</p>

      {/* Courbes train vs test */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t("overfitting.title")}>
        {/* écart train-test à la profondeur choisie */}
        <line
          x1={x(depth)}
          x2={x(depth)}
          y1={y(point.train)}
          y2={y(point.test)}
          className="stroke-muted-foreground/40"
          strokeWidth={6}
          strokeLinecap="round"
        />
        <path d={path("train")} fill="none" className="stroke-primary" strokeWidth={2} />
        <path
          d={path("test")}
          fill="none"
          className="stroke-chart-2"
          strokeWidth={2}
          strokeDasharray="4 3"
        />
        <circle cx={x(depth)} cy={y(point.train)} r={3.5} className="fill-primary" />
        <circle cx={x(depth)} cy={y(point.test)} r={3.5} className="fill-chart-2" />
      </svg>
      <div className="text-muted-foreground flex items-center justify-between text-[11px]">
        <span className="inline-flex items-center gap-1">
          <span className="bg-primary inline-block h-0.5 w-3" /> {t("overfitting.train")}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="bg-chart-2 inline-block h-0.5 w-3" /> {t("overfitting.test")}
        </span>
      </div>

      {/* Profondeur */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("overfitting.depthLabel")}</span>
          <span className="font-mono font-medium">{depth}</span>
        </div>
        <Slider
          value={[depth]}
          min={CURVE[0].depth}
          max={CURVE[CURVE.length - 1].depth}
          step={1}
          onValueChange={([v]) => setDepth(v)}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric label={t("overfitting.train")} value={asPct(point.train)} />
        <Metric label={t("overfitting.test")} value={asPct(point.test)} />
        <Metric label={t("overfitting.gap")} value={asPct(gap)} warn={gap >= 0.12} />
      </div>

      <p className="text-muted-foreground text-sm leading-relaxed">{t("overfitting.caption")}</p>
    </div>
  );
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn("rounded-lg py-2", warn ? "bg-destructive/5 border-destructive/30 border" : "bg-muted/30")}>
      <div className="font-semibold tabular-nums">{value}</div>
      <div className="text-muted-foreground text-[10px] tracking-wide uppercase">{label}</div>
    </div>
  );
}
