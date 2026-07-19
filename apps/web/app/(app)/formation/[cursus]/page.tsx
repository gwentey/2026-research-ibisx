"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DomainPattern } from "@/components/ibis/datasets/domain-pattern";
import { ModuleCard } from "@/components/ibis/formation/module-card";
import { ProgressRing } from "@/components/ibis/progress-ring";
import { getDomainVisual } from "@/lib/datasets/domain-visuals";
import { getCursus } from "@/lib/formation/catalog";
import { cursusPercent } from "@/lib/formation/progress";
import { useAcademyStore } from "@/lib/formation/store";
import { cn } from "@/lib/utils";

export default function CursusPage({ params }: { params: Promise<{ cursus: string }> }) {
  const { cursus: cursusSlug } = use(params);
  const cursus = getCursus(cursusSlug);
  const t = useTranslations("formation");
  const lessonsDone = useAcademyStore((state) => state.lessonsDone);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const done = mounted && cursus ? lessonsDone : [];

  if (!cursus) {
    return (
      <div className="mx-auto mt-16 max-w-lg space-y-3 text-center">
        <p className="text-sm">{t("home.notFound")}</p>
        <Button asChild variant="outline">
          <Link href="/formation">{t("home.backToAcademy")}</Link>
        </Button>
      </div>
    );
  }

  const visual = getDomainVisual(cursus.domain);
  const DomainIcon = visual.icon;
  const percent = cursusPercent(cursus, done);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="text-muted-foreground -ml-2">
        <Link href="/formation">
          <ArrowLeftIcon />
          {t("home.backToAcademy")}
        </Link>
      </Button>

      {/* Bandeau hero du cursus */}
      <div className={cn("relative overflow-hidden rounded-xl p-6", visual.vignette)}>
        <DomainPattern pattern={visual.pattern} className="text-foreground/[0.08]" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="bg-background/80 text-foreground flex size-12 shrink-0 items-center justify-center rounded-xl shadow-sm backdrop-blur-sm">
              <DomainIcon className="size-6" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {t(`cursus.${cursus.slug}.title`)}
              </h1>
              <p className="text-muted-foreground text-sm">{t(`cursus.${cursus.slug}.subtitle`)}</p>
            </div>
          </div>
          <div className="bg-background/85 relative hidden size-12 shrink-0 items-center justify-center rounded-full backdrop-blur-sm sm:flex">
            <ProgressRing value={percent} size={44} strokeWidth={3} />
            <span className="absolute text-[10px] font-semibold">{percent}%</span>
          </div>
        </div>
      </div>

      {/* Les modules */}
      <div className="space-y-4">
        {cursus.modules.map((module, i) => (
          <ModuleCard
            key={module.slug}
            cursus={cursus}
            module={module}
            index={i}
            lessonsDone={done}
          />
        ))}
      </div>
    </div>
  );
}
