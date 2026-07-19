"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon, Loader2Icon, MinusIcon, ShieldCheckIcon, SparklesIcon, XIcon } from "lucide-react";

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
import { reviewDatasetEthics } from "@/lib/api/generated";
import type { DatasetDetail } from "@/lib/api/generated";
import { ETHICAL_KEYS, type EthicalKey } from "@/lib/datasets/constants";
import { countUnsetCriteria, suggestionsOf } from "@/lib/datasets/ethics-review";
import { cn } from "@/lib/utils";

type Tristate = boolean | null;

/**
 * Revue humaine des critères éthiques.
 *
 * La suggestion de l'IA est affichée comme une PROPOSITION distincte de la valeur retenue :
 * tant que l'utilisateur n'a pas tranché, rien n'est compté dans le score. Il peut aussi
 * contredire l'IA — c'est tout l'intérêt de lui demander.
 */
export function EthicsReviewDialog({
  dataset,
  onReviewed
}: {
  dataset: DatasetDetail;
  onReviewed?: (updated: DatasetDetail) => void;
}) {
  const t = useTranslations("datasets.ethicsReview");
  const te = useTranslations("datasets.ethics");

  const criteria = dataset.ethical_criteria as Record<string, Tristate>;
  // Même extraction que le bandeau — une seule source, testée dans lib/datasets/ethics-review.
  const suggestions = useMemo(() => suggestionsOf(dataset), [dataset]);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, Tristate>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Valeur affichée : ce que l'humain a déjà choisi, sinon la valeur en base. */
  const valueOf = useCallback(
    (key: EthicalKey): Tristate => (key in draft ? draft[key] : (criteria[key] ?? null)),
    [criteria, draft]
  );

  const openDialog = useCallback(() => {
    setDraft({});
    setError(null);
    setOpen(true);
  }, []);

  /** Pré-remplit le brouillon avec les propositions de l'IA — sans les enregistrer. */
  const acceptAllSuggestions = useCallback(() => {
    setDraft((current) => ({ ...current, ...suggestions.values }));
  }, [suggestions.values]);

  const submit = useCallback(async () => {
    setSaving(true);
    setError(null);
    const { data, error: apiError } = await reviewDatasetEthics({
      path: { dataset_id: dataset.id },
      body: { values: draft },
      throwOnError: false
    });
    setSaving(false);

    if (apiError || !data) {
      setError(t("error"));
      return;
    }
    onReviewed?.(data);
    setOpen(false);
  }, [dataset.id, draft, onReviewed, t]);

  const pendingCount = countUnsetCriteria(criteria);
  const suggestedCount = Object.keys(suggestions.values).length;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? openDialog() : setOpen(false))}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <ShieldCheckIcon className="size-3.5" />
          {t("trigger")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {suggestedCount > 0 ? (
          <div className="border-ai/30 bg-ai/5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-3">
            <p className="flex items-center gap-2 text-sm">
              <SparklesIcon className="text-ai size-4" />
              {t("aiBanner", { count: suggestedCount })}
            </p>
            <Button size="sm" variant="secondary" onClick={acceptAllSuggestions}>
              {t("acceptAll")}
            </Button>
          </div>
        ) : null}

        <div className="space-y-2">
          {ETHICAL_KEYS.map((key) => {
            const suggested = suggestions.values[key];
            const note = suggestions.notes[key];
            return (
              <div key={key} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    {/* Même libellé que la grille de lecture (datasets.ethics.<clé>) : une
                        seule source pour les 10 critères, pas de vocabulaire divergent. */}
                    <p className="text-sm font-medium">{te(key)}</p>
                    {suggested !== undefined ? (
                      <p className="text-ai flex items-start gap-1.5 text-xs">
                        <SparklesIcon className="mt-0.5 size-3 shrink-0" />
                        <span>
                          {t("aiSuggests", {
                            value: suggested ? t("answers.yes") : t("answers.no")
                          })}
                          {note ? ` — ${note}` : ""}
                        </span>
                      </p>
                    ) : null}
                  </div>
                  <TristateChoice
                    value={valueOf(key)}
                    onChange={(next) => setDraft((current) => ({ ...current, [key]: next }))}
                    labels={{
                      yes: t("answers.yes"),
                      no: t("answers.no"),
                      unknown: t("answers.unknown")
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-muted-foreground text-xs">{t("pending", { count: pendingCount })}</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              {t("cancel")}
            </Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? <Loader2Icon className="animate-spin" /> : null}
              {t("submit")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TristateChoice({
  value,
  onChange,
  labels
}: {
  value: Tristate;
  onChange: (next: Tristate) => void;
  labels: { yes: string; no: string; unknown: string };
}) {
  const options: { key: string; state: Tristate; icon: React.ReactNode; label: string }[] = [
    { key: "yes", state: true, icon: <CheckIcon className="size-3.5" />, label: labels.yes },
    { key: "no", state: false, icon: <XIcon className="size-3.5" />, label: labels.no },
    { key: "unknown", state: null, icon: <MinusIcon className="size-3.5" />, label: labels.unknown }
  ];

  // Couleurs sémantiques identiques à EthicalCriteriaGrid — aucune teinte inventée.
  const activeTone: Record<string, string> = {
    yes: "border-green-600/40 bg-green-600/10 text-green-700 dark:text-green-400",
    no: "border-red-600/40 bg-red-600/10 text-red-700 dark:text-red-400",
    unknown: "border-muted-foreground/30 bg-muted text-muted-foreground"
  };

  return (
    <div role="group" className="flex shrink-0 gap-1">
      {options.map((option) => {
        const selected = value === option.state;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.state)}
            className={cn(
              "flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
              selected ? activeTone[option.key] : "hover:bg-muted/60 text-muted-foreground"
            )}>
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
