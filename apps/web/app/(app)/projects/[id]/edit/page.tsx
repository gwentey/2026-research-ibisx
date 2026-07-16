"use client";

import { use, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { MissionStepper } from "@/components/ibis/mission-stepper";
import { ProjectForm } from "@/components/ibis/projects/project-form";
import { getProject } from "@/lib/api/generated";
import type { ProjectRead } from "@/lib/api/generated";

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("projects.form");
  const [project, setProject] = useState<ProjectRead | null>(null);

  useEffect(() => {
    getProject({ path: { project_id: id }, throwOnError: false }).then(({ data }) =>
      setProject(data ?? null)
    );
  }, [id]);

  if (!project) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <MissionStepper current="project" />
        <h1 className="text-2xl font-semibold tracking-tight">{t("editTitle")}</h1>
      </div>
      <ProjectForm existing={project} />
    </div>
  );
}
