"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FolderPlusIcon } from "lucide-react";

import { MissionStepper } from "@/components/ibis/mission-stepper";
import { ProjectForm } from "@/components/ibis/projects/project-form";
import type { CatalogFilters } from "@/lib/datasets/use-catalog";

/** Lit un éventuel pré-remplissage (?domains=&tasks=&name=) transmis par
 *  « Utiliser dans un projet » d'une fiche dataset, et le passe au formulaire. */
function PrefilledProjectForm() {
  const params = useSearchParams();
  const domains = params.get("domains");
  const tasks = params.get("tasks");
  const name = params.get("name");

  const criteria: CatalogFilters = {};
  if (domains) criteria.domains = domains.split(",").filter(Boolean);
  if (tasks) criteria.tasks = tasks.split(",").filter(Boolean);

  const prefill =
    domains || tasks || name
      ? {
          name: name ?? undefined,
          criteria: Object.keys(criteria).length > 0 ? criteria : undefined
        }
      : undefined;

  return <ProjectForm prefill={prefill} />;
}

export default function NewProjectPage() {
  const t = useTranslations("projects.form");

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <MissionStepper current="project" />
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
            <FolderPlusIcon className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {t("createTitle")}
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">{t("createSubtitle")}</p>
          </div>
        </div>
      </div>
      <Suspense fallback={null}>
        <PrefilledProjectForm />
      </Suspense>
    </div>
  );
}
