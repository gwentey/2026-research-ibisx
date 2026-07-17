"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  ActivityIcon,
  DatabaseIcon,
  FlaskConicalIcon,
  FolderIcon,
  LightbulbIcon,
  PlayIcon,
  PlusIcon,
  TimerIcon,
  TrendingUpIcon
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboard } from "@/lib/api/generated";
import type { DashboardResponse } from "@/lib/api/generated";
import { useAuthStore } from "@/lib/auth/store";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  running: "secondary",
  pending: "outline",
  failed: "destructive",
  cancelled: "outline"
};

// Dashboard M7 : chaque chiffre vient d'une agrégation SQL réelle (P1).
export default function DashboardPage() {
  const t = useTranslations("dashboardHome");
  const tExp = useTranslations("experiments");
  const locale = useLocale();
  const user = useAuthStore((state) => state.user);
  const [data, setData] = useState<DashboardResponse | null>(null);

  useEffect(() => {
    getDashboard({ throwOnError: false }).then(({ data: result }) => setData(result ?? null));
  }, []);

  const name = user?.pseudo || user?.given_name || null;

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const kpiTiles = [
    {
      icon: FlaskConicalIcon,
      label: t("kpis.experiments"),
      value: String(data.kpis.total_experiments)
    },
    { icon: FolderIcon, label: t("kpis.projects"), value: String(data.kpis.active_projects) },
    {
      icon: TrendingUpIcon,
      label: t("kpis.successRate"),
      // Taux ABSENT tant qu'aucune expérience terminée — jamais un faux 0 % (P1)
      value:
        data.kpis.success_rate !== null && data.kpis.success_rate !== undefined
          ? `${Math.round(data.kpis.success_rate * 100)}%`
          : t("kpis.noData")
    },
    {
      icon: TimerIcon,
      label: t("kpis.avgDuration"),
      value:
        data.kpis.average_duration_seconds !== null &&
        data.kpis.average_duration_seconds !== undefined
          ? `${data.kpis.average_duration_seconds}s`
          : t("kpis.noData")
    }
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {name ? t("welcome", { name }) : t("welcomeFallback")}
      </h1>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiTiles.map((tile) => (
          <Card key={tile.label} className="py-4">
            <CardContent className="flex items-center gap-3">
              <tile.icon className="text-muted-foreground size-5 shrink-0" />
              <div>
                <p className="text-2xl font-semibold">{tile.value}</p>
                <p className="text-muted-foreground text-xs">{tile.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ActivityIcon className="size-4" />
              {t("activity.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recent_activity.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("activity.empty")}</p>
            ) : (
              <div className="space-y-2">
                {data.recent_activity.map((item) => (
                  <div
                    key={`${item.kind}-${item.ref_id}`}
                    className="flex items-center gap-2 text-sm">
                    {item.kind === "experiment" ? (
                      <FlaskConicalIcon className="text-muted-foreground size-4 shrink-0" />
                    ) : (
                      <LightbulbIcon className="text-muted-foreground size-4 shrink-0" />
                    )}
                    <span className="text-muted-foreground text-xs">
                      {item.kind === "experiment"
                        ? t("activity.experiment")
                        : t("activity.explanation")}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                    <Badge variant={STATUS_VARIANT[item.status] ?? "outline"}>
                      {tExp.has(`status.${item.status}`)
                        ? tExp(`status.${item.status}`)
                        : item.status}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {new Date(item.created_at).toLocaleString(locale)}
                    </span>
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/experiments/${item.experiment_id}`}>
                        {t("activity.view")}
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("quickActions.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link href="/projects/new">
                  <PlusIcon />
                  {t("quickActions.newProject")}
                </Link>
              </Button>
              <Button className="w-full justify-start" variant="outline" asChild>
                <Link href="/datasets">
                  <DatabaseIcon />
                  {t("quickActions.exploreDatasets")}
                </Link>
              </Button>
              {data.pending_draft ? (
                <Button className="w-full justify-start" asChild>
                  <Link
                    href={`/wizard?projectId=${data.pending_draft.project_id}&datasetId=${data.pending_draft.dataset_id}`}>
                    <PlayIcon />
                    <span className="truncate">
                      {t("quickActions.resumeHint", {
                        dataset: data.pending_draft.dataset_name
                      })}
                    </span>
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("recentProjects.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.recent_projects.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("recentProjects.empty")}</p>
              ) : (
                data.recent_projects.map((project) => (
                  <div key={project.id} className="flex items-center gap-2 text-sm">
                    <FolderIcon className="text-muted-foreground size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{project.name}</span>
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/projects/${project.id}`}>{t("recentProjects.open")}</Link>
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
