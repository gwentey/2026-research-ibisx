"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  HistoryIcon,
  LayersIcon,
  Loader2Icon,
  SparklesIcon,
  TargetIcon
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
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

// ------------------------------------------------------------- Panneau « génération en cours »
// Effet IA : au lieu d'un simple fondu, on montre le résultat qui « se construit » — ligne de
// scan, barres squelette miroitantes, et étapes qui se cochent au fil de la progression.
const GEN_STEPS = ["read", "compute", "verify", "write"] as const;
const GEN_THRESHOLDS: Record<(typeof GEN_STEPS)[number], number> = {
  read: 8,
  compute: 40,
  verify: 72,
  write: 92
};

function GeneratingPanel({ progress }: { progress: number }) {
  const t = useTranslations("xai.generating");
  const shown = Math.max(4, Math.round(progress));
  // Premier index non terminé = étape « en cours ».
  const activeIndex = GEN_STEPS.findIndex((s) => shown < GEN_THRESHOLDS[s]);

  return (
    <div className="from-ai-violet/10 via-ai/5 to-ai-blue/10 border-ai/40 relative overflow-hidden rounded-xl border bg-gradient-to-br p-6">
      <span className="ai-scanline" aria-hidden />
      <div className="relative space-y-5">
        <div className="flex items-start gap-3">
          <span className="bg-ai/15 text-ai flex size-10 shrink-0 items-center justify-center rounded-lg">
            <SparklesIcon className="size-5 animate-pulse" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <p className="text-ai text-sm font-semibold">{t("title")}</p>
            <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Progress value={shown} className="h-2" />
          <span className="text-muted-foreground w-10 text-right font-mono text-xs">{shown}%</span>
        </div>

        <ul className="space-y-2">
          {GEN_STEPS.map((stepKey, index) => {
            const done = shown >= GEN_THRESHOLDS[stepKey];
            const active = index === activeIndex;
            return (
              <li
                key={stepKey}
                className={cn(
                  "flex items-center gap-2.5 text-sm transition-colors",
                  done ? "text-foreground" : active ? "text-ai" : "text-muted-foreground/50"
                )}>
                {done ? (
                  <CheckCircle2Icon className="text-ai size-4 shrink-0" />
                ) : active ? (
                  <Loader2Icon className="text-ai size-4 shrink-0 animate-spin" />
                ) : (
                  <span className="border-muted-foreground/30 size-4 shrink-0 rounded-full border" />
                )}
                {t(`steps.${stepKey}`)}
              </li>
            );
          })}
        </ul>

        {/* Squelette de graphe miroitant — donne une forme au résultat à venir. */}
        <div className="space-y-1.5 pt-1">
          {[0.9, 0.72, 0.58, 0.44, 0.3].map((w, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="ai-skeleton h-3 rounded" style={{ width: `${w * 100}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- État vide pédagogique
// Avant toute génération : on EXPLIQUE l'explicabilité et on guide vers le panneau de droite.
function ExplainIntro() {
  const t = useTranslations("xai.intro");
  const cards = [
    { key: "global", icon: LayersIcon },
    { key: "local", icon: TargetIcon }
  ] as const;
  return (
    <div className="rounded-xl border border-dashed p-6 sm:p-8">
      <div className="mx-auto max-w-lg space-y-6 text-center">
        <div className="space-y-2">
          <span className="bg-ai/12 text-ai mx-auto flex size-12 items-center justify-center rounded-full">
            <SparklesIcon className="size-6" />
          </span>
          <h3 className="text-lg font-semibold">{t("title")}</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">{t("body")}</p>
        </div>

        <div className="grid gap-3 text-left sm:grid-cols-2">
          {cards.map((card) => (
            <div key={card.key} className="bg-muted/30 space-y-1.5 rounded-lg border p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <card.icon className="text-ai size-4 shrink-0" />
                {t(`${card.key}Title`)}
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">{t(`${card.key}Body`)}</p>
            </div>
          ))}
        </div>

        <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-sm">
          <ArrowRightIcon className="text-ai size-4" />
          {t("cta")}
        </p>
      </div>
    </div>
  );
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
  // reveal : rejouer la révélation IA seulement après une génération fraîche.
  const [reveal, setReveal] = useState(false);
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
    return data ?? [];
  }, [experimentId]);

  const view = useCallback(async (explanationId: string, fresh: boolean) => {
    const { data } = await getExplanationResults({
      path: { explanation_id: explanationId },
      throwOnError: false
    });
    if (data) {
      setReveal(fresh);
      setCurrent(data);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const list = await loadHistory();
      // À l'arrivée : montre la dernière explication terminée, sans animation.
      const latest = list.find((e) => e.status === "completed");
      if (latest) await view(latest.id, false);
    })();
    return () => sourceRef.current?.close();
  }, [loadHistory, view]);

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
          await view(data.id, true); // génération fraîche → révélation IA
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

  const selectedInstance =
    instanceIndex !== null ? instances.find((i) => i.index === instanceIndex) ?? null : null;
  const canLaunch = !running && (type === "global" || instanceIndex !== null);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
        {/* Colonne principale — résultat, génération en cours, ou intro pédagogique. */}
        <div className="order-2 min-w-0 space-y-6 lg:order-none">
          {running ? (
            <GeneratingPanel progress={progress} />
          ) : current ? (
            // key = id de l'explication → remonte à chaque nouvelle explication (rejoue la
            // révélation) ; `reveal` décide si l'animation s'applique (fraîche vs historique).
            <ExplanationView key={current.id} explanation={current} reveal={reveal} />
          ) : (
            <ExplainIntro />
          )}
        </div>

        {/* Colonne latérale — contrôles puis chat, sticky en desktop. `order` : contrôles avant
            le résultat en mobile (on choisit d'abord ce qu'on veut expliquer). */}
        <aside className="order-1 space-y-4 lg:sticky lg:top-20 lg:order-none">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <SparklesIcon className="text-ai size-4" />
                {t("request.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* 1 — Vue d'ensemble ou exemple précis (langage clair, pas de jargon). */}
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs font-medium">{t("request.typeLabel")}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(["global", "local"] as const).map((candidate) => {
                    const active = type === candidate;
                    const Icon = candidate === "global" ? LayersIcon : TargetIcon;
                    return (
                      <button
                        key={candidate}
                        type="button"
                        onClick={() => setType(candidate)}
                        className={cn(
                          "rounded-lg border p-3 text-left transition-all",
                          active
                            ? "border-ai ring-ai/25 ring-2"
                            : "hover:border-ai/40"
                        )}>
                        <p className="flex items-center gap-1.5 text-sm font-medium">
                          <Icon className={cn("size-3.5", active ? "text-ai" : "text-muted-foreground")} />
                          {candidate === "global"
                            ? t("request.typeGlobal")
                            : t("request.typeLocal")}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs leading-snug">
                          {candidate === "global"
                            ? t("request.typeGlobalHint")
                            : t("request.typeLocalHint")}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2 — Méthode + explication en clair de l'option choisie. */}
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs font-medium">{t("request.method")}</p>
                <div className="flex flex-wrap gap-1.5">
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
                <p className="text-muted-foreground bg-muted/40 rounded-md border px-2.5 py-1.5 text-xs leading-relaxed">
                  {t(`request.methodHint.${method}`)}
                </p>
              </div>

              {/* 3 — Choix de l'exemple (local uniquement) : explique « exemple » et « écart »,
                     et surtout montre CLAIREMENT lequel est sélectionné. */}
              {type === "local" ? (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t("request.pickInstance")}
                  </p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {t("request.instanceIntro")}
                  </p>
                  <div className="max-h-56 overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">#</TableHead>
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
                              instanceIndex === instance.index && "bg-ai/10 hover:bg-ai/10"
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

                  {selectedInstance ? (
                    <div className="border-ai/40 bg-ai/5 space-y-1.5 rounded-md border p-2.5">
                      <p className="text-ai flex items-center gap-1.5 text-xs font-semibold">
                        <TargetIcon className="size-3.5" />
                        {t("request.selectedExample", { index: selectedInstance.index })}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="font-normal">
                          {t("request.instanceActual")} : {String(selectedInstance.actual)}
                        </Badge>
                        <Badge variant="outline" className="font-normal">
                          {t("request.instancePredicted")} : {String(selectedInstance.predicted)}
                        </Badge>
                        <Badge variant="outline" className="font-normal">
                          {t("request.instanceError")} : {selectedInstance.error}
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs italic">
                      {t("request.pickInstancePrompt")}
                    </p>
                  )}
                </div>
              ) : null}

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => void launch()}
                  disabled={!canLaunch}
                  className="bg-ai text-ai-foreground hover:bg-ai/90">
                  <SparklesIcon />
                  {running ? t("request.running") : t("request.launch")}
                </Button>
                <Badge variant="outline">{t("request.cost")}</Badge>
              </div>
              {errorMessage !== null ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    {t("request.failed", { message: errorMessage })}
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          {current ? <XaiChat explanation={current} /> : null}
        </aside>
      </div>

      {/* Historique — pleine largeur, HORS de la grille sticky : ne peut plus passer sous le
          chat (le contexte sticky de l'aside se termine avec la grille au-dessus). */}
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
                        "hover:border-primary/30 hover:bg-muted cursor-pointer",
                      current?.id === item.id && "border-ai/40 bg-ai/5"
                    )}
                    onClick={
                      item.status === "completed" ? () => void view(item.id, false) : undefined
                    }>
                    <ItemMedia variant="icon">
                      {item.type === "local" ? <TargetIcon /> : <LayersIcon />}
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>
                        <Badge variant="outline">
                          {item.type === "local" ? t("history.typeLocal") : t("history.typeGlobal")}
                        </Badge>
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
                        <Button size="sm" variant="ghost" onClick={() => void view(item.id, false)}>
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
  );
}
