"use client";

import { useTranslations } from "next-intl";
import { BrainCircuitIcon, DatabaseIcon, FolderIcon, LightbulbIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type MissionStep = "project" | "dataset" | "training" | "explanation";

const STEPS: { key: MissionStep; icon: typeof FolderIcon }[] = [
  { key: "project", icon: FolderIcon },
  { key: "dataset", icon: DatabaseIcon },
  { key: "training", icon: BrainCircuitIcon },
  { key: "explanation", icon: LightbulbIcon }
];

/** Fil de mission (P5, CDC §1.6) : Projet → Dataset → Entraînement → Explication. */
export function MissionStepper({ current }: { current: MissionStep }) {
  const t = useTranslations("projects.mission");
  const currentIndex = STEPS.findIndex((step) => step.key === current);

  return (
    <nav aria-label="mission" className="flex flex-wrap items-center gap-1 text-xs">
      {STEPS.map((step, index) => (
        <div key={step.key} className="flex items-center gap-1">
          {index > 0 ? <span className="text-muted-foreground/50 px-1">→</span> : null}
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1",
              index === currentIndex
                ? "border-primary bg-primary text-primary-foreground font-medium"
                : index < currentIndex
                  ? "border-primary/40 text-foreground"
                  : "text-muted-foreground"
            )}>
            <step.icon className="size-3" />
            {t(step.key)}
          </span>
        </div>
      ))}
    </nav>
  );
}
