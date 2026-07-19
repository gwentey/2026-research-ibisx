"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BarChart3Icon,
  BrainCircuitIcon,
  CheckIcon,
  CoinsIcon,
  DatabaseIcon,
  EraserIcon,
  RocketIcon,
  Settings2Icon,
  SlidersHorizontalIcon,
  SplitIcon,
  TargetIcon,
  type LucideIcon
} from "lucide-react";

import Logo from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MissionStepper } from "@/components/ibis/mission-stepper";
import { ProgressRing } from "@/components/ibis/progress-ring";
import { useAuthStore } from "@/lib/auth/store";
import { cn } from "@/lib/utils";

export const STEP_ICONS: Record<number, LucideIcon> = {
  1: DatabaseIcon,
  2: TargetIcon,
  3: EraserIcon,
  4: SplitIcon,
  5: SlidersHorizontalIcon,
  6: BrainCircuitIcon,
  7: Settings2Icon,
  8: RocketIcon,
  9: BarChart3Icon
};

const STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function WizardShell({
  step,
  maxReachedStep,
  datasetName,
  projectId,
  canNext,
  navLocked,
  onGoTo,
  onNext,
  children
}: {
  step: number;
  maxReachedStep: number;
  datasetName: string;
  projectId: string;
  canNext: boolean;
  navLocked: boolean;
  onGoTo: (step: number) => void;
  onNext: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("wizard");
  const tCommon = useTranslations("common");
  const credits = useAuthStore((state) => state.user?.credits ?? 0);
  const visualStep = Math.min(step, 9);
  const HeaderIcon = STEP_ICONS[visualStep];
  const progress = Math.round((visualStep / 9) * 100);

  const stepState = (candidate: number) =>
    candidate === visualStep
      ? "current"
      : candidate < visualStep
        ? "done"
        : candidate <= maxReachedStep
          ? "reachable"
          : "locked";

  return (
    <div className="bg-muted/30 flex min-h-screen">
      {/* ------------------------------- Rail gauche (style v1) ------------------------- */}
      <aside className="bg-background sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r lg:flex">
        <div className="flex items-center gap-2.5 px-5 pt-5">
          <Logo />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t("title")}</p>
            <p className="text-muted-foreground truncate text-xs">{datasetName}</p>
          </div>
        </div>

        <nav className="mt-6 flex-1 space-y-0.5 overflow-y-auto px-3">
          {STEPS.map((candidate) => {
            const state = stepState(candidate);
            const disabled = state === "locked" || navLocked;
            return (
              <button
                key={candidate}
                type="button"
                disabled={disabled}
                onClick={() => onGoTo(candidate)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                  state === "current" && "bg-primary/10 text-primary font-medium",
                  state !== "current" && !disabled && "hover:bg-muted",
                  state === "locked" && "text-muted-foreground/50 cursor-not-allowed"
                )}>
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium transition-colors",
                    state === "current" && "border-primary bg-primary text-primary-foreground",
                    state === "done" && "border-primary/40 bg-primary/10 text-primary",
                    state === "reachable" && "border-border",
                    state === "locked" && "border-border/60"
                  )}>
                  {state === "done" ? <CheckIcon className="size-3.5" /> : candidate}
                </span>
                <span className="truncate">{t(`steps.${candidate}` as never)}</span>
              </button>
            );
          })}
        </nav>

        <div className="space-y-3 border-t p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <CoinsIcon className="size-3.5" />
              {tCommon("credits", { count: credits })}
            </span>
            <span className="font-mono text-xs font-medium">{credits}</span>
          </div>
          <Progress value={Math.min(100, credits)} className="h-1.5" />
          <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
            <Link href={`/projects/${projectId}`}>
              <ArrowLeftIcon />
              {t("backToProject")}
            </Link>
          </Button>
        </div>
      </aside>

      {/* ------------------------------- Colonne principale ----------------------------- */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="bg-background/95 sticky top-0 z-10 border-b px-4 py-3 backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
            <MissionStepper current="training" />
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground hidden text-xs sm:block">
                {t("stepOf", { current: visualStep, total: 9 })}
              </span>
              <div className="relative">
                <ProgressRing value={progress} />
                <span className="text-foreground absolute inset-0 flex items-center justify-center text-[10px] font-semibold">
                  {visualStep}
                </span>
              </div>
            </div>
          </div>

          {/* Étapes compactes (mobile — le rail est masqué) */}
          <div className="mt-3 flex gap-1 overflow-x-auto pb-1 lg:hidden">
            {STEPS.map((candidate) => {
              const state = stepState(candidate);
              return (
                <button
                  key={candidate}
                  type="button"
                  disabled={state === "locked" || navLocked}
                  onClick={() => onGoTo(candidate)}
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-0.5 text-xs",
                    state === "current" && "border-primary bg-primary text-primary-foreground",
                    state === "done" && "border-primary/40 text-primary",
                    state === "locked" && "text-muted-foreground/50"
                  )}>
                  {candidate}
                </button>
              );
            })}
          </div>
        </header>

        <main
          className="mx-auto w-full max-w-4xl flex-1 px-4 pt-8 sm:px-8"
          // Réserve l'espace de la barre flottante du traceur de quête sous le contenu : sinon
          // le CTA de bas d'étape (« J'ai compris, commencer ») passe derrière elle (défi actif).
          style={{ paddingBottom: "calc(2rem + var(--quest-tracker-height, 0px))" }}>
          <div className="mb-6 flex items-start gap-4">
            <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
              <HeaderIcon className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {t(`steps.${visualStep}` as never)}
              </h1>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {t(`subtitles.${visualStep}` as never)}
              </p>
            </div>
          </div>
          {children}
        </main>

        {/* ------------------------------- Barre de navigation basse -------------------- */}
        <footer
          className="bg-background/95 sticky z-10 border-t px-4 py-3 backdrop-blur sm:px-8"
          // Flotte juste au-dessus du traceur de quête quand un défi est actif (sinon 0px) :
          // les commandes « Précédent / Suivant » restent visibles et cliquables.
          style={{ bottom: "var(--quest-tracker-height, 0px)" }}>
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <Button
              variant="outline"
              disabled={visualStep <= 1 || navLocked}
              onClick={() => onGoTo(visualStep - 1)}>
              <ArrowLeftIcon />
              <span className="hidden sm:inline">{t("back")}</span>
            </Button>

            <div className="hidden items-center gap-1.5 sm:flex">
              {STEPS.map((candidate) => {
                const state = stepState(candidate);
                return (
                  <button
                    key={candidate}
                    type="button"
                    aria-label={t(`steps.${candidate}` as never)}
                    disabled={state === "locked" || navLocked}
                    onClick={() => onGoTo(candidate)}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full border text-[11px] font-medium transition-colors",
                      state === "current" && "border-primary bg-primary text-primary-foreground",
                      state === "done" &&
                        "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
                      state === "reachable" && "hover:bg-muted",
                      state === "locked" && "text-muted-foreground/40 cursor-not-allowed"
                    )}>
                    {candidate}
                  </button>
                );
              })}
            </div>

            {step > 1 && step < 8 ? (
              // Étape 1 : le CTA « J'ai compris, commencer » (dans le contenu) est
              // l'unique action pour avancer — pas de bouton « Suivant » redondant ici.
              <Button disabled={!canNext || navLocked} onClick={onNext}>
                <span className="hidden sm:inline">{t("next")}</span>
                <ArrowRightIcon />
              </Button>
            ) : (
              <div className="w-24" aria-hidden />
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
