"use client";

import { useTranslations } from "next-intl";
import { AlertTriangleIcon, LightbulbIcon } from "lucide-react";

// B7 — Étude de cas (« anatomie d'un fiasco »). Un cas réel et sourcé décortiqué en trois temps :
// contexte, ce qui a dérapé, et la leçon à en tirer. Sobre : pas de sensationnalisme.
export function CaseStudyBlock({ lessonSlug, blockId }: { lessonSlug: string; blockId: string }) {
  const t = useTranslations("formation");
  const base = `lessons.${lessonSlug}.${blockId}`;

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="bg-muted/40 flex items-center gap-2 border-b px-4 py-3">
        <AlertTriangleIcon className="text-muted-foreground size-4 shrink-0" />
        <div>
          <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            {t("blocks.caseLabel")}
          </p>
          <p className="leading-tight font-semibold">{t(`${base}.title`)}</p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-sm leading-relaxed">{t(`${base}.context`)}</p>
        <p className="text-sm leading-relaxed">{t(`${base}.problem`)}</p>
        <div className="border-primary/30 bg-primary/5 flex items-start gap-2.5 rounded-lg border p-3">
          <LightbulbIcon className="text-primary mt-0.5 size-4 shrink-0" />
          <div>
            <p className="text-primary mb-0.5 text-[11px] font-medium tracking-wide uppercase">
              {t("blocks.caseTakeaway")}
            </p>
            <p className="text-sm leading-relaxed">{t(`${base}.takeaway`)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
