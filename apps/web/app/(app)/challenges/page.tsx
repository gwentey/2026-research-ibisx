"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { SwordsIcon } from "lucide-react";

import { ChallengeCard } from "@/components/ibis/challenges/challenge-card";
import { ProgressRing } from "@/components/ibis/progress-ring";
import { CHALLENGES, challengesByLevel } from "@/lib/challenges/catalog";
import { useQuestStore } from "@/lib/challenges/store";
import type { ChallengeLevel } from "@/lib/challenges/types";

const LEVELS: ChallengeLevel[] = ["novice", "debutant", "confirme"];

export default function ChallengesPage() {
  const t = useTranslations("challenges");
  const completed = useQuestStore((state) => state.completed);

  // La progression vit dans localStorage : on ne l'affiche qu'après montage pour que le premier
  // rendu client corresponde au rendu serveur (pas de mismatch d'hydratation).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const total = CHALLENGES.length;
  const doneCount = mounted ? CHALLENGES.filter((c) => completed.includes(c.slug)).length : 0;
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* En-tête + progression globale */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
            <SwordsIcon className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
            <p className="text-muted-foreground mt-0.5 max-w-2xl text-sm">{t("subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <ProgressRing value={percent} size={52} strokeWidth={4} />
            <span className="absolute text-xs font-semibold">{percent}%</span>
          </div>
          <p className="text-muted-foreground text-sm">
            {t("progressGlobal", { done: doneCount, total })}
          </p>
        </div>
      </div>

      {/* Sections par niveau */}
      {LEVELS.map((level) => (
        <section key={level} className="space-y-4">
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold">{t(`levels.${level}`)}</h2>
            <p className="text-muted-foreground text-sm">{t(`levelHints.${level}`)}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {challengesByLevel(level).map((challenge) => (
              <ChallengeCard
                key={challenge.slug}
                challenge={challenge}
                completed={mounted && completed.includes(challenge.slug)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
