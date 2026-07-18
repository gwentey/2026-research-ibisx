"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ListChecksIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AdminEmptyState } from "@/components/ibis/admin/admin-empty-state";
import { AdminPageHeader } from "@/components/ibis/admin/admin-page-header";
import {
  adminListJobs,
  getWorkerHealth,
  type JobRow,
  type WorkerHealthReport
} from "@/lib/api/generated";

const KINDS = ["training", "explanation", "chat", "import", "guide", "maintenance"];
const STATUSES = ["pending", "running", "completed", "failed", "cancelled"];
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  running: "secondary",
  pending: "outline",
  failed: "destructive",
  cancelled: "outline"
};

function durationOf(job: JobRow): string {
  if (!job.finished_at) return "—";
  const seconds = (new Date(job.finished_at).getTime() - new Date(job.created_at).getTime()) / 1000;
  return seconds >= 0 ? `${Math.round(seconds)}s` : "—";
}

export default function AdminJobsPage() {
  const t = useTranslations("admin.jobs");
  const locale = useLocale();
  const [kind, setKind] = useState("any");
  const [status, setStatus] = useState("any");
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [worker, setWorker] = useState<WorkerHealthReport | null>(null);

  const load = useCallback(async () => {
    const [jobsResult, workerResult] = await Promise.all([
      adminListJobs({
        query: {
          kind: kind === "any" ? undefined : kind,
          status: status === "any" ? undefined : status
        },
        throwOnError: false
      }),
      getWorkerHealth({ throwOnError: false })
    ]);
    if (jobsResult.data) setJobs(jobsResult.data);
    if (workerResult.data) setWorker(workerResult.data);
  }, [kind, status]);

  useEffect(() => {
    void load();
    // Supervision vivante : repli polling 5 s (CDC §10)
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={ListChecksIcon} title={t("title")} count={jobs?.length} subtitle={t("subtitle")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("workers")}</CardTitle>
        </CardHeader>
        <CardContent>
          {worker === null ? (
            <Skeleton className="h-6 w-48" />
          ) : worker.workers.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noWorkers")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {worker.workers.map((name) => (
                <Badge key={name} variant="secondary" className="font-mono text-xs">
                  {name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">{t("filters.kind")}</span>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("filters.any")}</SelectItem>
              {KINDS.map((candidate) => (
                <SelectItem key={candidate} value={candidate}>
                  {t(`kinds.${candidate}` as never)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium">{t("filters.status")}</span>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("filters.any")}</SelectItem>
              {STATUSES.map((candidate) => (
                <SelectItem key={candidate} value={candidate}>
                  {t(`statuses.${candidate}` as never)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {jobs === null ? (
        <Skeleton className="h-64 w-full" />
      ) : jobs.length === 0 ? (
        <AdminEmptyState icon={ListChecksIcon} title={t("empty")} />
      ) : (
        <Card className="py-0">
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.kind")}</TableHead>
                  <TableHead>{t("table.status")}</TableHead>
                  <TableHead>{t("table.queue")}</TableHead>
                  <TableHead className="text-right">{t("table.progress")}</TableHead>
                  <TableHead>{t("table.error")}</TableHead>
                  <TableHead>{t("table.created")}</TableHead>
                  <TableHead className="text-right">{t("table.duration")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">
                      {t(`kinds.${job.kind}` as never)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[job.status] ?? "outline"}>
                        {t(`statuses.${job.status}` as never)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{job.queue}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {job.progress}%
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {job.error_code ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(job.created_at).toLocaleString(locale)}
                    </TableCell>
                    <TableCell className="text-right text-xs">{durationOf(job)}</TableCell>
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
