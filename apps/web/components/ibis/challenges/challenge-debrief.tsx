"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, DownloadIcon, TrophyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CHALLENGES, getChallenge } from "@/lib/challenges/catalog";
import { resolveDatasetId } from "@/lib/challenges/resolve-dataset";
import { nextObjective } from "@/lib/challenges/progress";
import { useQuestStore } from "@/lib/challenges/store";
import { listExplanations } from "@/lib/api/generated";
import type { ExperimentResults, ExperimentWithQueue } from "@/lib/api/generated";

// Encart de débrief, rendu DANS la page de résultats réelle (il commente les vraies métriques).
// Ne s'affiche que si un défi est actif ET que ce résultat lui appartient (même dataset) ET que
// l'expérience a réellement abouti (P1). Coche read_results, et generate_explanation seulement
// quand une VRAIE explication existe.
export function ChallengeDebrief({
  experiment,
  results
}: {
  experiment: ExperimentWithQueue;
  results: ExperimentResults | null;
}) {
  const t = useTranslations("challenges");
  const tExp = useTranslations("experiments");
  const activeSlug = useQuestStore((state) => state.activeSlug);
  const done = useQuestStore((state) => state.done);
  const completed = useQuestStore((state) => state.completed);
  const markObjective = useQuestStore((state) => state.markObjective);

  const challenge = activeSlug ? getChallenge(activeSlug) : undefined;
  const succeeded = experiment.status === "completed";

  // Ce résultat appartient-il au défi actif ? (dataset du défi == dataset de l'expérience)
  const [belongs, setBelongs] = useState<boolean | null>(null);
  useEffect(() => {
    if (!challenge || !succeeded) {
      setBelongs(false);
      return;
    }
    let active = true;
    void resolveDatasetId(challenge.datasetSlug).then((id) => {
      if (active) setBelongs(id != null && id === experiment.dataset_id);
    });
    return () => {
      active = false;
    };
  }, [challenge, succeeded, experiment.dataset_id]);

  const show = Boolean(challenge) && succeeded && belongs === true;

  // Arrivée sur les résultats d'une expérience réussie = objectif « lire les résultats » atteint.
  useEffect(() => {
    if (show) markObjective("read_results");
  }, [show, markObjective]);

  // generate_explanation : coché uniquement quand une explication réelle (status completed) existe.
  const needsExplanation =
    (challenge?.objectives.includes("generate_explanation") ?? false) &&
    !done.includes("generate_explanation");
  useEffect(() => {
    if (!show || !needsExplanation) return;
    let active = true;
    const check = async () => {
      const res = await listExplanations({
        path: { experiment_id: experiment.id },
        throwOnError: false
      });
      const items = (res.data ?? []) as Array<{ status?: string }>;
      if (active && items.some((item) => item.status === "completed")) {
        markObjective("generate_explanation");
      }
    };
    void check();
    const timer = setInterval(() => void check(), 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [show, needsExplanation, experiment.id, markObjective]);

  // Métrique principale RÉELLE (mêmes gardes de type que la page de résultats).
  const metricText = useMemo(() => {
    const metrics = results?.metrics;
    const key = metrics?.primary_metric;
    if (metrics && typeof key === "string" && typeof metrics[key] === "number") {
      const label = tExp.has(`metrics.${key}` as never) ? tExp(`metrics.${key}` as never) : key;
      return `${label} ${metrics[key] as number}`;
    }
    return t("metricFallback");
  }, [results, t, tExp]);

  if (!show || !challenge) return null;

  const remaining = nextObjective(challenge.objectives, done);
  const nextChallenge = CHALLENGES.find(
    (candidate) => candidate.slug !== challenge.slug && !completed.includes(candidate.slug)
  );

  return (
    <div className="border-primary/30 from-primary/[0.06] relative overflow-hidden rounded-xl border bg-gradient-to-br to-transparent p-5">
      <div className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
          <TrophyIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-semibold">
            {t("debriefLead", { title: t(`items.${challenge.slug}.title`) })}
          </p>
          <p className="text-sm">{t("debriefMetric", { metric: metricText })}</p>
          <p className="text-muted-foreground text-sm">{t(`debriefPont.${challenge.level}`)}</p>
          {remaining ? (
            <p className="text-ai text-sm font-medium">
              {t("debriefRemaining", { objective: t(`objectives.${remaining}`) })}
            </p>
          ) : null}
          {challenge.level === "confirme" ? (
            <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <DownloadIcon className="size-3.5" />
              {t("downloadHint")}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            {nextChallenge ? (
              <Button size="sm" asChild>
                <Link href={`/challenges/${nextChallenge.slug}`}>
                  {t("next")}
                  <ArrowRightIcon />
                </Link>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" asChild>
              <Link href="/challenges">{t("backToList")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
