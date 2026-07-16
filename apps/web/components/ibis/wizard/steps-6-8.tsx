"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BrainCircuitIcon, InfoIcon, TreesIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { getExperiment, getMe, startExperiment } from "@/lib/api/generated";
import type { DatasetDetail } from "@/lib/api/generated";
import type { QualityData } from "@/app/wizard/page";
import { toExperimentCreate, useWizardStore } from "@/lib/wizard/store";
import { useAuthStore } from "@/lib/auth/store";

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
  quality,
  onNext
}: {
  algorithms: Record<string, unknown>[];
  quality: QualityData | null;
  onNext: () => void;
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
      <Alert>
        <InfoIcon />
        <AlertDescription>
          {t("aiReco", {
            algo: t(`names.${recommended}` as never),
            reason:
              recommended === "decision_tree"
                ? t("reasonSmall", { rows })
                : t("reasonLarge", { rows, cols })
          })}
        </AlertDescription>
      </Alert>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => choose(card.key, card.defaults)}
            className={`rounded-lg border p-4 text-left ${
              store.algorithm === card.key ? "border-primary bg-muted" : "hover:bg-muted"
            }`}>
            <div className="flex items-center gap-2">
              {card.key === "decision_tree" ? (
                <TreesIcon className="size-5" />
              ) : (
                <BrainCircuitIcon className="size-5" />
              )}
              <p className="font-semibold">{t(`names.${card.key}` as never)}</p>
              <Badge variant="secondary" className="ml-auto">
                {t(`badges.${card.badge}` as never)}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              {t(`descriptions.${card.key}` as never)}
            </p>
          </button>
        ))}
      </div>
      <Button onClick={onNext} disabled={!store.algorithm}>
        {tw("next")}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- Étape 7
export function Step7Hyperparameters({
  algorithms,
  onNext
}: {
  algorithms: Record<string, unknown>[];
  onNext: () => void;
}) {
  const t = useTranslations("wizard.step7");
  const tw = useTranslations("wizard");
  const store = useWizardStore();
  const card = (algorithms as unknown as AlgorithmCard[]).find(
    (c) => c.key === store.algorithm
  );
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
      <div className="flex flex-wrap gap-1">
        {["balanced", "high_precision", "fast", "custom"].map((preset) => (
          <Button
            key={preset}
            size="sm"
            variant={store.preset === preset ? "secondary" : "outline"}
            onClick={() => applyPreset(preset)}>
            {t(`presets.${preset}` as never)}
          </Button>
        ))}
      </div>
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          {Object.entries(card.schema.properties).map(([name, spec]) => {
          const value = store.hyperparameters[name] ?? spec.default;
          if (spec.type === "boolean") {
            return (
              <div key={name} className="flex items-center justify-between rounded-md border p-3">
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
                <div className="mt-2 flex gap-1">
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
        </CardContent>
      </Card>
      <Button onClick={onNext}>{tw("next")}</Button>
    </div>
  );
}

// ---------------------------------------------------------------- Étape 8 (+ 9 : transition)
type LaunchState = "idle" | "starting" | "running" | "completed" | "failed" | "cancelled";

export function Step8Launch({ dataset }: { dataset: DatasetDetail }) {
  const t = useTranslations("wizard.step8");
  const tErrors = useTranslations("wizard.errors");
  const router = useRouter();
  const store = useWizardStore();
  const user = useAuthStore((state) => state.user);
  const [confirmed, setConfirmed] = useState(false);
  const [state, setState] = useState<LaunchState>("idle");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const experimentRef = useRef<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    sourceRef.current?.close();
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const finish = async (status: string) => {
    sourceRef.current?.close();
    if (pollRef.current) clearInterval(pollRef.current);
    if (status === "completed" && experimentRef.current) {
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

  const recap: [string, string][] = [
    [t("dataset"), dataset.display_name],
    [t("target"), store.targetColumn ?? ""],
    [t("task"), store.taskType ?? ""],
    [t("cleaning"), t("cleaningValue", { count: Object.keys(store.columnStrategies).length })],
    [t("split"), `${Math.round((1 - store.testSize) * 100)} / ${Math.round(store.testSize * 100)} · random_state=42`],
    [
      t("prep"),
      `${store.scalingEnabled ? store.scalingMethod : "—"} · ${store.encoding}`
    ],
    [t("algo"), `${store.algorithm} (${store.preset})`]
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("recap")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recap.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="text-right font-medium">{value}</span>
            </div>
          ))}
          <p className="text-muted-foreground pt-2 text-sm">
            {t("cost", { credits: user?.credits ?? 0 })}
          </p>
        </CardContent>
      </Card>

      {state === "idle" || state === "starting" ? (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={confirmed} onCheckedChange={(c) => setConfirmed(c === true)} />
            {t("confirm")}
          </label>
          <Button onClick={() => void launch()} disabled={!confirmed || state === "starting"}>
            {state === "starting" ? t("launching") : t("launch")}
          </Button>
        </div>
      ) : null}

      {state === "running" || state === "completed" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              {t("console")}
              {queuePosition !== null && queuePosition > 0 ? (
                <Badge variant="outline">{t("queued", { position: queuePosition })}</Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={progress} />
            <ul className="bg-muted max-h-56 overflow-auto rounded-md p-3 font-mono text-xs leading-relaxed">
              {logs.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
            {state === "running" ? (
              <Button variant="outline" size="sm" onClick={() => void cancel()}>
                {t("cancel")}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {state === "cancelled" ? <Alert><AlertDescription>{t("cancelled")}</AlertDescription></Alert> : null}
      {state === "failed" ? (
        <Alert variant="destructive">
          <AlertTitle>{t("failed", { message: errorMessage ?? "" })}</AlertTitle>
        </Alert>
      ) : null}
      {state === "completed" && experimentRef.current ? (
        <Button onClick={() => router.push(`/experiments/${experimentRef.current}`)}>
          {t("seeResults")}
        </Button>
      ) : null}
    </div>
  );
}
