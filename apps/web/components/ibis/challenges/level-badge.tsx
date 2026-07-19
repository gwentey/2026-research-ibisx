"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { ChallengeLevel } from "@/lib/challenges/types";

// Pastille de niveau = libellé + 3 barres de difficulté (1/2/3 remplies). Aucune couleur hors
// tokens : la difficulté se lit à la hauteur/remplissage, jamais à une teinte « rouge = dur ».
const RANK: Record<ChallengeLevel, number> = { novice: 1, debutant: 2, confirme: 3 };

export function LevelBadge({ level, className }: { level: ChallengeLevel; className?: string }) {
  const t = useTranslations("challenges.levels");
  const rank = RANK[level];

  return (
    <span
      className={cn(
        "bg-background/85 text-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur-sm",
        className
      )}>
      <span className="flex items-end gap-0.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn("w-1 rounded-full", i <= rank ? "bg-primary" : "bg-muted-foreground/25")}
            style={{ height: `${3 + i * 2}px` }}
          />
        ))}
      </span>
      {t(level)}
    </span>
  );
}
