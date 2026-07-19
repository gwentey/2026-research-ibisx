"use client";

import { Suspense, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  SparklesIcon,
  SwordsIcon,
  XIcon
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { getChallenge } from "@/lib/challenges/catalog";
import { coachLocation } from "@/lib/challenges/objective-map";
import { nextObjective, progressPercent } from "@/lib/challenges/progress";
import { useQuestStore } from "@/lib/challenges/store";
import { useObjectiveTracking } from "@/components/ibis/challenges/use-objective-tracking";
import { cn } from "@/lib/utils";

// Traceur de quête : bandeau flottant discret qui accompagne l'utilisateur à travers les vraies
// pages tant qu'un défi est actif. Coche les objectifs sur les vraies transitions, porte une
// micro-consigne de coach au niveau novice, et propose de quitter.
function QuestTrackerInner() {
  const t = useTranslations("challenges");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const activeSlug = useQuestStore((state) => state.activeSlug);
  const done = useQuestStore((state) => state.done);
  const start = useQuestStore((state) => state.start);
  const quit = useQuestStore((state) => state.quit);
  const collapsed = useQuestStore((state) => state.collapsed);
  const setCollapsed = useQuestStore((state) => state.setCollapsed);

  // Réhydrate le défi actif depuis ?challenge= si le store est vide (rechargement, ou passage
  // vers le wizard qui vit hors du groupe (app) et remonte donc un traceur neuf).
  const paramSlug = searchParams.get("challenge");
  useEffect(() => {
    if (paramSlug && !activeSlug && getChallenge(paramSlug)) start(paramSlug);
  }, [paramSlug, activeSlug, start]);

  const slug = activeSlug ?? (paramSlug && getChallenge(paramSlug) ? paramSlug : null);
  useObjectiveTracking(Boolean(slug));

  // Publie la hauteur réelle du traceur dans --quest-tracker-height. Les surfaces à action basse
  // (barre de navigation du wizard, contenu des pages app) réservent cet espace pour que la barre
  // flottante ne recouvre plus aucun bouton (ex. « J'ai compris, commencer » à l'étape 1).
  // Mesuré via ResizeObserver : suit le repli en pastille et les retours à la ligne responsives.
  const observerRef = useRef<ResizeObserver | null>(null);
  const measureRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    const root = document.documentElement;
    if (!node) {
      root.style.setProperty("--quest-tracker-height", "0px");
      return;
    }
    const publish = () => root.style.setProperty("--quest-tracker-height", `${node.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(node);
    observerRef.current = observer;
  }, []);
  useEffect(
    () => () => {
      observerRef.current?.disconnect();
      document.documentElement.style.setProperty("--quest-tracker-height", "0px");
    },
    []
  );

  const challenge = slug ? getChallenge(slug) : undefined;
  if (!challenge) return null;

  const percent = progressPercent(challenge.objectives, done);
  const upcoming = nextObjective(challenge.objectives, done);
  const total = challenge.objectives.length;
  const doneCount = challenge.objectives.filter((objective) => done.includes(objective)).length;

  // Coach indexé sur la PAGE courante (pas l'objectif) : le bon geste, là où l'utilisateur est.
  const location = coachLocation(pathname);
  const coachKey = location ? (`items.${slug}.coach.${location}` as const) : null;
  const showCoach =
    challenge.level === "novice" && upcoming !== null && coachKey !== null && t.has(coachKey);

  // Replié à la demande : pastille compacte au centre-bas. La barre flotte au-dessus des vraies
  // pages (aucun cale-pied en flux qui déformerait la mise en page) ; ce repli laisse donc
  // l'utilisateur dégager un bouton masqué puis rouvrir le traceur quand il veut.
  if (collapsed) {
    return (
      <div
        ref={measureRef}
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 print:hidden">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label={t("expand")}
          className="bg-background/95 text-foreground pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-2.5 rounded-full border py-1.5 pr-4 pl-1.5 shadow-lg backdrop-blur transition-colors hover:bg-background">
          <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full">
            <SwordsIcon className="size-4" />
          </span>
          <span className="hidden min-w-0 max-w-[40vw] truncate text-sm font-medium sm:inline">
            {t(`items.${slug}.title`)}
          </span>
          <span className="text-muted-foreground text-xs font-medium tabular-nums">{percent}%</span>
          <ChevronUpIcon className="text-muted-foreground size-4 shrink-0" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={measureRef}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 print:hidden">
      <div className="bg-background/95 pointer-events-auto flex w-full max-w-3xl flex-col gap-3 rounded-xl border p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
            <SwordsIcon className="size-4" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <p className="text-muted-foreground truncate text-[11px] font-medium tracking-wide uppercase">
              {t(`items.${slug}.title`)}
            </p>
            {upcoming ? (
              <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                <span className="text-muted-foreground">{t("currentObjective")} :</span>
                {t(`objectives.${upcoming}`)}
              </p>
            ) : (
              <p className="text-primary flex items-center gap-1.5 text-sm font-medium">
                <CheckCircle2Icon className="size-4" />
                {t("debriefTitle")}
              </p>
            )}
            {showCoach && coachKey ? (
              <p className="text-ai flex items-center gap-1.5 text-xs">
                <SparklesIcon className="size-3.5 shrink-0" />
                {t(coachKey)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3 sm:shrink-0">
          {/* Progression des objectifs (pips) */}
          <div className="flex items-center gap-1.5" aria-label={`${doneCount}/${total}`}>
            <div className="flex gap-1" aria-hidden>
              {challenge.objectives.map((objective) => (
                <span
                  key={objective}
                  className={cn(
                    "h-1.5 w-4 rounded-full transition-colors",
                    done.includes(objective) ? "bg-primary" : "bg-muted-foreground/25"
                  )}
                />
              ))}
            </div>
            <span className="text-muted-foreground text-xs tabular-nums">{percent}%</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(true)}
              aria-label={t("collapse")}
              className="text-muted-foreground hover:text-foreground size-8 shrink-0">
              <ChevronDownIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={quit}
              className="text-muted-foreground hover:text-foreground shrink-0">
              <XIcon className="size-4" />
              <span className="hidden sm:inline">{t("quit")}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function QuestTracker() {
  // useSearchParams doit vivre sous une frontière Suspense (même patron que le wizard).
  return (
    <Suspense fallback={null}>
      <QuestTrackerInner />
    </Suspense>
  );
}
