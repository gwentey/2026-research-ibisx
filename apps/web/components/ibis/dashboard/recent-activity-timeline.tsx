"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  ActivityIcon,
  ArrowRightIcon,
  ClockIcon,
  FlaskConicalIcon,
  LightbulbIcon
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import type { ActivityItem } from "@/lib/api/generated";
import { cn } from "@/lib/utils";

// Activité récente (P6/lot 3, doc 04-dashboard.md). Refonte (lot correctifs) : lignes
// ALIGNÉES en colonnes cohérentes (ItemGroup/Item, comme les projets récents) plutôt qu'une
// frise à deux niveaux — [pastille de statut + tuile-icône par nature] | [libellé + badge ;
// sous-titre nature · temps] | [« Voir » à droite]. La pastille reste SÉMANTIQUE (statut RÉEL
// de l'expérience, seul cas où vert/ambre/rouge sont autorisés), avec halo pulse pour
// « running ». Le badge textuel reste monochrome (STATUS_VARIANT).

// Badge textuel : nuances neutres (default/secondary/outline) + destructive pour l'échec.
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  running: "secondary",
  pending: "outline",
  failed: "destructive",
  cancelled: "outline"
};

// Pastille de statut : même convention que service-status-dot (bg-green/destructive/muted).
// Le halo `pulse-dot` (keyframe globals.css) ne bat que pour « running » — signal vivant
// d'un travail en cours ; un échec reste un point fixe (on ne banalise pas une panne).
const STATUS_DOT: Record<string, { dot: string; pulse: boolean }> = {
  completed: { dot: "bg-green-500 dark:bg-green-400", pulse: false },
  running: { dot: "bg-amber-500 dark:bg-amber-400", pulse: true },
  pending: { dot: "bg-muted-foreground/40", pulse: false },
  failed: { dot: "bg-destructive", pulse: false },
  cancelled: { dot: "bg-muted-foreground/40", pulse: false }
};

// Tuile-icône tonale par nature : entraînement (primary, langage wizard) / explication (chart-3, XAI).
const KIND_TILE: Record<string, string> = {
  experiment: "bg-primary/10 text-primary",
  explanation: "bg-chart-3/15 text-chart-3"
};

/** Temps relatif concis (Intl natif, sur created_at réel) ; repli date absolue au-delà d'un mois. */
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

export function RecentActivityTimeline({ items }: { items: ActivityItem[] }) {
  const t = useTranslations("dashboardHome");
  const tExp = useTranslations("experiments");
  const locale = useLocale();

  return (
    <Card className="overflow-hidden pb-0 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ActivityIcon className="size-4" />
          {t("activity.title")}
        </CardTitle>
        <CardDescription>{t("activity.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {items.length === 0 ? (
          <Empty className="border-none p-0 py-6">
            <EmptyMedia variant="icon">
              <ActivityIcon />
            </EmptyMedia>
            <EmptyTitle>{t("activity.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("activity.empty")}</EmptyDescription>
          </Empty>
        ) : (
          <ItemGroup className="gap-1.5">
            {items.map((item) => {
              const status = STATUS_DOT[item.status] ?? STATUS_DOT.pending;
              const KindIcon = item.kind === "experiment" ? FlaskConicalIcon : LightbulbIcon;
              return (
                <Item
                  key={`${item.kind}-${item.ref_id}`}
                  size="sm"
                  variant="outline"
                  className="hover:border-primary/30 hover:bg-accent/40 transition-all hover:shadow-sm">
                  {/* Colonne 1 : pastille de statut sémantique (halo pulse pour « running ») + tuile-icône par nature. */}
                  <ItemMedia variant="default" className="gap-2.5">
                    <span className="relative inline-flex size-2.5 shrink-0">
                      {status.pulse ? (
                        <span
                          className={cn(
                            "absolute inline-flex size-full animate-[pulse-dot_2s_ease-in-out_infinite] rounded-full opacity-70",
                            status.dot
                          )}
                        />
                      ) : null}
                      <span
                        className={cn("relative inline-flex size-2.5 rounded-full", status.dot)}
                      />
                    </span>
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        KIND_TILE[item.kind] ?? KIND_TILE.experiment
                      )}>
                      <KindIcon className="size-4" />
                    </span>
                  </ItemMedia>
                  {/* Colonne 2 : libellé (truncate) + badge statut ; sous-titre discret nature · temps relatif. */}
                  <ItemContent className="min-w-0">
                    <ItemTitle className="min-w-0">
                      <span className="min-w-0 truncate">{item.label}</span>
                      <Badge className="shrink-0" variant={STATUS_VARIANT[item.status] ?? "outline"}>
                        {tExp.has(`status.${item.status}`)
                          ? tExp(`status.${item.status}`)
                          : item.status}
                      </Badge>
                    </ItemTitle>
                    <ItemDescription className="flex items-center gap-1.5">
                      <span className="truncate">
                        {item.kind === "experiment"
                          ? t("activity.experiment")
                          : t("activity.explanation")}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className="inline-flex shrink-0 items-center gap-1"
                        title={new Date(item.created_at).toLocaleString(locale)}>
                        <ClockIcon className="size-3" />
                        {relativeDate(item.created_at, locale)}
                      </span>
                    </ItemDescription>
                  </ItemContent>
                  {/* Colonne 3 : « Voir » aligné à droite. */}
                  <ItemActions>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="group text-muted-foreground hover:text-foreground gap-1"
                      asChild>
                      <Link href={`/experiments/${item.experiment_id}`}>
                        {t("activity.view")}
                        <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </Button>
                  </ItemActions>
                </Item>
              );
            })}
          </ItemGroup>
        )}
      </CardContent>
      <CardFooter className="border-t p-0!">
        <Button
          variant="ghost"
          className="group text-muted-foreground hover:text-foreground w-full justify-center gap-1.5 rounded-none rounded-b-xl"
          asChild>
          <Link href="/experiments">
            {t("activity.viewAll")}
            <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
