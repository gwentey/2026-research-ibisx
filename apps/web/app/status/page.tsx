"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ActivityIcon, CpuIcon, LoaderCircleIcon, RadioIcon, ServerIcon } from "lucide-react";

import { getHealth, getWorkerHealth, startSmokeJob } from "@/lib/api/generated";
import type { HealthReport, WorkerHealthReport } from "@/lib/api/generated";
import { LOCALE_COOKIE } from "@/i18n/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { BackToAppLink } from "@/components/ibis/status/back-to-app-link";
import { ServiceCard, ServiceSubRow } from "@/components/ibis/status/service-card";
import { ServiceStatusDot, type ServiceHealthState } from "@/components/ibis/status/service-status-dot";
import { SmokeTimeline, type SmokeState } from "@/components/ibis/status/smoke-timeline";

interface SmokeEvent {
  status: string;
  progress: number;
  log_line?: string | null;
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

  // ------------------------------- Carte API : ratio de sous-vérifications réelles ---
  const apiState: ServiceHealthState = !loaded ? "checking" : health ? (health.status === "ok" ? "ok" : "down") : "down";
  const apiLabel = !loaded
    ? t("checking")
    : health
      ? health.status === "ok"
        ? t("ok")
        : t("degraded")
      : tCommon("error");
  const apiRatio = health
    ? ([health.database, health.redis, health.storage].filter((entry) => entry === "ok").length / 3) * 100
    : 0;

  // ------------------------------- Carte Worker ---------------------------------------
  const workerState: ServiceHealthState = !loaded ? "checking" : worker ? (worker.status === "ok" ? "ok" : "down") : "down";
  const workerLabel = !loaded
    ? t("checking")
    : worker
      ? worker.status === "ok"
        ? t("ok")
        : t("unavailable")
      : tCommon("error");
  const workerRatio = worker ? (worker.status === "ok" ? 100 : 0) : 0;

  return (
    <main className="bg-background min-h-screen">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-12">
        <BackToAppLink />

        <header className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
              <ActivityIcon className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
              <p className="text-muted-foreground mt-0.5 text-sm">{t("subtitle")}</p>
            </div>
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

        <section className="space-y-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {t("overviewEyebrow")}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <ServiceCard
              icon={ServerIcon}
              title={t("apiHealth")}
              state={apiState}
              label={apiLabel}
              checkingLabel={t("checking")}
              loaded={loaded}
              ratio={apiRatio}>
              {health ? (
                <>
                  <ServiceSubRow
                    label={t("database")}
                    state={health.database === "ok" ? "ok" : "down"}
                    okLabel={t("ok")}
                    koLabel={t("unavailable")}
                  />
                  <ServiceSubRow
                    label={t("redis")}
                    state={health.redis === "ok" ? "ok" : "down"}
                    okLabel={t("ok")}
                    koLabel={t("unavailable")}
                  />
                  <ServiceSubRow
                    label={t("storage")}
                    state={health.storage === "ok" ? "ok" : "down"}
                    okLabel={t("ok")}
                    koLabel={t("unavailable")}
                  />
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-muted-foreground">{t("version")}</span>
                    <span className="font-mono text-xs">{health.version}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{tCommon("error")}</span>
                  <Button variant="outline" size="sm" onClick={() => void refresh()}>
                    {tCommon("retry")}
                  </Button>
                </div>
              )}
            </ServiceCard>

            <ServiceCard
              icon={CpuIcon}
              title={t("workerHealth")}
              state={workerState}
              label={workerLabel}
              checkingLabel={t("checking")}
              loaded={loaded}
              ratio={workerRatio}>
              <p className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">
                {t("workers")}
              </p>
              {worker && worker.workers.length > 0 ? (
                <div className="space-y-1.5">
                  {worker.workers.map((name) => (
                    <div key={name} className="flex items-center gap-2 font-mono text-xs">
                      <ServiceStatusDot state="ok" />
                      {name}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">—</p>
              )}
            </ServiceCard>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {t("liveEyebrow")}
          </p>
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

              {smokeState === "idle" ? (
                <Empty className="border-dashed py-8">
                  <EmptyMedia variant="icon">
                    <RadioIcon />
                  </EmptyMedia>
                  <EmptyTitle>{t("smokeIdleTitle")}</EmptyTitle>
                  <EmptyDescription>{t("smokeIdleDescription")}</EmptyDescription>
                </Empty>
              ) : (
                <div className="space-y-3">
                  <Progress value={progress} />
                  <div>
                    <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                      {t("smokeLogs")}
                    </p>
                    {logs.length > 0 ? (
                      <SmokeTimeline state={smokeState} logs={logs} />
                    ) : (
                      <p className="text-muted-foreground flex items-center gap-2 text-xs">
                        <LoaderCircleIcon className="size-3.5 animate-spin" />
                        {t("smokeRunning")}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
