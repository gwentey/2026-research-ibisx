"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { HistoryIcon, LayersIcon, SparklesIcon, TargetIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle
} from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { ExplanationView } from "@/components/ibis/xai/explanation-view";
import { XaiChat } from "@/components/ibis/xai/xai-chat";
import {
  getExplanationResults,
  listExplanations,
  listTestInstances,
  requestExplanation
} from "@/lib/api/generated";
import type { ExplanationRead, ExplanationResults } from "@/lib/api/generated";
import { getMe } from "@/lib/api/generated";
import { useAuthStore } from "@/lib/auth/store";
import { cn } from "@/lib/utils";

interface TestInstance {
  index: number;
  actual: string | number;
  predicted: string | number;
  error: number;
}

export function XaiTab({ experimentId }: { experimentId: string }) {
  const t = useTranslations("xai");
  const locale = useLocale();
  const [type, setType] = useState<"global" | "local">("global");
  const [method, setMethod] = useState<"auto" | "shap" | "lime">("auto");
  const [instances, setInstances] = useState<TestInstance[]>([]);
  const [instanceIndex, setInstanceIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<ExplanationRead[]>([]);
  const [current, setCurrent] = useState<ExplanationResults | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  const loadHistory = useCallback(async () => {
    const { data } = await listExplanations({
      path: { experiment_id: experimentId },
      throwOnError: false
    });
    setHistory(data ?? []);
    // Affiche automatiquement la plus récente terminée
    const latest = (data ?? []).find((e) => e.status === "completed");
    if (latest) {
      const { data: results } = await getExplanationResults({
        path: { explanation_id: latest.id },
        throwOnError: false
      });
      if (results) setCurrent(results);
    }
  }, [experimentId]);

  useEffect(() => {
    void loadHistory();
    return () => sourceRef.current?.close();
  }, [loadHistory]);

  useEffect(() => {
    if (type !== "local" || instances.length > 0) return;
    listTestInstances({
      path: { experiment_id: experimentId },
      query: { page: 1, page_size: 10 },
      throwOnError: false
    }).then(({ data }) => {
      const items = (data as { items?: TestInstance[] } | undefined)?.items ?? [];
      setInstances(items);
    });
  }, [type, instances.length, experimentId]);

  const view = async (explanationId: string) => {
    const { data } = await getExplanationResults({
      path: { explanation_id: explanationId },
      throwOnError: false
    });
    if (data) setCurrent(data);
  };

  const launch = async () => {
    setRunning(true);
    setErrorMessage(null);
    setProgress(0);
    const { data, error } = await requestExplanation({
      path: { experiment_id: experimentId },
      body: {
        type,
        method,
        instance_index: type === "local" ? (instanceIndex ?? 0) : null,
        language: locale as "fr" | "en"
      },
      throwOnError: false
    });
    if (!data) {
      const detail = (error as { detail?: { message?: string } } | undefined)?.detail;
      setErrorMessage(detail?.message ?? "");
      setRunning(false);
      return;
    }
    // Crédit débité → rafraîchit le solde affiché
    void getMe({ throwOnError: false }).then(({ data: me }) => {
      if (me) useAuthStore.getState().setUser(me);
    });
    if (data.job_id) {
      const source = new EventSource(`/api/v1/jobs/${data.job_id}/events`);
      sourceRef.current = source;
      source.addEventListener("progress", async (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          status: string;
          progress: number;
        };
        setProgress(payload.progress);
        if (payload.status === "completed") {
          source.close();
          setRunning(false);
          await view(data.id);
          await loadHistory();
        } else if (payload.status === "failed" || payload.status === "cancelled") {
          source.close();
          setRunning(false);
          setErrorMessage(payload.status);
        }
      });
      source.onerror = () => source.close();
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      {/* Colonne principale — le contenu de l'explication (résultat, fiabilité, graphes, texte). */}
      <div className="order-2 min-w-0 space-y-6 lg:order-none">
        {current ? (
          <ExplanationView explanation={current} />
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex min-h-[20rem] items-center justify-center py-10">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <SparklesIcon className="text-ai" />
                  </EmptyMedia>
                  <EmptyTitle>{t("request.title")}</EmptyTitle>
                  <EmptyDescription>{t("history.empty")}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Colonne latérale — contrôles puis chat, toujours à portée (sticky en desktop).
          `contents` en mobile pour réordonner : contrôles → résultat → chat → historique. */}
      <aside className="contents lg:sticky lg:top-20 lg:block lg:space-y-4">
        <Card className="order-1 lg:order-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SparklesIcon className="text-ai size-4" />
              {t("request.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {(["global", "local"] as const).map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => setType(candidate)}
                  className={cn(
                    "rounded-md border p-3 text-left text-sm",
                    type === candidate ? "border-primary bg-muted" : "hover:bg-muted"
                  )}>
                  <p className="font-medium">
                    {candidate === "global" ? t("request.typeGlobal") : t("request.typeLocal")}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {candidate === "global"
                      ? t("request.typeGlobalHint")
                      : t("request.typeLocalHint")}
                  </p>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm">{t("request.method")} :</span>
              {(["auto", "shap", "lime"] as const).map((candidate) => (
                <Button
                  key={candidate}
                  size="sm"
                  variant={method === candidate ? "secondary" : "outline"}
                  onClick={() => setMethod(candidate)}>
                  {candidate === "auto"
                    ? t("request.methodAuto")
                    : candidate === "shap"
                      ? t("request.methodShap")
                      : t("request.methodLime")}
                </Button>
              ))}
            </div>

            {type === "local" ? (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">{t("request.pickInstance")}</p>
                <div className="max-h-56 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>{t("request.instanceActual")}</TableHead>
                        <TableHead>{t("request.instancePredicted")}</TableHead>
                        <TableHead className="text-right">{t("request.instanceError")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {instances.map((instance) => (
                        <TableRow
                          key={instance.index}
                          className={cn(
                            "cursor-pointer",
                            instanceIndex === instance.index && "bg-muted"
                          )}
                          onClick={() => setInstanceIndex(instance.index)}>
                          <TableCell className="font-mono text-xs">{instance.index}</TableCell>
                          <TableCell>{String(instance.actual)}</TableCell>
                          <TableCell>{String(instance.predicted)}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {instance.error}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <Button
                onClick={() => void launch()}
                disabled={running || (type === "local" && instanceIndex === null)}
                className="bg-ai text-ai-foreground hover:bg-ai/90">
                <SparklesIcon />
                {running ? t("request.running") : t("request.launch")}
              </Button>
              <Badge variant="outline">{t("request.cost")}</Badge>
            </div>
            {running ? <Progress value={progress} /> : null}
            {errorMessage !== null ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {t("request.failed", { message: errorMessage })}
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        {current ? (
          <div className="order-3 lg:order-none">
            <XaiChat explanation={current} />
          </div>
        ) : null}
      </aside>

      {/* Historique — pleine largeur en pied de workspace. */}
      <div className="order-4 min-w-0 lg:order-none lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HistoryIcon className="text-muted-foreground size-4" />
              {t("history.title")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HistoryIcon />
                  </EmptyMedia>
                  <EmptyTitle>{t("history.empty")}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <ItemGroup>
                {history.map((item, index) => (
                  <Fragment key={item.id}>
                    {index > 0 ? <ItemSeparator /> : null}
                    <Item
                      size="sm"
                      className={cn(
                        item.status === "completed" &&
                          "hover:border-primary/30 hover:bg-muted cursor-pointer"
                      )}
                      onClick={item.status === "completed" ? () => void view(item.id) : undefined}>
                      <ItemMedia variant="icon">
                        {item.type === "local" ? <TargetIcon /> : <LayersIcon />}
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>
                          <Badge variant="outline">{item.type}</Badge>
                          <span className="font-mono text-xs">
                            {item.method_used ?? item.status}
                          </span>
                          {item.is_fallback ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {t("history.fallback")}
                            </Badge>
                          ) : null}
                        </ItemTitle>
                        <ItemDescription>
                          {new Date(item.created_at).toLocaleString(locale)}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        {item.status === "completed" ? (
                          <Button size="sm" variant="ghost" onClick={() => void view(item.id)}>
                            {t("history.view")}
                          </Button>
                        ) : (
                          <Badge variant="outline">{item.status}</Badge>
                        )}
                      </ItemActions>
                    </Item>
                  </Fragment>
                ))}
              </ItemGroup>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
