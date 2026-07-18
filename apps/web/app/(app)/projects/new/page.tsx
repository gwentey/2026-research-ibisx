"use client";

import { useTranslations } from "next-intl";
import { FolderPlusIcon } from "lucide-react";

import { MissionStepper } from "@/components/ibis/mission-stepper";
import { ProjectForm } from "@/components/ibis/projects/project-form";

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
      <ProjectForm />
    </div>
  );
}
