"use client";

import { CheckIcon, ClipboardListIcon, ScanSearchIcon, UploadCloudIcon, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

// Stepper horizontal à pilules (SANS rail latéral) — signature visuelle distincte du
// wizard 9 étapes (docs/refonte/07-formulaires.md). 3 temps de l'atelier upload :
// Fichiers → Analyse → Métadonnées.

const STEP_ICONS: Record<number, LucideIcon> = {
  1: UploadCloudIcon,
  2: ScanSearchIcon,
  3: ClipboardListIcon
};

const STEP_LABEL_KEYS: Record<number, "stepperFiles" | "stepperAnalysis" | "stepperMetadata"> = {
  1: "stepperFiles",
  2: "stepperAnalysis",
  3: "stepperMetadata"
};

export function UploadStepper({
  step,
  onStepClick
}: {
  step: number;
  /** Permet de revenir à une étape déjà validée (candidate < step). Optionnel. */
  onStepClick?: (step: number) => void;
}) {
  const t = useTranslations("datasets.uploadWizard");

  return (
    <ol className="flex flex-wrap items-center gap-2 sm:gap-3">
      {[1, 2, 3].map((candidate, index) => {
        const state = candidate === step ? "current" : candidate < step ? "done" : "locked";
        const Icon = STEP_ICONS[candidate];
        const clickable = state === "done" && Boolean(onStepClick);
        return (
          <li key={candidate} className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => (clickable ? onStepClick?.(candidate) : undefined)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                state === "current" && "border-primary bg-primary/10 text-primary",
                state === "done" &&
                  "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10",
                state === "locked" && "text-muted-foreground/60 border-border/60",
                !clickable && "cursor-default"
              )}>
              {state === "done" ? (
                <CheckIcon className="size-3.5" />
              ) : (
                <Icon className="size-3.5" />
              )}
              {t(STEP_LABEL_KEYS[candidate])}
            </button>
            {index < 2 ? <span className="bg-border h-px w-4 sm:w-8" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}
