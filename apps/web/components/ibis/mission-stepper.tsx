"use client";

import { useTranslations } from "next-intl";
import {
  BrainCircuitIcon,
  CheckIcon,
  DatabaseIcon,
  FolderIcon,
  LightbulbIcon
} from "lucide-react";

import { cn } from "@/lib/utils";

export type MissionStep = "project" | "dataset" | "training" | "explanation";

const STEPS: { key: MissionStep; icon: typeof FolderIcon }[] = [
  { key: "project", icon: FolderIcon },
  { key: "dataset", icon: DatabaseIcon },
  { key: "training", icon: BrainCircuitIcon },
  { key: "explanation", icon: LightbulbIcon }
];

/**
 * Fil de mission (P5, CDC §1.6) : Projet → Dataset → Entraînement → Explication.
 * Repère de progression dans le parcours IBIS-X (pas une navigation cliquable).
 * `label` optionnel : légende de tête pour lever toute ambiguïté sur son rôle.
 */
export function MissionStepper({
  current,
  label
}: {
  current: MissionStep;
  label?: string;
}) {
  const t = useTranslations("projects.mission");
  const currentIndex = STEPS.findIndex((step) => step.key === current);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {label ? (
        <span className="text-muted-foreground/80 text-[11px] font-medium tracking-wide uppercase">
          {label}
        </span>
      ) : null}
      <nav
        aria-label={label ?? "mission"}
        className="flex flex-wrap items-center gap-1 text-xs">
        {STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          const StepIcon = step.icon;
          return (
            <div key={step.key} className="flex items-center gap-1">
              {index > 0 ? (
                <span className="text-muted-foreground/40 px-0.5" aria-hidden>
                  →
                </span>
              ) : null}
              <span
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground font-medium"
                    : done
                      ? "border-primary/40 text-foreground"
                      : "text-muted-foreground"
                )}>
                {done ? (
                  <CheckIcon className="size-3" aria-hidden />
                ) : (
                  <StepIcon className="size-3" aria-hidden />
                )}
                {t(step.key)}
              </span>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
