"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronDownIcon,
  ClipboardListIcon,
  CompassIcon,
  type LucideIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TargetIcon,
  TimerIcon
} from "lucide-react";

import { AiAssistPanel } from "@/components/ibis/ai-assist";
import { cn } from "@/lib/utils";

// Avant de cliquer, l'utilisateur ne sait pas ce que « Générer le guide IA » va produire ni en
// quoi ça l'aide (retour Anthony). Ce bloc l'annonce AVANT l'action : les 4 sections qui seront
// écrites, le bénéfice concret, et l'honnêteté du procédé (métadonnées réelles, zéro invention).
// Habillage = motif IA unifié (AiAssistPanel : pointillé + dégradé violet→bleu, tokens `ai`).

const SECTIONS: { key: "s1" | "s2" | "s3" | "s4"; icon: LucideIcon }[] = [
  { key: "s1", icon: CompassIcon },
  { key: "s2", icon: TargetIcon },
  { key: "s3", icon: ClipboardListIcon },
  { key: "s4", icon: ShieldAlertIcon }
];

/**
 * Explication du Guide IA.
 * @param collapsible  une fois le guide généré, le bloc se replie sur une simple ligne
 *                     « À quoi sert ce guide ? » — l'explication reste accessible sans
 *                     repousser le contenu utile vers le bas.
 */
export function GuideIntro({ collapsible = false }: { collapsible?: boolean }) {
  const t = useTranslations("datasets.detail");
  // `collapsible` bascule de false à true quand le guide vient d'être généré, SANS remonter le
  // composant : un `useState(!collapsible)` resterait bloqué sur sa valeur initiale (panneau
  // déplié qui repousse le guide hors de l'écran). L'état ne mémorise donc que le choix
  // EXPLICITE de l'utilisateur ; tant qu'il n'a rien décidé, on suit la prop.
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? !collapsible;

  if (collapsible && !open) {
    return (
      <button
        type="button"
        onClick={() => setManual(true)}
        className="border-ai/40 text-ai/90 hover:border-ai/60 hover:bg-ai/5 flex w-full items-center gap-2 rounded-xl border border-dashed px-4 py-2.5 text-left text-sm font-medium transition-colors">
        <SparklesIcon className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">{t("guideAboutToggle")}</span>
        <ChevronDownIcon className="size-4 shrink-0" />
      </button>
    );
  }

  return (
    <AiAssistPanel title={t("guideAboutTitle")}>
      <p className="text-sm leading-relaxed">{t("guideAboutLead")}</p>

      {/* Les 4 sections que le guide va produire — annoncées telles qu'elles seront rendues. */}
      <div className="grid gap-2 sm:grid-cols-2">
        {SECTIONS.map(({ key, icon: Icon }) => (
          <div
            key={key}
            className="bg-background/60 border-ai/20 flex gap-2.5 rounded-lg border p-3">
            <Icon className="text-ai mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm leading-tight font-semibold">
                {t(`guideAbout${key.toUpperCase()}Title`)}
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                {t(`guideAbout${key.toUpperCase()}Body`)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Le bénéfice, en une phrase : pourquoi lancer ça avant de créer une expérience. */}
      <p className="text-sm leading-relaxed font-medium">{t("guideAboutHelp")}</p>

      <div className="text-muted-foreground space-y-1.5 text-xs">
        <p className="flex items-start gap-1.5">
          <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" />
          <span className="leading-relaxed">{t("guideAboutHonesty")}</span>
        </p>
        <p className="flex items-center gap-1.5">
          <TimerIcon className="size-3.5 shrink-0" />
          {t("guideAboutDuration")}
        </p>
      </div>

      {collapsible ? (
        <button
          type="button"
          onClick={() => setManual(false)}
          className={cn("text-muted-foreground hover:text-foreground text-xs underline")}>
          {t("guideAboutHide")}
        </button>
      ) : null}
    </AiAssistPanel>
  );
}
