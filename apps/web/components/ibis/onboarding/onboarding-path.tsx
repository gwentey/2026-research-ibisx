import { CheckIcon, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Pastilles de parcours à 3 nœuds (études → âge → niveau IA), horizontales, avec libellé
// visible sous chaque nœud (≠ rail vertical à numéros du wizard). Réutilise les états
// done/current/upcoming de `wizard-shell.tsx` (bordure/fond primary), juste en horizontal.
// Purement informatif (pas de navigation — l'onboarding est linéaire, contrairement au wizard).

export type OnboardingPathStep = {
  icon: LucideIcon;
  label: string;
};

type StepState = "done" | "current" | "upcoming";

function stepState(position: number, current: number): StepState {
  if (position < current) return "done";
  if (position === current) return "current";
  return "upcoming";
}

export function OnboardingPath({
  steps,
  current,
  ariaLabel
}: {
  steps: OnboardingPathStep[];
  current: number;
  /** Libellé accessible de la liste (ex. `t("step", {...})` — aucune nouvelle clé i18n). */
  ariaLabel: string;
}) {
  return (
    <ol className="flex list-none items-start justify-center" aria-label={ariaLabel}>
      {steps.map((step, index) => {
        const position = index + 1;
        const state = stepState(position, current);
        const Icon = step.icon;
        return (
          <li key={step.label} className="flex items-start">
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "mt-4.5 h-px w-8 sm:w-16",
                  state === "upcoming" ? "bg-border" : "bg-primary/40"
                )}
              />
            ) : null}
            <div className="flex w-16 flex-col items-center gap-1.5 sm:w-24">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors",
                  state === "current" && "border-primary bg-primary text-primary-foreground",
                  state === "done" && "border-primary/40 bg-primary/10 text-primary",
                  state === "upcoming" && "border-border text-muted-foreground"
                )}>
                {state === "done" ? (
                  <CheckIcon className="size-4" aria-hidden="true" />
                ) : (
                  <Icon className="size-4" aria-hidden="true" />
                )}
              </span>
              <span
                className={cn(
                  "text-center text-xs font-medium",
                  state === "upcoming" ? "text-muted-foreground" : "text-foreground"
                )}>
                {step.label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
