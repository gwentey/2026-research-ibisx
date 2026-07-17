"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>

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
