"use client";

import { useTranslations } from "next-intl";

import { MissionStepper } from "@/components/ibis/mission-stepper";
import { ProjectForm } from "@/components/ibis/projects/project-form";

export default function NewProjectPage() {
  const t = useTranslations("projects.form");

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <MissionStepper current="project" />
        <h1 className="text-2xl font-semibold tracking-tight">{t("createTitle")}</h1>
      </div>
      <ProjectForm />
    </div>
  );
}
