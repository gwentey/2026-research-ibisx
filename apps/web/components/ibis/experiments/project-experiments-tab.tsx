"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { FlaskConicalIcon, Trash2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from "recharts";
import {
  compareExperiments,
  deleteExperiment,
  listProjectExperiments
} from "@/lib/api/generated";
import type { CompareResponse, ExperimentSummary } from "@/lib/api/generated";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  running: "secondary",
  pending: "outline",
  failed: "destructive",
  cancelled: "outline",
  draft: "outline"
};

const SERIES_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function ProjectExperimentsTab({ projectId }: { projectId: string }) {
  const t = useTranslations("experiments");
  const td = useTranslations("projects.detail");
  const locale = useLocale();
  const [experiments, setExperiments] = useState<ExperimentSummary[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState<CompareResponse | null>(null);

  const load = useCallback(async () => {
    const { data } = await listProjectExperiments({
      path: { project_id: projectId },
      throwOnError: false
    });
    setExperiments(data ?? []);
  }, [projectId]);

  useEffect(() => {
    void load();
    // Badges vivants : les running se mettent à jour (repli polling 5 s)
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  const toggle = (id: string, completed: boolean) => {
    if (!completed) return;
    setSelected((current) =>
      current.includes(id)
        ? current.filter((v) => v !== id)
        : current.length < 8
          ? [...current, id]
          : current
    );
  };

  const compare = async () => {
    const { data } = await compareExperiments({
      body: { experiment_ids: selected },
      throwOnError: false
    });
    setComparison(data ?? null);
  };

  const remove = async (id: string) => {
    await deleteExperiment({ path: { experiment_id: id }, throwOnError: false });
    setSelected((current) => current.filter((v) => v !== id));
    void load();
  };

  if (experiments.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-2 py-10 text-center">
          <FlaskConicalIcon className="text-muted-foreground mx-auto size-8" />
          <p className="font-medium">{td("experimentsEmptyTitle")}</p>
          <p className="text-muted-foreground mx-auto max-w-md text-sm">
            {td("experimentsEmptyBody")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = comparison
    ? comparison.metric_keys.map((key) => ({
        metric: t.has(`metrics.${key}` as never) ? t(`metrics.${key}` as never) : key,
        ...Object.fromEntries(
          comparison.rows.map((row) => [
            `${row.algorithm} · ${row.dataset_name}`,
            row.metrics[key] ?? 0
          ])
        )
      }))
    : [];
  const seriesNames = comparison
    ? comparison.rows.map((row) => `${row.algorithm} · ${row.dataset_name}`)
    : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">{t("table.selectHint")}</p>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              size="sm"
              disabled={selected.length < 2}
              onClick={() => void compare()}>
              {t("table.compare", { count: selected.length })}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{t("compareTitle")}</DialogTitle>
            </DialogHeader>
            {comparison ? (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("table.dataset")}</TableHead>
                        <TableHead>{t("table.algorithm")}</TableHead>
                        {comparison.metric_keys.map((key) => (
                          <TableHead key={key} className="text-right">
                            {t.has(`metrics.${key}` as never)
                              ? t(`metrics.${key}` as never)
                              : key}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparison.rows.map((row) => (
                        <TableRow key={row.experiment_id}>
                          <TableCell>{row.dataset_name}</TableCell>
                          <TableCell>{row.algorithm}</TableCell>
                          {comparison.metric_keys.map((key) => (
                            <TableCell key={key} className="text-right font-mono text-xs">
                              {String(row.metrics[key] ?? "—")}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ChartContainer config={{}} className="h-64 w-full">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="metric" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    {seriesNames.map((name, index) => (
                      <Bar
                        key={name}
                        dataKey={name}
                        fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                        radius={2}
                      />
                    ))}
                  </BarChart>
                </ChartContainer>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{t("compareEmpty")}</p>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card className="py-0">
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>{t("table.dataset")}</TableHead>
                <TableHead>{t("table.algorithm")}</TableHead>
                <TableHead>{t("table.status")}</TableHead>
                <TableHead className="text-right">{t("table.score")}</TableHead>
                <TableHead className="text-right">{t("table.duration")}</TableHead>
                <TableHead>{t("table.date")}</TableHead>
                <TableHead className="text-right">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {experiments.map((experiment) => (
                <TableRow key={experiment.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(experiment.id)}
                      disabled={experiment.status !== "completed"}
                      onCheckedChange={() =>
                        toggle(experiment.id, experiment.status === "completed")
                      }
                    />
                  </TableCell>
                  <TableCell className="font-medium">{experiment.dataset_name}</TableCell>
                  <TableCell className="font-mono text-xs">{experiment.algorithm}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[experiment.status] ?? "outline"}>
                      {t(`status.${experiment.status}` as never)}
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
                    <div className="flex justify-end gap-1">
                      {experiment.status === "completed" ? (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/experiments/${experiment.id}`}>{t("table.view")}</Link>
                        </Button>
                      ) : null}
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={t("table.delete")}
                        onClick={() => void remove(experiment.id)}>
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
