"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  DatabaseIcon,
  Loader2Icon,
  TrophyIcon
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DomainPattern } from "@/components/ibis/datasets/domain-pattern";
import { LevelBadge } from "@/components/ibis/challenges/level-badge";
import { getDomainVisual } from "@/lib/datasets/domain-visuals";
import type { Challenge } from "@/lib/challenges/types";
import { cn } from "@/lib/utils";

// Briefing d'une enquête : bandeau tonal par domaine + narration datée (l'enquête), objectifs
// numérotés, récompense, et le bouton de départ. La pédagogie est visuelle (P principe EducIA).
export function ChallengeBriefing({
  challenge,
  datasetId,
  launching,
  onStart
}: {
  challenge: Challenge;
  datasetId: string | null;
  launching: boolean;
  onStart: () => void;
}) {
  const t = useTranslations("challenges");
  const visual = getDomainVisual(challenge.domain);
  const DomainIcon = visual.icon;
  const slug = challenge.slug;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="text-muted-foreground -ml-2">
        <Link href="/challenges">
          <ArrowLeftIcon />
          {t("backToList")}
        </Link>
      </Button>

      {/* Bandeau hero teinté par domaine */}
      <div className={cn("relative overflow-hidden rounded-xl p-6", visual.vignette)}>
        <DomainPattern pattern={visual.pattern} className="text-foreground/[0.08]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="bg-background/80 text-foreground flex size-12 shrink-0 items-center justify-center rounded-xl shadow-sm backdrop-blur-sm">
            <DomainIcon className="size-6" />
          </div>
          <div className="min-w-0 space-y-2">
            <LevelBadge level={challenge.level} />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {t(`items.${slug}.title`)}
            </h1>
            <p className="text-muted-foreground text-sm">{t(`items.${slug}.tagline`)}</p>
          </div>
        </div>
      </div>

      {/* L'enquête */}
      <section className="space-y-3">
        <h2 className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
          {t("briefingTitle")}
        </h2>
        <p className="leading-relaxed">{t(`items.${slug}.brief`)}</p>
        <p className="text-muted-foreground text-sm leading-relaxed">{t(`items.${slug}.stakes`)}</p>
      </section>

      {/* Objectifs */}
      <section className="space-y-3">
        <h2 className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
          {t("objectivesTitle")}
        </h2>
        <ol className="space-y-2">
          {challenge.objectives.map((objective, index) => (
            <li key={objective} className="flex items-center gap-3">
              <span className="border-primary/40 text-primary flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
                {index + 1}
              </span>
              <span className="text-sm">{t(`objectives.${objective}`)}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Récompense + départ */}
      <Card className="bg-muted/30">
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <TrophyIcon className="text-primary mt-0.5 size-5 shrink-0" />
            <p className="text-sm">{t(`items.${slug}.reward`)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={onStart} disabled={launching}>
              {launching ? <Loader2Icon className="animate-spin" /> : null}
              {t("start")}
              {launching ? null : <ArrowRightIcon />}
            </Button>
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <DatabaseIcon className="size-3.5" />
              {t(`levelHints.${challenge.level}`)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
