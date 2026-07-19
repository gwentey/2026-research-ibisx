"use client";

import { useTranslations } from "next-intl";
import { CheckIcon, XIcon } from "lucide-react";

// B1 — Mythe → Réalité. Ouvre une leçon en démontant une idée reçue. Sobre : pas de rouge
// « erreur » criard, la distinction se lit à l'icône (barré vs coché) et à la structure.
export function MythBlock({ lessonSlug, blockId }: { lessonSlug: string; blockId: string }) {
  const t = useTranslations("formation");
  const base = `lessons.${lessonSlug}.${blockId}`;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="bg-muted/40 rounded-xl border p-4">
        <p className="text-muted-foreground mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
          <XIcon className="size-3.5" />
          {t("blocks.mythLabel")}
        </p>
        <p className="text-muted-foreground text-sm line-through decoration-muted-foreground/40">
          {t(`${base}.myth`)}
        </p>
      </div>
      <div className="border-primary/30 bg-primary/5 rounded-xl border p-4">
        <p className="text-primary mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
          <CheckIcon className="size-3.5" />
          {t("blocks.realityLabel")}
        </p>
        <p className="text-sm">{t(`${base}.reality`)}</p>
      </div>
    </div>
  );
}
