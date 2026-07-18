"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2Icon, FlaskConicalIcon, GaugeIcon, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { listExperiments } from "@/lib/api/generated";
import type { ExperimentSummary } from "@/lib/api/generated";

/** Tuile stat sobre (bandeau /experiments) — calculée côté client, aucun appel réseau de plus. */
function StatTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-md">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          <p className="text-foreground text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  running: "secondary",
  pending: "outline",
  failed: "destructive",
  cancelled: "outline"
};
const STATUSES = ["pending", "running", "completed", "failed", "cancelled"];
const ALGORITHMS = ["decision_tree", "random_forest"];

export default function ExperimentsPage() {
  const t = useTranslations("experimentsPage");
  const tExp = useTranslations("experiments");
  const locale = useLocale();
  const [status, setStatus] = useState<string>("any");
  const [algorithm, setAlgorithm] = useState<string>("any");
  const [items, setItems] = useState<ExperimentSummary[] | null>(null);

  const load = useCallback(async () => {
    const { data } = await listExperiments({
      query: {
        status: status === "any" ? undefined : status,
        algorithm: algorithm === "any" ? undefined : algorithm
      },
      throwOnError: false
    });
    setItems(data ?? []);
  }, [status, algorithm]);

  useEffect(() => {
    void load();
    // Badges vivants (CDC §10) : repli polling 5 s
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  const completedCount = items?.filter((item) => item.status === "completed").length ?? 0;
  const scoreValues = (items ?? [])
    .filter((item) => item.status === "completed" && typeof item.primary_metric_value === "number")
    .map((item) => item.primary_metric_value as number);
  const avgScore =
    scoreValues.length > 0 ? scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>

      {items !== null ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile icon={FlaskConicalIcon} label={t("stats.total")} value={String(items.length)} />
          <StatTile
            icon={CheckCircle2Icon}
            label={t("stats.completed")}
            value={String(completedCount)}
          />
          <StatTile
            icon={GaugeIcon}
            label={t("stats.avgScore")}
            value={avgScore !== null ? avgScore.toFixed(2) : t("stats.noData")}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">
              {t("filterStatus")} : {t("any")}
            </SelectItem>
            {STATUSES.map((candidate) => (
              <SelectItem key={candidate} value={candidate}>
                {tExp(`status.${candidate}` as never)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={algorithm} onValueChange={setAlgorithm}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">
              {t("filterAlgo")} : {t("any")}
            </SelectItem>
            {ALGORITHMS.map((candidate) => (
              <SelectItem key={candidate} value={candidate}>
                {candidate}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {items === null ? (
        <Skeleton className="h-64 w-full" />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground text-sm">{t("empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tExp("table.dataset")}</TableHead>
                  <TableHead>{tExp("table.algorithm")}</TableHead>
                  <TableHead>{tExp("table.status")}</TableHead>
                  <TableHead className="text-right">{tExp("table.score")}</TableHead>
                  <TableHead className="text-right">{tExp("table.duration")}</TableHead>
                  <TableHead>{tExp("table.date")}</TableHead>
                  <TableHead className="text-right">{tExp("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((experiment) => (
                  <TableRow key={experiment.id}>
                    <TableCell className="font-medium">{experiment.dataset_name}</TableCell>
                    <TableCell className="font-mono text-xs">{experiment.algorithm}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[experiment.status] ?? "outline"}>
                        {tExp(`status.${experiment.status}` as never)}
                        {experiment.status === "running" ? ` ${experiment.progress}%` : ""}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {experiment.primary_metric_value !== null &&
                      experiment.primary_metric_value !== undefined
                        ? `${experiment.primary_metric_name} ${experiment.primary_metric_value}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {experiment.duration_seconds ? `${experiment.duration_seconds}s` : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(experiment.created_at).toLocaleString(locale)}
                    </TableCell>
                    <TableCell className="text-right">
                      {experiment.status === "completed" ? (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/experiments/${experiment.id}`}>
                            {tExp("table.view")}
                          </Link>
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
