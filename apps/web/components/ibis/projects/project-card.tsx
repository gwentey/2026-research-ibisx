"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ClockIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { MissionStepper } from "@/components/ibis/mission-stepper";
import type { ProjectRead } from "@/lib/api/generated";

/**
 * Carte projet (09 — espace de pilotage). Signature : le `MissionStepper`
 * partagé sert de colonne vertébrale à CHAQUE carte — il rappelle que ce
 * projet est configuré (étape « Projet ») et que la suite du fil (Dataset →
 * Entraînement → Explication) se poursuit en l'ouvrant. Données réelles
 * uniquement (critères actifs, pondérations, date de MAJ du client généré).
 */
export function ProjectCard({ project }: { project: ProjectRead }) {
  const t = useTranslations("projects");
  const locale = useLocale();
  const weightsCount = Object.keys(project.weights).length;

  return (
    <Card className="group gap-4 py-5 transition-shadow hover:shadow-md">
      <CardHeader className="gap-3">
        <div className="min-w-0">
          <Link
            href={`/projects/${project.id}`}
            className="line-clamp-1 font-semibold hover:underline">
            {project.name}
          </Link>
          {project.description ? (
            <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">
              {project.description}
            </p>
          ) : null}
        </div>
        {/* Fil de mission : colonne vertébrale de la carte (voir l'en-tête du fichier). */}
        <div className="border-t pt-3">
          <MissionStepper current="project" />
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="font-normal">
            {t("card.criteria", { count: project.active_criteria_count })}
          </Badge>
          <Badge variant="secondary" className="font-normal">
            {t("card.weights", { count: weightsCount })}
          </Badge>
        </div>
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <ClockIcon className="size-3" />
          {t("card.updated", { date: new Date(project.updated_at).toLocaleDateString(locale) })}
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href={`/projects/${project.id}`}>{t("card.open")}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
