"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  DownloadCloudIcon,
  GlobeIcon,
  LinkIcon,
  LockIcon,
  Loader2Icon
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getJob, importKaggleDataset } from "@/lib/api/generated";
import { cn } from "@/lib/utils";

/** Cadence de sondage du job — l'import réseau dure de quelques secondes à ~1 min. */
const POLL_MS = 1500;

type Phase =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "running"; jobId: string; progress: number; message: string | null }
  | { kind: "duplicate"; datasetId: string; reason: string }
  | { kind: "done"; datasetId: string }
  | { kind: "error"; message: string };

export function KaggleImportDialog({ onImported }: { onImported?: () => void }) {
  const t = useTranslations("datasets.kaggleImport");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [access, setAccess] = useState<"public" | "private">("public");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  /** Sondage du job : la BDD est la source de vérité, le polling reste exact. */
  const poll = useCallback(
    async (jobId: string) => {
      const { data, error } = await getJob({ path: { job_id: jobId }, throwOnError: false });
      if (error || !data) {
        setPhase({ kind: "error", message: t("errors.unreachable") });
        return;
      }

      if (data.status === "completed") {
        // `ref_id` porte le dataset créé par le worker.
        setPhase({ kind: "done", datasetId: data.ref_id ?? "" });
        onImported?.();
        return;
      }
      if (data.status === "failed" || data.status === "cancelled") {
        // Le worker écrit un message LISIBLE pour les rejets métier (licence, taille, lien mort).
        setPhase({ kind: "error", message: data.message ?? t("errors.generic") });
        return;
      }

      setPhase({
        kind: "running",
        jobId,
        progress: data.progress ?? 0,
        message: data.message ?? null
      });
      timer.current = setTimeout(() => void poll(jobId), POLL_MS);
    },
    [onImported, t]
  );

  const submit = useCallback(async () => {
    setPhase({ kind: "submitting" });
    const { data, error } = await importKaggleDataset({
      body: { url: url.trim(), access },
      throwOnError: false
    });

    if (error || !data) {
      // Le backend valide le lien de façon synchrone : le message est exploitable tel quel.
      const detail =
        typeof error === "object" && error !== null && "detail" in error
          ? String((error as { detail?: unknown }).detail ?? "")
          : "";
      setPhase({ kind: "error", message: detail || t("errors.badLink") });
      return;
    }

    if (data.existing_dataset_id) {
      setPhase({
        kind: "duplicate",
        datasetId: data.existing_dataset_id,
        reason: data.duplicate_reason ?? t("duplicate.generic")
      });
      return;
    }

    if (data.job) void poll(data.job.id);
  }, [access, poll, t, url]);

  const reset = useCallback(() => {
    stopPolling();
    setUrl("");
    setAccess("public");
    setPhase({ kind: "idle" });
  }, [stopPolling]);

  const busy = phase.kind === "submitting" || phase.kind === "running";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <DownloadCloudIcon />
          {t("trigger")}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {phase.kind === "done" ? (
          <ResultPanel
            tone="success"
            icon={<CheckCircle2Icon className="size-5" />}
            title={t("done.title")}
            body={t("done.body")}
            action={
              phase.datasetId ? (
                <Button
                  onClick={() => {
                    setOpen(false);
                    router.push(`/datasets/${phase.datasetId}`);
                  }}>
                  {t("done.open")}
                </Button>
              ) : null
            }
          />
        ) : phase.kind === "duplicate" ? (
          <ResultPanel
            tone="warning"
            icon={<AlertTriangleIcon className="size-5" />}
            title={t("duplicate.title")}
            body={phase.reason}
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  router.push(`/datasets/${phase.datasetId}`);
                }}>
                {t("duplicate.open")}
              </Button>
            }
          />
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="kaggle-url">{t("urlLabel")}</Label>
              <div className="relative">
                <LinkIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  id="kaggle-url"
                  value={url}
                  disabled={busy}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://www.kaggle.com/datasets/uciml/iris"
                  className="pl-9"
                />
              </div>
              <p className="text-muted-foreground text-xs">{t("urlHint")}</p>
            </div>

            <fieldset className="space-y-2" disabled={busy}>
              <Label asChild>
                <legend>{t("visibility.label")}</legend>
              </Label>
              <RadioGroup
                value={access}
                onValueChange={(value) => setAccess(value as "public" | "private")}
                className="gap-2">
                <VisibilityOption
                  value="public"
                  current={access}
                  icon={<GlobeIcon className="size-4" />}
                  title={t("visibility.public")}
                  hint={t("visibility.publicHint")}
                />
                <VisibilityOption
                  value="private"
                  current={access}
                  icon={<LockIcon className="size-4" />}
                  title={t("visibility.private")}
                  hint={t("visibility.privateHint")}
                />
              </RadioGroup>
              {/* Dit AVANT l'import : une licence restrictive dégrade en privé. Mieux vaut
                  l'annoncer que laisser l'utilisateur découvrir un résultat inattendu. */}
              <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                {t("visibility.licenseNotice")}
              </p>
            </fieldset>

            {phase.kind === "running" ? (
              <div className="bg-muted/50 space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2Icon className="size-4 animate-spin" />
                  <span>{phase.message ?? t("running")}</span>
                </div>
                <Progress value={phase.progress} />
              </div>
            ) : null}

            {phase.kind === "error" ? (
              <ResultPanel
                tone="danger"
                icon={<AlertTriangleIcon className="size-5" />}
                title={t("errors.title")}
                body={phase.message}
              />
            ) : null}
          </div>
        )}

        {phase.kind === "done" || phase.kind === "duplicate" ? null : (
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button onClick={() => void submit()} disabled={busy || url.trim().length === 0}>
              {busy ? <Loader2Icon className="animate-spin" /> : <DownloadCloudIcon />}
              {t("submit")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VisibilityOption({
  value,
  current,
  icon,
  title,
  hint
}: {
  value: string;
  current: string;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  const selected = current === value;
  return (
    <Label
      htmlFor={`access-${value}`}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
        selected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
      )}>
      <RadioGroupItem value={value} id={`access-${value}`} className="mt-0.5" />
      <span className="space-y-0.5">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {icon}
          {title}
        </span>
        <span className="text-muted-foreground block text-xs font-normal">{hint}</span>
      </span>
    </Label>
  );
}

function ResultPanel({
  tone,
  icon,
  title,
  body,
  action
}: {
  tone: "success" | "warning" | "danger";
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  const tones = {
    success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
    warning: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400",
    danger: "border-destructive/30 bg-destructive/5 text-destructive"
  } as const;

  return (
    <div className={cn("space-y-3 rounded-lg border p-4", tones[tone])}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <p className="text-foreground/80 text-sm">{body}</p>
      {action ? <div className="flex justify-end">{action}</div> : null}
    </div>
  );
}
