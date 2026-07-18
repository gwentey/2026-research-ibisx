"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ActivityIcon, ClockIcon, FlaskConicalIcon, LightbulbIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineTitle,
  TimelineSeparator
} from "@/components/ui/timeline";
import type { ActivityItem } from "@/lib/api/generated";

// Timeline d'activité récente (P6/lot 3, doc 04-dashboard.md) : reprend quasi tel quel
// le pattern user-profile/activity-stream.tsx (Card > Timeline > TimelineItem > header/
// content/date + CardFooter "voir plus"), en remplaçant fichiers/images par le badge de
// statut monochrome déjà en place côté v2 (STATUS_VARIANT, jamais de variante colorée).
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  running: "secondary",
  pending: "outline",
  failed: "destructive",
  cancelled: "outline"
};

export function RecentActivityTimeline({ items }: { items: ActivityItem[] }) {
  const t = useTranslations("dashboardHome");
  const tExp = useTranslations("experiments");
  const locale = useLocale();

  return (
    <Card className="lg:col-span-2 overflow-hidden pb-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ActivityIcon className="size-4" />
          {t("activity.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <Empty className="border-none p-0 py-6">
            <EmptyMedia variant="icon">
              <ActivityIcon />
            </EmptyMedia>
            <EmptyTitle>{t("activity.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("activity.empty")}</EmptyDescription>
          </Empty>
        ) : (
          <Timeline defaultValue={items.length}>
            {items.map((item, index) => (
              <TimelineItem key={`${item.kind}-${item.ref_id}`} step={index + 1} className="pb-8">
                <TimelineHeader>
                  <TimelineSeparator />
                  <TimelineTitle className="-mt-0.5 flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 truncate">{item.label}</span>
                    <Badge variant={STATUS_VARIANT[item.status] ?? "outline"}>
                      {tExp.has(`status.${item.status}`) ? tExp(`status.${item.status}`) : item.status}
                    </Badge>
                  </TimelineTitle>
                  <TimelineIndicator
                    className={item.kind === "explanation" ? "border-chart-3/40" : "border-primary/30"}
                  />
                </TimelineHeader>
                <TimelineContent className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                    {item.kind === "experiment" ? (
                      <FlaskConicalIcon className="size-3.5" />
                    ) : (
                      <LightbulbIcon className="size-3.5" />
                    )}
                    {item.kind === "experiment" ? t("activity.experiment") : t("activity.explanation")}
                  </span>
                  <div className="flex items-center gap-3">
                    <TimelineDate className="mb-0 flex items-center gap-1.5">
                      <ClockIcon className="size-3" />
                      {new Date(item.created_at).toLocaleString(locale)}
                    </TimelineDate>
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/experiments/${item.experiment_id}`}>{t("activity.view")}</Link>
                    </Button>
                  </div>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </CardContent>
      <CardFooter className="border-t p-0!">
        <Button variant="link" className="w-full rounded-none" asChild>
          <Link href="/experiments">{t("activity.viewAll")}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
