"use client";

import { use, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { FolderPenIcon } from "lucide-react";

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
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
            <FolderPenIcon className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {t("editTitle")}
            </h1>
            <p className="text-muted-foreground mt-0.5 text-sm">{t("editSubtitle")}</p>
          </div>
        </div>
      </div>
      <ProjectForm existing={project} />
    </div>
  );
}
