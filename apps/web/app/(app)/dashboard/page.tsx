"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowRightIcon,
  DatabaseIcon,
  FlaskConicalIcon,
  FolderIcon,
  GaugeIcon,
  PlusIcon,
  TimerIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  type LucideIcon
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { MissionHeroCard } from "@/components/ibis/dashboard/mission-hero-card";
import { RecentActivityTimeline } from "@/components/ibis/dashboard/recent-activity-timeline";
import { RecentProjectsList } from "@/components/ibis/dashboard/recent-projects-list";
import { StatTile, type StatTrend } from "@/components/ibis/dashboard/stat-tile";
import { getDashboard } from "@/lib/api/generated";
import type { DashboardResponse } from "@/lib/api/generated";
import { useAuthStore } from "@/lib/auth/store";
import { cn } from "@/lib/utils";

// Dashboard M7 : chaque chiffre vient d'une agrégation SQL réelle (P1).
// Refonte P6/lot 3 (docs/refonte/04-dashboard.md) : cockpit personnel — hero « reprendre
// ma mission » compact (motif points chart-2, réservé à cette carte), stat tiles tonales,
// timeline d'activité, liste de projets récents, tuiles d'action. Ordre de lecture
// volontaire : salutation → où j'en suis → mes chiffres → ce qui vient de se passer →
// mes projets → ce que je peux faire ensuite. Aucun nouvel appel réseau : un seul
// getDashboard().

// Fragments de teinte littéraux (Tailwind JIT ne voit que les chaînes complètes) — nuances
// chart-1..3 purement tonales, jamais une couleur inventée. Gradient doux sur token.
const ACTION_TONE: Record<"chart-1" | "chart-2" | "chart-3", string> = {
  "chart-1": "bg-chart-1/10 from-chart-1/15 text-chart-1",
  "chart-2": "bg-chart-2/10 from-chart-2/15 text-chart-2",
  "chart-3": "bg-chart-3/10 from-chart-3/15 text-chart-3"
};

// Tuile d'action vivante : tuile-icône tonale (gradient sur token), titre + description,
// flèche qui glisse au survol, carte qui s'élève. Cible de clic = toute la carte.
function ActionTile({
  href,
  icon: Icon,
  tone,
  title,
  description
}: {
  href: string;
  icon: LucideIcon;
  tone: keyof typeof ACTION_TONE;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-card hover:border-primary/30 focus-visible:border-ring focus-visible:ring-ring/50 relative flex items-center gap-4 rounded-xl border p-5 transition-all outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-[3px]">
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br to-transparent transition-transform duration-200 group-hover:scale-105",
          ACTION_TONE[tone]
        )}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block leading-tight font-semibold">{title}</span>
        <span className="text-muted-foreground block text-sm">{description}</span>
      </span>
      <ArrowRightIcon className="text-muted-foreground/60 group-hover:text-foreground size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}

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
        <Skeleton className="h-24 w-full" />
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
        <RecentProjectsList projects={data.recent_projects} />
      </div>

      {/* « Ce que je peux faire ensuite » : tuiles d'action vivantes (routes existantes). */}
      <section className="space-y-3">
        <h2 className="text-muted-foreground text-sm font-medium">{t("quickActions.title")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ActionTile
            href="/projects/new"
            icon={PlusIcon}
            tone="chart-2"
            title={t("quickActions.newProject")}
            description={t("quickActions.newProjectDesc")}
          />
          <ActionTile
            href="/datasets"
            icon={DatabaseIcon}
            tone="chart-1"
            title={t("quickActions.exploreDatasets")}
            description={t("quickActions.exploreDatasetsDesc")}
          />
          <ActionTile
            href="/datasets/score"
            icon={GaugeIcon}
            tone="chart-3"
            title={t("quickActions.scoreDataset")}
            description={t("quickActions.scoreDatasetDesc")}
          />
        </div>
      </section>
    </div>
  );
}
