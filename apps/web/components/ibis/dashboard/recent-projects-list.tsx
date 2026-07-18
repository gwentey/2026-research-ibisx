"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { FolderIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle
} from "@/components/ui/item";
import type { RecentProject } from "@/lib/api/generated";

// Liste des projets récents (P6/lot 3, doc 04-dashboard.md) : remplace les lignes
// <div className="flex items-center gap-2"> par les primitives Item/ItemGroup
// (jusqu'ici inexploitées côté dashboard), pour un niveau de densité cohérent avec
// le reste de la refonte (catalogue, scoring).
export function RecentProjectsList({ projects }: { projects: RecentProject[] }) {
  const t = useTranslations("dashboardHome");
  const locale = useLocale();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("recentProjects.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <Empty className="border-none p-0 py-6">
            <EmptyMedia variant="icon">
              <FolderIcon />
            </EmptyMedia>
            <EmptyTitle>{t("recentProjects.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("recentProjects.empty")}</EmptyDescription>
          </Empty>
        ) : (
          <ItemGroup className="gap-1">
            {projects.map((project) => (
              <Item key={project.id} size="sm" variant="outline">
                <ItemMedia variant="icon">
                  <FolderIcon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="truncate">{project.name}</ItemTitle>
                  <ItemDescription>
                    {new Date(project.updated_at).toLocaleDateString(locale)}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/projects/${project.id}`}>{t("recentProjects.open")}</Link>
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </CardContent>
      <CardFooter className="border-t p-0!">
        <Button variant="link" className="w-full rounded-none" asChild>
          <Link href="/projects">{t("recentProjects.viewAll")}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
