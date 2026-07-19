"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { useQuestStore } from "@/lib/challenges/store";
import { pathnameToObjectives } from "@/lib/challenges/objective-map";

// Coche les objectifs au fil des VRAIES routes visitées pendant qu'un défi est actif.
export function useObjectiveTracking(active: boolean) {
  const pathname = usePathname();
  const markObjective = useQuestStore((state) => state.markObjective);

  useEffect(() => {
    if (!active) return;
    for (const objective of pathnameToObjectives(pathname)) {
      markObjective(objective);
    }
  }, [active, pathname, markObjective]);
}
