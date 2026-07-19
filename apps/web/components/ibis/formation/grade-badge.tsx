"use client";

import { useTranslations } from "next-intl";

import { GRADE_ORDER, type Grade } from "@/lib/formation/types";
import { cn } from "@/lib/utils";

// Pastille de grade = libellé + 4 segments (rang rempli). Même esprit que LevelBadge : aucune
// couleur hors tokens, la progression se lit au remplissage, jamais à une teinte.
export function GradeBadge({ grade, className }: { grade: Grade; className?: string }) {
  const t = useTranslations("formation.grades");
  const rank = GRADE_ORDER.indexOf(grade); // 0 (curieux) → 4 (analyste)

  return (
    <span
      className={cn(
        "bg-background/85 text-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur-sm",
        className
      )}>
      <span className="flex items-end gap-0.5" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn("w-1 rounded-full", i <= rank ? "bg-primary" : "bg-muted-foreground/25")}
            style={{ height: `${3 + i * 1.5}px` }}
          />
        ))}
      </span>
      {t(grade)}
    </span>
  );
}
