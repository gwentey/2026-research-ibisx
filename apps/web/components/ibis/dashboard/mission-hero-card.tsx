"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, FolderIcon, PlayIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { DomainPattern } from "@/components/ibis/datasets/domain-pattern";
import { MissionStepper } from "@/components/ibis/mission-stepper";
import type { WizardDraftPointer } from "@/lib/api/generated";

// Carte hero « reprendre ma mission » (P6/lot 3, doc 04-dashboard.md).
// Motif « grille de points » chart-2 réservé à CETTE carte (matrice anti-collision,
// docs/refonte/00-synthese.md) : ailleurs il ne réapparaît que comme motif de DOMAINE
// (catalogue), jamais en fond de page. Reprend le gabarit ecommerce/welcome.tsx
// (Card bg-muted + image de fond) en remplaçant l'image par ce motif SVG local.
export function MissionHeroCard({ pendingDraft }: { pendingDraft: WizardDraftPointer | null }) {
  const t = useTranslations("dashboardHome");

  if (!pendingDraft) {
    return (
      <Card className="bg-muted/30 py-0">
        <CardContent className="p-6">
          <Empty className="border-none p-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderIcon />
              </EmptyMedia>
              <EmptyTitle>{t("hero.emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("hero.emptyBody")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href="/projects/new">
                  <PlusIcon />
                  {t("quickActions.newProject")}
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-muted/40 relative overflow-hidden">
      <DomainPattern
        pattern="dots"
        className="text-chart-2/[0.12] dark:text-chart-2/[0.18] [mask-image:linear-gradient(to_right,black,transparent)]"
      />
      <CardHeader className="relative">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
            <PlayIcon className="size-6" />
          </div>
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="text-xl font-semibold tracking-tight">{t("hero.title")}</CardTitle>
            <CardDescription>
              {t("quickActions.resumeHint", { dataset: pendingDraft.dataset_name })}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative flex flex-col gap-4">
        <MissionStepper current="training" />
        <Button asChild className="w-fit">
          <Link
            href={`/wizard?projectId=${pendingDraft.project_id}&datasetId=${pendingDraft.dataset_id}`}>
            {t("quickActions.resumeWizard")}
            <ArrowRightIcon />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
