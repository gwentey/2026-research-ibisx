"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { GraduationCapIcon, SparklesIcon } from "lucide-react";

import { CursusCard } from "@/components/ibis/formation/cursus-card";
import { GradeBadge } from "@/components/ibis/formation/grade-badge";
import { ProgressRing } from "@/components/ibis/progress-ring";
import { CURSUS, cursusInOrder } from "@/lib/formation/catalog";
import { cursusComplete, gradeFor } from "@/lib/formation/progress";
import { useAcademyStore } from "@/lib/formation/store";

export default function FormationHomePage() {
  const t = useTranslations("formation");
  const lessonsDone = useAcademyStore((state) => state.lessonsDone);

  // La progression vit dans localStorage : on ne l'affiche qu'après montage (parité SSR/CSR).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const done = mounted ? lessonsDone : [];

  const ordered = cursusInOrder();
  const totalLessons = CURSUS.reduce(
    (n, c) => n + c.modules.reduce((m, mod) => m + mod.lessons.length, 0),
    0
  );
  const doneCount = done.length;
  const percent = totalLessons > 0 ? Math.round((doneCount / totalLessons) * 100) : 0;
  const grade = gradeFor(CURSUS, done);

  return (
    <div className="space-y-8">
      {/* En-tête + grade + progression globale */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
            <GraduationCapIcon className="size-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("home.title")}</h1>
            <p className="text-muted-foreground max-w-2xl text-sm">{t("home.subtitle")}</p>
            <GradeBadge grade={grade} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <ProgressRing value={percent} size={52} strokeWidth={4} />
            <span className="absolute text-xs font-semibold">{percent}%</span>
          </div>
          <p className="text-muted-foreground text-sm">
            {t("home.globalProgress", { done: doneCount, total: totalLessons })}
          </p>
        </div>
      </div>

      {/* Le manifeste — la thèse « l'IA n'est pas ChatGPT » */}
      <div className="border-primary/25 from-primary/[0.05] rounded-xl border bg-gradient-to-br to-transparent p-5">
        <p className="text-primary inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
          <SparklesIcon className="size-3.5" />
          {t("home.pitchLabel")}
        </p>
        <p className="mt-2 leading-relaxed">{t("home.pitch")}</p>
      </div>

      {/* Les cursus */}
      <div className="grid gap-4 sm:grid-cols-2">
        {ordered.map((cursus, i) => {
          const locked = i > 0 && !cursusComplete(ordered[i - 1], done);
          return <CursusCard key={cursus.slug} cursus={cursus} lessonsDone={done} locked={locked} />;
        })}
      </div>

      <p className="text-muted-foreground text-center text-xs">{t("home.moreSoon")}</p>
    </div>
  );
}
