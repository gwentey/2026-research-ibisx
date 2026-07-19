"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BrainCircuitIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  CoinsIcon,
  DatabaseIcon,
  EraserIcon,
  LightbulbIcon,
  Loader2Icon,
  RocketIcon,
  Settings2Icon,
  SlidersHorizontalIcon,
  SparklesIcon,
  SplitIcon,
  TargetIcon,
  TerminalIcon,
  TreesIcon,
  XCircleIcon
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { AiAssist } from "@/components/ibis/ai-assist";
import { getExperiment, getMe, startExperiment } from "@/lib/api/generated";
import type { DatasetDetail } from "@/lib/api/generated";
import type { QualityData } from "@/app/wizard/page";
import { toExperimentCreate, useWizardStore } from "@/lib/wizard/store";
import { useAuthStore } from "@/lib/auth/store";
import { cn } from "@/lib/utils";

interface AlgorithmCard {
  key: string;
  badge: string;
  defaults: Record<string, unknown>;
  presets: Record<string, Record<string, unknown>>;
  schema: {
    properties: Record<
      string,
      { type?: string; minimum?: number; maximum?: number; enum?: string[]; default?: unknown }
    >;
  };
}

// ---------------------------------------------------------------- Étape 6
export function Step6Algorithm({
  algorithms,
  quality
}: {
  algorithms: Record<string, unknown>[];
  quality: QualityData | null;
}) {
  const t = useTranslations("wizard.step6");
  const tw = useTranslations("wizard");
  const store = useWizardStore();
  const cards = algorithms as unknown as AlgorithmCard[];
  const rows = quality?.analysis.row_count ?? 0;
  const cols = quality?.analysis.column_count ?? 0;
  // Recommandation DÉTERMINISTE bornée au registre ([NE PAS REPRODUIRE] T8)
  const recommended = rows < 1000 && cols < 15 ? "decision_tree" : "random_forest";

  const choose = (key: string, defaults: Record<string, unknown>) => {
    store.set("algorithm", key);
    store.set("preset", "balanced");
    store.set("hyperparameters", defaults);
  };

  return (
    <div className="space-y-4">
      {/* Aide IA — motif UNIQUE (AiAssist). « Appliquer » sélectionne l'algorithme recommandé
          (preset équilibré + défauts). */}
      <AiAssist
        title={tw("aiTitle")}
        guideLabel={tw("aiGuide")}
        availableLabel={tw("aiAvailable")}
        applyLabel={tw("aiApply")}
        chooseLabel={tw("aiChoose")}
        onApply={() => {
          const rec = cards.find((card) => card.key === recommended);
          if (rec) choose(rec.key, rec.defaults);
        }}>
        <p className="text-sm">
          {t("aiReco", {
            algo: t(`names.${recommended}` as never),
            reason:
              recommended === "decision_tree"
                ? t("reasonSmall", { rows })
                : t("reasonLarge", { rows, cols })
          })}
        </p>
      </AiAssist>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => {
          const active = store.algorithm === card.key;
          const isRecommended = card.key === recommended;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => choose(card.key, card.defaults)}
              className={cn(
                "bg-card rounded-lg border p-5 text-left transition-all",
                active
                  ? "border-primary ring-primary/30 ring-2"
                  : isRecommended
                    ? "border-ai/50 hover:border-ai"
                    : "hover:border-primary/40"
              )}>
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg",
                    active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                  )}>
                  {card.key === "decision_tree" ? (
                    <TreesIcon className="size-5" />
                  ) : (
                    <BrainCircuitIcon className="size-5" />
                  )}
                </div>
                <p className="font-semibold">{t(`names.${card.key}` as never)}</p>
                {isRecommended ? (
                  <Badge className="bg-ai text-ai-foreground ml-auto gap-1">
                    <SparklesIcon className="size-3" />
                    {t(`badges.recommended` as never)}
                  </Badge>
                ) : card.badge !== "recommended" ? (
                  <Badge variant="secondary" className="ml-auto">
                    {t(`badges.${card.badge}` as never)}
                  </Badge>
                ) : null}
              </div>
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                {t(`descriptions.${card.key}` as never)}
              </p>
              {active ? (
                <p className="text-primary mt-3 flex items-center gap-1.5 text-xs font-medium">
                  <CheckCircle2Icon className="size-3.5" /> {t("selected")}
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Étape 7
export function Step7Hyperparameters({ algorithms }: { algorithms: Record<string, unknown>[] }) {
  const t = useTranslations("wizard.step7");
  const tw = useTranslations("wizard");
  const store = useWizardStore();
  const card = (algorithms as unknown as AlgorithmCard[]).find((c) => c.key === store.algorithm);
  if (!card) return null;

  const applyPreset = (preset: string) => {
    store.set("preset", preset);
    if (preset !== "custom") {
      store.set("hyperparameters", { ...card.defaults, ...card.presets[preset] });
    }
  };

  const setParam = (name: string, value: unknown) => {
    store.set("preset", "custom");
    store.set("hyperparameters", { ...store.hyperparameters, [name]: value });
  };

  return (
    <div className="space-y-4">
      {/* Aide IA — motif UNIQUE (AiAssist). « Appliquer » pose le préréglage équilibré. */}
      <AiAssist
        title={tw("aiTitle")}
        guideLabel={tw("aiGuide")}
        availableLabel={tw("aiAvailable")}
        applyLabel={tw("aiApply")}
        chooseLabel={tw("aiChoose")}
        onApply={() => applyPreset("balanced")}>
        <p className="text-sm">{t("aiReco")}</p>
      </AiAssist>
      <div className="flex flex-wrap gap-2">
        {["balanced", "high_precision", "fast", "custom"].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => applyPreset(preset)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition-colors",
              store.preset === preset
                ? "border-primary bg-primary text-primary-foreground font-medium"
                : "bg-card hover:border-primary/40"
            )}>
            {t(`presets.${preset}` as never)}
          </button>
        ))}
      </div>
      {/* Paramètres — card-free (cohérence : mêmes cases bordées, sans grosse carte). */}
      <div className="grid gap-4 sm:grid-cols-2">
        {Object.entries(card.schema.properties).map(([name, spec]) => {
            const value = store.hyperparameters[name] ?? spec.default;
            if (spec.type === "boolean") {
              return (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label className="font-mono text-sm">{name}</Label>
                    <p className="text-muted-foreground text-xs">{t(`hints.${name}` as never)}</p>
                  </div>
                  <Switch checked={Boolean(value)} onCheckedChange={(c) => setParam(name, c)} />
                </div>
              );
            }
            if (spec.enum) {
              return (
                <div key={name} className="rounded-md border p-3">
                  <Label className="font-mono text-sm">{name}</Label>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {spec.enum.map((option) => (
                      <Button
                        key={option}
                        size="sm"
                        variant={value === option ? "secondary" : "outline"}
                        onClick={() => setParam(name, option)}>
                        {option}
                      </Button>
                    ))}
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">{t(`hints.${name}` as never)}</p>
                </div>
              );
            }
            return (
              <div key={name} className="rounded-md border p-3">
                <Label className="font-mono text-sm">
                  {name} {spec.minimum !== undefined ? `(${spec.minimum}–${spec.maximum})` : ""}
                </Label>
                <Input
                  type="number"
                  className="mt-2 h-8"
                  min={spec.minimum}
                  max={spec.maximum}
                  value={String(value ?? "")}
                  onChange={(event) => setParam(name, Number(event.target.value))}
                />
                <p className="text-muted-foreground mt-1 text-xs">{t(`hints.${name}` as never)}</p>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Étape 8 (+ 9 : transition)
type LaunchState = "idle" | "starting" | "running" | "completed" | "failed" | "cancelled";

// Durée MINIMALE d'affichage de la console (montrer le « côté IA » : même si l'entraînement
// réel est quasi instantané, on laisse voir le traitement ~2,6 s avant de basculer aux résultats).
const MIN_CONSOLE_MS = 2600;

export function Step8Launch({
  dataset,
  onLockChange
}: {
  dataset: DatasetDetail;
  onLockChange: (locked: boolean) => void;
}) {
  const t = useTranslations("wizard.step8");
  const tErrors = useTranslations("wizard.errors");
  const router = useRouter();
  const store = useWizardStore();
  const user = useAuthStore((state) => state.user);
  const [confirmed, setConfirmed] = useState(false);
  const [state, setState] = useState<LaunchState>("idle");
  const [progress, setProgress] = useState(0);
  // Progression AFFICHÉE : ramp client-side pour un « traitement » lisible (le résultat reste réel).
  const [displayProgress, setDisplayProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const experimentRef = useRef<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rampRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runStartRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      sourceRef.current?.close();
      if (pollRef.current) clearInterval(pollRef.current);
      if (rampRef.current) clearInterval(rampRef.current);
    },
    []
  );

  useEffect(() => {
    onLockChange(state === "starting" || state === "running");
  }, [state, onLockChange]);

  const finish = async (status: string) => {
    sourceRef.current?.close();
    if (pollRef.current) clearInterval(pollRef.current);
    if (rampRef.current) {
      clearInterval(rampRef.current);
      rampRef.current = null;
    }
    if (status === "completed" && experimentRef.current) {
      setDisplayProgress(100);
      // Laisse la console visible au moins MIN_CONSOLE_MS (montrer le traitement IA) avant
      // de basculer aux résultats — le résultat est déjà réellement calculé côté worker.
      const elapsed = runStartRef.current ? Date.now() - runStartRef.current : MIN_CONSOLE_MS;
      if (elapsed < MIN_CONSOLE_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_CONSOLE_MS - elapsed));
      }
      setState("completed");
      store.nextStep(); // étape 9 : transition automatique vers les résultats
      router.push(`/experiments/${experimentRef.current}`);
    } else if (status === "cancelled") {
      setState("cancelled");
    } else {
      const { data } = experimentRef.current
        ? await getExperiment({
            path: { experiment_id: experimentRef.current },
            throwOnError: false
          })
        : { data: undefined };
      setErrorMessage(data?.error_message ?? data?.error_code ?? "");
      setState("failed");
    }
  };

  const pollFallback = (experimentId: string) => {
    // Repli polling 2 s (ADR-007) si le flux SSE tombe
    pollRef.current = setInterval(async () => {
      const { data } = await getExperiment({
        path: { experiment_id: experimentId },
        throwOnError: false
      });
      if (!data) return;
      setProgress(data.progress);
      setQueuePosition(data.queue_position ?? null);
      if (["completed", "failed", "cancelled"].includes(data.status)) void finish(data.status);
    }, 2000);
  };

  const launch = async () => {
    setState("starting");
    const payload = toExperimentCreate(useWizardStore.getState());
    if (!payload) {
      setState("idle");
      return;
    }
    const { data, error } = await startExperiment({ body: payload, throwOnError: false });
    if (!data) {
      const code = (error as { detail?: { code?: string } } | undefined)?.detail?.code ?? "";
      setErrorMessage(tErrors.has(code as never) ? tErrors(code as never) : code);
      setState("failed");
      return;
    }
    experimentRef.current = data.id;
    store.set("experimentId", data.id);
    // Rafraîchit le solde de crédits affiché (1 crédit vient d'être débité)
    void getMe({ throwOnError: false }).then(({ data: me }) => {
      if (me) useAuthStore.getState().setUser(me);
    });
    setState("running");
    setLogs([]);
    // Ramp de progression client-side (~0 → 92 % en ~2,5 s) : rend le « traitement » visible
    // même si l'entraînement réel est quasi instantané. La vraie progression SSE peut la dépasser.
    runStartRef.current = Date.now();
    setDisplayProgress(0);
    if (rampRef.current) clearInterval(rampRef.current);
    rampRef.current = setInterval(() => {
      setDisplayProgress((p) => (p >= 92 ? 92 : p + Math.max(1, (92 - p) * 0.06)));
    }, 120);
    if (data.job_id) {
      const source = new EventSource(`/api/v1/jobs/${data.job_id}/events`);
      sourceRef.current = source;
      source.addEventListener("progress", (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          status: string;
          progress: number;
          log_line?: string | null;
        };
        setProgress(payload.progress);
        if (payload.log_line) setLogs((previous) => [...previous, payload.log_line as string]);
        if (["completed", "failed", "cancelled"].includes(payload.status)) {
          void finish(payload.status);
        }
      });
      source.onerror = () => {
        source.close();
        if (experimentRef.current && !pollRef.current) pollFallback(experimentRef.current);
      };
    } else {
      pollFallback(data.id);
    }
  };

  const cancel = async () => {
    if (!experimentRef.current) return;
    const { cancelExperiment } = await import("@/lib/api/generated");
    await cancelExperiment({
      path: { experiment_id: experimentRef.current },
      throwOnError: false
    });
  };

  // Récap : chaque ligne = un réglage réellement transmis à l'entraînement. Teinte chart-N
  // purement tonale (monochrome), pour une lecture « fiche recette » claire et pédagogique.
  const recap: {
    icon: typeof DatabaseIcon;
    tone: string;
    label: string;
    value: string;
  }[] = [
    { icon: DatabaseIcon, tone: "bg-chart-1/10 text-chart-1", label: t("dataset"), value: dataset.display_name },
    { icon: TargetIcon, tone: "bg-chart-2/10 text-chart-2", label: t("target"), value: store.targetColumn ?? "" },
    { icon: LightbulbIcon, tone: "bg-chart-3/10 text-chart-3", label: t("task"), value: store.taskType ?? "" },
    {
      icon: EraserIcon,
      tone: "bg-chart-4/10 text-chart-4",
      label: t("cleaning"),
      value: t("cleaningValue", { count: Object.keys(store.columnStrategies).length })
    },
    {
      icon: SplitIcon,
      tone: "bg-chart-5/20 text-foreground",
      label: t("split"),
      value: `${Math.round((1 - store.testSize) * 100)} / ${Math.round(store.testSize * 100)} · random_state=42`
    },
    {
      icon: SlidersHorizontalIcon,
      tone: "bg-chart-1/10 text-chart-1",
      label: t("prep"),
      value: `${store.scalingEnabled ? store.scalingMethod : "—"} · ${store.encoding}`
    },
    {
      icon: Settings2Icon,
      tone: "bg-chart-2/10 text-chart-2",
      label: t("algo"),
      value: `${store.algorithm} (${store.preset})`
    }
  ];

  return (
    <div className="space-y-6">
      {/* Récapitulatif — card-free (cohérence). En-tête pédagogique + « fiche recette » :
          chaque tuile est un réglage validé, avec sa tuile-icône tonale. */}
      {state === "idle" || state === "starting" ? (
        <>
          <div className="space-y-4">
            {/* Libellé de section léger : le titre/​sous-titre de l'étape est déjà porté par la
                coquille (« Entraînement / Relisez, confirmez… ») — pas de second gros en-tête. */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardCheckIcon className="text-primary size-4" />
                {t("recap")}
              </span>
              <span className="text-muted-foreground text-xs">
                {t("recapCount", { count: recap.length })}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {recap.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center gap-3 rounded-lg border p-3">
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      row.tone
                    )}>
                    <row.icon className="size-4" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-muted-foreground text-xs">{row.label}</p>
                    <p className="truncate text-sm font-semibold">{row.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-muted/40 flex items-center gap-2 rounded-lg border p-3 text-sm">
              <CoinsIcon className="text-primary size-4 shrink-0" />
              {t("cost", { credits: user?.credits ?? 0 })}
            </div>
          </div>

          {/* Confirmation + lancement — card-free, mis en avant. */}
          <div className="space-y-4 border-t pt-6">
            <label className="hover:border-primary/40 flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm transition-colors">
              <Checkbox checked={confirmed} onCheckedChange={(c) => setConfirmed(c === true)} />
              {t("confirm")}
            </label>
            <div className="flex justify-center">
              <Button
                size="lg"
                onClick={() => void launch()}
                disabled={!confirmed || state === "starting"}>
                <RocketIcon />
                {state === "starting" ? t("launching") : t("launch")}
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {/* Console — panneau bordé (pas de Card), en-tête + progression + traitement IA + logs. */}
      {state === "running" || state === "completed" ? (
        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-semibold">
              <TerminalIcon className="text-muted-foreground size-4" />
              {t("console")}
            </span>
            {queuePosition !== null && queuePosition > 0 ? (
              <Badge variant="outline">{t("queued", { position: queuePosition })}</Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <Progress value={Math.max(displayProgress, progress)} className="h-2" />
            <span className="text-muted-foreground w-10 text-right font-mono text-xs">
              {Math.round(Math.max(displayProgress, progress))}%
            </span>
          </div>
          {state === "running" ? (
            <p className="text-ai flex items-center gap-2 text-sm font-medium">
              <Loader2Icon className="size-4 animate-spin" />
              {t("processing")}
            </p>
          ) : null}
          <ul className="bg-muted max-h-56 space-y-0.5 overflow-auto rounded-md p-3 font-mono text-xs leading-relaxed">
            {logs.map((line, index) => (
              <li key={index} className={index === logs.length - 1 ? "" : "text-muted-foreground"}>
                {line}
              </li>
            ))}
          </ul>
          {state === "running" ? (
            <Button variant="outline" size="sm" onClick={() => void cancel()}>
              <XCircleIcon />
              {t("cancel")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {state === "cancelled" ? (
        <Alert>
          <AlertDescription>{t("cancelled")}</AlertDescription>
        </Alert>
      ) : null}
      {state === "failed" ? (
        <Alert variant="destructive">
          <XCircleIcon />
          <AlertTitle>{t("failed", { message: errorMessage ?? "" })}</AlertTitle>
        </Alert>
      ) : null}
      {state === "completed" && experimentRef.current ? (
        <div className="flex justify-center">
          <Button size="lg" onClick={() => router.push(`/experiments/${experimentRef.current}`)}>
            <CheckCircle2Icon />
            {t("seeResults")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
