"use client";

import { useTranslations } from "next-intl";
import { TriangleAlertIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LENSES } from "@/lib/lenses/catalog";
import type { LensId, ResultInsights } from "@/lib/lenses/types";

// La MÊME donnée réelle, lue à travers les yeux d'une discipline. V1 déterministe :
// aucun texte inventé, aucun chiffre inventé — et surtout PAS le motif `--ai` (réservé au
// vrai généré-IA, sinon on mentirait sur la nature du contenu). Style pédagogique monochrome.

function pct(value: number): number {
  return Math.round(value * 100);
}

export function LensReading({
  lensId,
  insights,
  metricLabel
}: {
  lensId: LensId;
  insights: ResultInsights;
  metricLabel?: string;
}) {
  const t = useTranslations("lenses");
  const Icon = LENSES[lensId].icon;

  const sensitiveList = insights.sensitiveFeatures.length
    ? insights.sensitiveFeatures.map((key) => t(`sensitive.${key}` as never)).join(", ")
    : null;

  const points: string[] = [];

  if (lensId === "economist") {
    if (insights.topFeatures[0]) {
      points.push(
        t("economist.topFeature", {
          feature: insights.topFeatures[0].feature,
          percent: pct(insights.topFeatures[0].importance)
        })
      );
    }
    if (insights.topFeatures.length >= 3) {
      points.push(
        t("economist.others", {
          second: insights.topFeatures[1].feature,
          third: insights.topFeatures[2].feature
        })
      );
    }
    if (insights.primaryMetric) {
      points.push(
        t("economist.metric", {
          metric: metricLabel ?? insights.primaryMetric.key,
          value: insights.primaryMetric.value
        })
      );
    }
  } else if (lensId === "jurist") {
    points.push(sensitiveList ? t("reading.sensitiveList", { list: sensitiveList }) : t("reading.noSensitive"));
    points.push(t("jurist.automated"));
  } else if (lensId === "politist") {
    points.push(
      insights.taskType === "classification" && insights.classCount > 0
        ? t("politist.sampleClassification", {
            count: insights.classCount,
            names: insights.classNames.join(", ")
          })
        : t("politist.sampleGeneric")
    );
    points.push(t("politist.representativeness"));
  } else if (lensId === "sociologist") {
    if (insights.topFeatures[0]) {
      points.push(t("sociologist.mechanism", { feature: insights.topFeatures[0].feature }));
    }
    points.push(t("sociologist.structure"));
  } else if (lensId === "historian") {
    points.push(t("historian.provenance"));
    points.push(t("historian.silence"));
  } else if (lensId === "ethicist") {
    points.push(sensitiveList ? t("reading.sensitiveList", { list: sensitiveList }) : t("reading.noSensitive"));
    points.push(t("ethicist.honesty"));
    points.push(t("ethicist.purpose"));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-base">
              {t("reading.heading", { name: t(`${lensId}.name` as never) })}
            </CardTitle>
            <p className="text-muted-foreground mt-0.5 text-sm">{t(`${lensId}.tagline` as never)}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {points.map((point, index) => (
            <li key={index} className="flex gap-2.5 text-sm leading-relaxed">
              <span className="bg-muted-foreground/40 mt-2 size-1.5 shrink-0 rounded-full" aria-hidden />
              <span>{point}</span>
            </li>
          ))}
        </ul>

        <div className="bg-muted/50 flex gap-2.5 rounded-lg border p-3">
          <TriangleAlertIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide uppercase">{t("reading.blindspot")}</p>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              {t(`${lensId}.caveat` as never)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
