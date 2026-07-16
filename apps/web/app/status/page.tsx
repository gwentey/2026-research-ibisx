"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { getHealth, getWorkerHealth, startSmokeJob } from "@/lib/api/generated";
import type { HealthReport, WorkerHealthReport } from "@/lib/api/generated";
import { LOCALE_COOKIE } from "@/i18n/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

type SmokeState = "idle" | "running" | "completed" | "failed";

interface SmokeEvent {
  status: string;
  progress: number;
  log_line?: string | null;
}

function StatusBadge({ ok, okLabel, koLabel }: { ok: boolean; okLabel: string; koLabel: string }) {
  return <Badge variant={ok ? "default" : "destructive"}>{ok ? okLabel : koLabel}</Badge>;
}

export default function StatusPage() {
  const t = useTranslations("status");
  const tCommon = useTranslations("common");
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [worker, setWorker] = useState<WorkerHealthReport | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [smokeState, setSmokeState] = useState<SmokeState>("idle");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const sourceRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async () => {
    const [healthResult, workerResult] = await Promise.all([getHealth(), getWorkerHealth()]);
    setHealth(healthResult.data ?? null);
    setWorker(workerResult.data ?? null);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
    return () => sourceRef.current?.close();
  }, [refresh]);

  const switchLocale = (locale: string) => {
    document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000;samesite=lax`;
    window.location.reload();
  };

  const startSmoke = async () => {
    setSmokeState("running");
    setProgress(0);
    setLogs([]);
    const { data } = await startSmokeJob();
    if (!data) {
      setSmokeState("failed");
      return;
    }
    const source = new EventSource(`/api/v1/jobs/${data.id}/events`);
    sourceRef.current = source;
    source.addEventListener("progress", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as SmokeEvent;
      setProgress(payload.progress);
      if (payload.log_line) {
        setLogs((previous) => [...previous, payload.log_line as string]);
      }
      if (payload.status === "completed") {
        setSmokeState("completed");
        source.close();
      } else if (payload.status === "failed" || payload.status === "cancelled") {
        setSmokeState("failed");
        source.close();
      }
    });
    source.onerror = () => {
      // Repli polling assuré côté produit ; ici on signale simplement l'échec du flux.
      if (smokeState === "running") setSmokeState("failed");
      source.close();
    };
  };

  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => switchLocale("fr")}>
              FR
            </Button>
            <Button variant="outline" size="sm" onClick={() => switchLocale("en")}>
              EN
            </Button>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                {t("apiHealth")}
                {loaded ? (
                  <StatusBadge
                    ok={health?.status === "ok"}
                    okLabel={t("ok")}
                    koLabel={t("degraded")}
                  />
                ) : (
                  <Badge variant="outline">{t("checking")}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!loaded ? (
                <Skeleton className="h-16 w-full" />
              ) : health ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("database")}</span>
                    <StatusBadge
                      ok={health.database === "ok"}
                      okLabel={t("ok")}
                      koLabel={t("unavailable")}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("redis")}</span>
                    <StatusBadge
                      ok={health.redis === "ok"}
                      okLabel={t("ok")}
                      koLabel={t("unavailable")}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("storage")}</span>
                    <StatusBadge
                      ok={health.storage === "ok"}
                      okLabel={t("ok")}
                      koLabel={t("unavailable")}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("version")}</span>
                    <span className="font-mono">{health.version}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{tCommon("error")}</span>
                  <Button variant="outline" size="sm" onClick={() => void refresh()}>
                    {tCommon("retry")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                {t("workerHealth")}
                {loaded ? (
                  <StatusBadge
                    ok={worker?.status === "ok"}
                    okLabel={t("ok")}
                    koLabel={t("unavailable")}
                  />
                ) : (
                  <Badge variant="outline">{t("checking")}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {!loaded ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="space-y-2">
                  <span className="text-muted-foreground">{t("workers")}</span>
                  <ul className="font-mono text-xs">
                    {(worker?.workers ?? []).map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                    {worker && worker.workers.length === 0 ? <li>—</li> : null}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("smokeTitle")}</CardTitle>
            <CardDescription>{t("smokeDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Button onClick={() => void startSmoke()} disabled={smokeState === "running"}>
                {smokeState === "running" ? t("smokeRunning") : t("smokeStart")}
              </Button>
              {smokeState === "completed" ? (
                <Badge>{t("smokeDone")}</Badge>
              ) : smokeState === "failed" ? (
                <Badge variant="destructive">{t("smokeFailed")}</Badge>
              ) : null}
            </div>
            {smokeState !== "idle" ? (
              <div className="space-y-3">
                <Progress value={progress} />
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                    {t("smokeLogs")}
                  </p>
                  <ul className="bg-muted rounded-md p-3 font-mono text-xs leading-relaxed">
                    {logs.map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
