"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, FolderIcon, PlayIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DomainPattern } from "@/components/ibis/datasets/domain-pattern";
import { MissionStepper } from "@/components/ibis/mission-stepper";
import type { WizardDraftPointer } from "@/lib/api/generated";

// Carte hero « reprendre ma mission » (P6/lot 3, doc 04-dashboard.md).
// Refonte (lot correctifs) : bande horizontale DENSE, hauteur réduite pour ne plus
// écraser les KPI — tuile-icône + intitulé + MissionStepper + CTA sur une même rangée
// (repli en colonne sous lg). Motif « grille de points » chart-2 réservé à CETTE carte
// (matrice anti-collision, docs/refonte/00-synthese.md) : ailleurs il ne réapparaît que
// comme motif de DOMAINE (catalogue), jamais en fond de page.
export function MissionHeroCard({ pendingDraft }: { pendingDraft: WizardDraftPointer | null }) {
  const t = useTranslations("dashboardHome");

  if (!pendingDraft) {
    // État vide : même bande compacte, tuile neutre (pas de mission en cours à « reprendre »).
    return (
      <Card className="bg-muted/30 relative overflow-hidden py-0">
        <DomainPattern
          pattern="dots"
          className="text-chart-2/[0.08] dark:text-chart-2/[0.12] [mask-image:linear-gradient(to_right,black,transparent)]"
        />
        <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="bg-muted text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-xl">
              <FolderIcon className="size-5" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="font-semibold">{t("hero.emptyTitle")}</p>
              <p className="text-muted-foreground text-sm">{t("hero.emptyBody")}</p>
            </div>
          </div>
          <Button asChild size="sm" className="w-fit shrink-0 sm:ml-auto">
            <Link href="/projects/new">
              <PlusIcon />
              {t("quickActions.newProject")}
            </Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-muted/40 relative overflow-hidden py-0">
      <DomainPattern
        pattern="dots"
        className="text-chart-2/[0.12] dark:text-chart-2/[0.18] [mask-image:linear-gradient(to_right,black,transparent)]"
      />
      <div className="relative flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:gap-6">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
            <PlayIcon className="size-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              {t("hero.title")}
            </p>
            <p className="truncate font-semibold">
              {t("quickActions.resumeHint", { dataset: pendingDraft.dataset_name })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
          <MissionStepper current="training" />
          <Button asChild size="sm" className="w-fit">
            <Link
              href={`/wizard?projectId=${pendingDraft.project_id}&datasetId=${pendingDraft.dataset_id}`}>
              {t("quickActions.resumeWizard")}
              <ArrowRightIcon />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
