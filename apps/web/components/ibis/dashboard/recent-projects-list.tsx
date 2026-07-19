"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRightIcon, ClockIcon, FolderIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

// Liste des projets récents (P6/lot 3, doc 04-dashboard.md). Refonte (lot correctifs) :
// lignes VIVANTES — monogramme tonal (2 lettres, pastille chart-N stable par hash de
// l'id), date relative, CTA « Ouvrir » soigné (flèche animée), élévation au survol.
// Teintes chart-* purement tonales (monochrome) — jamais une couleur inventée.

// Fragments littéraux (Tailwind JIT). Cycle des 5 nuances neutres pour les monogrammes.
const MONO_TONES = [
  "bg-chart-1/15 text-chart-1",
  "bg-chart-2/15 text-chart-2",
  "bg-chart-3/15 text-chart-3",
  "bg-chart-4/15 text-chart-4",
  "bg-chart-5/20 text-foreground"
];

/** Hash déterministe simple → nuance stable pour un id donné (indépendant de l'ordre). */
function toneIndex(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % MONO_TONES.length;
}

/** Monogramme 2 lettres : initiales des 2 premiers mots, repli sur les 2 premières lettres. */
function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || "PR";
}

/** Date relative concise (Intl natif, sur updated_at réel) ; repli date absolue au-delà d'un mois. */
function relativeDate(iso: string, locale: string): string {
  const then = new Date(iso).getTime();
  const diff = then - Date.now();
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), "day");
  return new Date(iso).toLocaleDateString(locale);
}

export function RecentProjectsList({ projects }: { projects: RecentProject[] }) {
  const t = useTranslations("dashboardHome");
  const locale = useLocale();

  return (
    // pb-0 + overflow-hidden : footer flush au bas de la carte (même traitement que l'activité).
    <Card className="overflow-hidden pb-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderIcon className="size-4" />
          {t("recentProjects.title")}
        </CardTitle>
        <CardDescription>{t("recentProjects.subtitle")}</CardDescription>
      </CardHeader>
      {/* flex-1 : pousse le CardFooter tout en bas quand la grille étire la carte (plus de « Voir tout » au milieu). */}
      <CardContent className="flex-1">
        {projects.length === 0 ? (
          <Empty className="border-none p-0 py-6">
            <EmptyMedia variant="icon">
              <FolderIcon />
            </EmptyMedia>
            <EmptyTitle>{t("recentProjects.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("recentProjects.empty")}</EmptyDescription>
          </Empty>
        ) : (
          <ItemGroup className="gap-1.5">
            {projects.map((project) => (
              <Item
                key={project.id}
                size="sm"
                variant="outline"
                className="hover:border-primary/30 hover:bg-accent/40 transition-all hover:shadow-sm">
                <ItemMedia
                  variant="icon"
                  className={cn(
                    "size-9 rounded-lg border-0 text-xs font-semibold",
                    MONO_TONES[toneIndex(project.id)]
                  )}>
                  {monogram(project.name)}
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="truncate">{project.name}</ItemTitle>
                  <ItemDescription className="flex items-center gap-1.5">
                    <ClockIcon className="size-3" />
                    {relativeDate(project.updated_at, locale)}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="group text-muted-foreground hover:text-foreground gap-1"
                    asChild>
                    <Link href={`/projects/${project.id}`}>
                      {t("recentProjects.open")}
                      <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </CardContent>
      <CardFooter className="border-t p-0!">
        <Button
          variant="ghost"
          className="group text-muted-foreground hover:text-foreground w-full justify-center gap-1.5 rounded-none rounded-b-xl"
          asChild>
          <Link href="/projects">
            {t("recentProjects.viewAll")}
            <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
