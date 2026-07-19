"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, CheckCircle2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { DomainPattern } from "@/components/ibis/datasets/domain-pattern";
import { LevelBadge } from "@/components/ibis/challenges/level-badge";
import { getDomainVisual } from "@/lib/datasets/domain-visuals";
import type { Challenge } from "@/lib/challenges/types";
import { cn } from "@/lib/utils";

// Carte de défi : même langage tonal que dataset-card (vignette colorée par domaine + motif
// SVG + tuile-icône), mais orientée « enquête à relever ». Pastille de niveau en haut-droite,
// statut (à relever / relevé) et affordance de départ en pied.
export function ChallengeCard({
  challenge,
  completed
}: {
  challenge: Challenge;
  completed: boolean;
}) {
  const t = useTranslations("challenges");
  const visual = getDomainVisual(challenge.domain);
  const DomainIcon = visual.icon;

  return (
    <Link
      href={`/challenges/${challenge.slug}`}
      className="group focus-visible:ring-ring block rounded-xl focus-visible:ring-2 focus-visible:outline-none">
      <Card className="flex h-full flex-col gap-0 overflow-hidden pt-0 transition-shadow hover:shadow-md">
        <div className={cn("relative h-20 overflow-hidden", visual.vignette)}>
          <DomainPattern pattern={visual.pattern} className="text-foreground/[0.08]" />
          <div className="bg-background/80 text-foreground absolute top-4 left-4 flex size-9 items-center justify-center rounded-lg shadow-sm backdrop-blur-sm">
            <DomainIcon className="size-5" />
          </div>
          <LevelBadge level={challenge.level} className="absolute top-3 right-3" />
        </div>

        <CardContent className="flex-1 space-y-1.5 pt-4">
          <h3 className="leading-tight font-semibold">{t(`items.${challenge.slug}.title`)}</h3>
          <p className="text-muted-foreground text-sm">{t(`items.${challenge.slug}.tagline`)}</p>
        </CardContent>

        <CardFooter className="flex items-center justify-between gap-2 pt-0">
          <Badge variant="outline" className="font-normal">
            {t(`task.${challenge.taskType}`)}
          </Badge>
          <span className="text-primary inline-flex items-center gap-1 text-sm font-medium">
            {completed ? (
              <span className="text-muted-foreground inline-flex items-center gap-1.5">
                <CheckCircle2Icon className="text-primary size-4" />
                {t("status.done")}
              </span>
            ) : (
              <>
                {t("start")}
                <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
