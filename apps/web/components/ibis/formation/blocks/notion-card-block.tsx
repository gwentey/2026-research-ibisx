"use client";

import { useTranslations } from "next-intl";
import { SparklesIcon } from "lucide-react";

// B4 — Carte-notion collectionnable. Recto (terme) + verso (définition + exemple). Gagnée à la
// complétion de la leçon (ajoutée au « deck »). Ici on la présente en clair, teintée « notion ».
export function NotionCardBlock({ notionId }: { notionId: string }) {
  const t = useTranslations("formation");
  const base = `notions.${notionId}`;

  return (
    <div className="border-primary/25 bg-primary/[0.04] rounded-xl border p-4">
      <p className="text-primary mb-2 inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
        <SparklesIcon className="size-3.5" />
        {t("blocks.notionLabel")}
      </p>
      <p className="font-semibold">{t(`${base}.term`)}</p>
      <p className="mt-1 text-sm leading-relaxed">{t(`${base}.definition`)}</p>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        <span className="text-foreground/70 font-medium">{t("blocks.notionExample")} </span>
        {t(`${base}.example`)}
      </p>
    </div>
  );
}
