"use client";

import { useTranslations } from "next-intl";
import {
  BrainCircuitIcon,
  FolderPlusIcon,
  GraduationCapIcon,
  SearchIcon,
  type LucideIcon
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Remplace l'ancien « Où situer ce dataset » (un stepper de mission hors-contexte, jugé
// déroutant sur une page de consultation). Ici, on ENSEIGNE : un petit parcours en 3 temps
// « Explorer → Créer un projet → Entraîner & comprendre », l'étape courante mise en avant
// (« Vous êtes ici »). Plateforme éducative → on guide plutôt que de nommer un emplacement.
export function DatasetHowToUse() {
  const td = useTranslations("datasets.detail");

  const steps: { icon: LucideIcon; title: string; body: string; current: boolean }[] = [
    { icon: SearchIcon, title: td("howStep1Title"), body: td("howStep1Body"), current: true },
    { icon: FolderPlusIcon, title: td("howStep2Title"), body: td("howStep2Body"), current: false },
    {
      icon: BrainCircuitIcon,
      title: td("howStep3Title"),
      body: td("howStep3Body"),
      current: false
    }
  ];

  return (
    <section className="bg-muted/30 rounded-xl border p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-md">
          <GraduationCapIcon className="size-4" />
        </span>
        <h2 className="text-sm font-semibold">{td("howToTitle")}</h2>
      </div>

      <ol className="grid gap-2 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className={cn(
              "bg-card relative flex gap-3 rounded-lg border p-3",
              step.current ? "border-primary/50 ring-primary/15 ring-2" : "border-border"
            )}>
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold",
                step.current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
              {index + 1}
            </span>
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <step.icon
                  className={cn(
                    "size-3.5 shrink-0",
                    step.current ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <p className="text-sm font-medium">{step.title}</p>
              </div>
              <p className="text-muted-foreground text-xs leading-snug">{step.body}</p>
              {step.current ? (
                <Badge variant="secondary" className="mt-1 gap-1">
                  {td("howHere")}
                </Badge>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
