"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, CheckCircle2Icon, LockIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { DomainPattern } from "@/components/ibis/datasets/domain-pattern";
import { ProgressRing } from "@/components/ibis/progress-ring";
import { getDomainVisual } from "@/lib/datasets/domain-visuals";
import { cursusPercent, cursusComplete } from "@/lib/formation/progress";
import type { Cursus } from "@/lib/formation/types";
import { cn } from "@/lib/utils";

// Carte de cursus : même langage tonal que ChallengeCard (vignette par domaine + motif + tuile-
// icône), orientée « niveau d'apprentissage ». La progression se lit à l'anneau. Le verrou est
// SOUPLE (indicatif) : on oriente, on ne bloque jamais (P orientation permanente).
export function CursusCard({
  cursus,
  lessonsDone,
  locked
}: {
  cursus: Cursus;
  lessonsDone: string[];
  locked: boolean;
}) {
  const t = useTranslations("formation");
  const visual = getDomainVisual(cursus.domain);
  const DomainIcon = visual.icon;
  const percent = cursusPercent(cursus, lessonsDone);
  const done = cursusComplete(cursus, lessonsDone);
  const lessonCount = cursus.modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <Link
      href={`/formation/${cursus.slug}`}
      className="group focus-visible:ring-ring block rounded-xl focus-visible:ring-2 focus-visible:outline-none">
      <Card className="flex h-full flex-col gap-0 overflow-hidden pt-0 transition-shadow hover:shadow-md">
        <div className={cn("relative h-20 overflow-hidden", visual.vignette)}>
          <DomainPattern pattern={visual.pattern} className="text-foreground/[0.08]" />
          <div className="bg-background/80 text-foreground absolute top-4 left-4 flex size-9 items-center justify-center rounded-lg shadow-sm backdrop-blur-sm">
            <DomainIcon className="size-5" />
          </div>
          <div className="absolute top-3 right-3 flex items-center gap-2">
            {locked ? (
              <span className="bg-background/85 text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] backdrop-blur-sm">
                <LockIcon className="size-3" />
                {t("home.recommendedAfter")}
              </span>
            ) : null}
            <div className="bg-background/85 relative flex size-9 items-center justify-center rounded-full backdrop-blur-sm">
              <ProgressRing value={percent} size={34} strokeWidth={3} />
              <span className="absolute text-[9px] font-semibold">{percent}%</span>
            </div>
          </div>
        </div>

        <CardContent className="flex-1 space-y-1.5 pt-4">
          <h3 className="leading-tight font-semibold">{t(`cursus.${cursus.slug}.title`)}</h3>
          <p className="text-muted-foreground text-sm">{t(`cursus.${cursus.slug}.tagline`)}</p>
        </CardContent>

        <CardFooter className="flex items-center justify-between gap-2 pt-0">
          <Badge variant="outline" className="font-normal">
            {t("home.lessonCount", { count: lessonCount })}
          </Badge>
          <span className="text-primary inline-flex items-center gap-1 text-sm font-medium">
            {done ? (
              <span className="text-muted-foreground inline-flex items-center gap-1.5">
                <CheckCircle2Icon className="text-primary size-4" />
                {t("home.cursusDone")}
              </span>
            ) : (
              <>
                {percent > 0 ? t("home.resume") : t("home.startCursus")}
                <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
