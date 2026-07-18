"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  DatabaseIcon,
  FlaskConicalIcon,
  FolderIcon,
  PlusIcon,
  TimerIcon,
  TrendingDownIcon,
  TrendingUpIcon
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MissionHeroCard } from "@/components/ibis/dashboard/mission-hero-card";
import { RecentActivityTimeline } from "@/components/ibis/dashboard/recent-activity-timeline";
import { RecentProjectsList } from "@/components/ibis/dashboard/recent-projects-list";
import { StatTile, type StatTrend } from "@/components/ibis/dashboard/stat-tile";
import { getDashboard } from "@/lib/api/generated";
import type { DashboardResponse } from "@/lib/api/generated";
import { useAuthStore } from "@/lib/auth/store";

// Dashboard M7 : chaque chiffre vient d'une agrégation SQL réelle (P1).
// Refonte P6/lot 3 (docs/refonte/04-dashboard.md) : cockpit personnel — hero « reprendre
// ma mission » (motif points chart-2, réservé à cette carte), stat tiles tonales,
// timeline d'activité, liste de projets récents. Ordre de lecture volontaire :
// salutation → où j'en suis → mes chiffres → ce qui vient de se passer → ce que je
// peux faire ensuite. Aucun nouvel appel réseau : toujours un seul getDashboard().
export default function DashboardPage() {
  const t = useTranslations("dashboardHome");
  const user = useAuthStore((state) => state.user);
  const [data, setData] = useState<DashboardResponse | null>(null);

  useEffect(() => {
    getDashboard({ throwOnError: false }).then(({ data: result }) => setData(result ?? null));
  }, []);

  const name = user?.pseudo || user?.given_name || null;

  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-44 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Aucun delta temporel inventé : le seul signal qualitatif ajouté dérive d'une vraie
  // valeur déjà exposée (success_rate), jamais d'un pourcentage fictif (P1).
  const successTrend: StatTrend | null =
    data.kpis.success_rate !== null && data.kpis.success_rate !== undefined
      ? data.kpis.success_rate >= 0.5
        ? { icon: TrendingUpIcon, label: t("kpis.successGood") }
        : { icon: TrendingDownIcon, label: t("kpis.successLow") }
      : null;

  const kpiTiles = [
    {
      icon: FlaskConicalIcon,
      tone: "chart-1" as const,
      label: t("kpis.experiments"),
      value: String(data.kpis.total_experiments),
      trend: null
    },
    {
      icon: FolderIcon,
      tone: "chart-2" as const,
      label: t("kpis.projects"),
      value: String(data.kpis.active_projects),
      trend: null
    },
    {
      icon: TrendingUpIcon,
      tone: "chart-3" as const,
      label: t("kpis.successRate"),
      // Taux ABSENT tant qu'aucune expérience terminée — jamais un faux 0 % (P1)
      value:
        data.kpis.success_rate !== null && data.kpis.success_rate !== undefined
          ? `${Math.round(data.kpis.success_rate * 100)}%`
          : t("kpis.noData"),
      trend: successTrend
    },
    {
      icon: TimerIcon,
      tone: "chart-4" as const,
      label: t("kpis.avgDuration"),
      value:
        data.kpis.average_duration_seconds !== null &&
        data.kpis.average_duration_seconds !== undefined
          ? `${data.kpis.average_duration_seconds}s`
          : t("kpis.noData"),
      trend: null
    }
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {name ? t("welcome", { name }) : t("welcomeFallback")}
      </h1>

      <MissionHeroCard pendingDraft={data.pending_draft} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiTiles.map((tile) => (
          <StatTile
            key={tile.label}
            icon={tile.icon}
            tone={tile.tone}
            label={tile.label}
            value={tile.value}
            trend={tile.trend}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <RecentActivityTimeline items={data.recent_activity} />

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
            </CardContent>
          </Card>

          <RecentProjectsList projects={data.recent_projects} />
        </div>
      </div>
    </div>
  );
}
