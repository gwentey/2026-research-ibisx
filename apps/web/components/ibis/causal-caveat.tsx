"use client";

import { useTranslations } from "next-intl";
import { WaypointsIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Garde-fou honnête (audit C5) : rappeler que l'importance des variables / SHAP mesure une
// ASSOCIATION, pas un effet causal. Note MÉTHODOLOGIQUE (pas un statut système) → style
// monochrome sobre, jamais de couleur sémantique ni le motif --ai. À poser sous tout affichage
// d'importance de variables (résultats natifs + SHAP).

export function CausalCaveat({ className }: { className?: string }) {
  const t = useTranslations("causal");
  return (
    <div className={cn("bg-muted/40 flex gap-2.5 rounded-lg border border-dashed p-3", className)}>
      <WaypointsIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide uppercase">{t("title")}</p>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{t("body")}</p>
      </div>
    </div>
  );
}
