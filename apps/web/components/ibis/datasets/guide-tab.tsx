"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SparklesIcon } from "lucide-react";

import { GuideIntro } from "@/components/ibis/datasets/guide-intro";
import { IbisBlocks } from "@/components/ibis/xai/ibis-blocks";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getDataset, requestAiGuide } from "@/lib/api/generated";
import type { DatasetDetail } from "@/lib/api/generated";
import { getBlocks } from "@/lib/xai/blocks";

type GuideData = {
  text: string;
  /** Document de blocs riches (guide v2). Absent sur les guides générés avant la v2. */
  blocks?: unknown;
  model_used: string;
  is_fallback: boolean;
  language: string;
  generated_at: string;
};

/** Repli de rendu pour les guides v1 (markdown : titres ## + paragraphes) — pas de HTML injecté. */
function GuideText({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {text.split(/\n{1,2}/).map((block, index) =>
        block.startsWith("## ") ? (
          <h3 key={index} className="pt-1 font-semibold">
            {block.slice(3)}
          </h3>
        ) : block.trim() ? (
          <p key={index}>{block}</p>
        ) : null
      )}
    </div>
  );
}

export function GuideTab({
  dataset,
  onDatasetRefresh
}: {
  dataset: DatasetDetail;
  onDatasetRefresh: (d: DatasetDetail) => void;
}) {
  const t = useTranslations("datasets.detail");
  const locale = useLocale();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  const guide = dataset.ai_guide as GuideData | null;
  const blocks = getBlocks(guide?.blocks);

  const generate = async () => {
    setRunning(true);
    setFailed(false);
    setProgress(0);
    const { data } = await requestAiGuide({
      path: { dataset_id: dataset.id },
      query: { language: locale as "fr" | "en" },
      throwOnError: false
    });
    if (!data) {
      setRunning(false);
      setFailed(true);
      return;
    }
    // Suivi temps réel SSE (ADR-007), repli implicite : le job reste consultable
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
        const { data: refreshed } = await getDataset({
          path: { dataset_id: dataset.id },
          throwOnError: false
        });
        if (refreshed) onDatasetRefresh(refreshed);
        setRunning(false);
      } else if (payload.status === "failed" || payload.status === "cancelled") {
        source.close();
        setRunning(false);
        setFailed(true);
      }
    });
    source.onerror = () => {
      source.close();
      setRunning(false);
    };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border p-4">
        <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
          <SparklesIcon className="size-5" />
        </div>
        <p className="mr-auto font-semibold">{t("tabGuide")}</p>
        {guide ? (
          guide.is_fallback ? (
            <Badge variant="secondary">{t("guideFallback")}</Badge>
          ) : (
            <Badge variant="outline">{t("guideModel", { model: guide.model_used })}</Badge>
          )
        ) : null}
        <Button onClick={() => void generate()} disabled={running}>
          {running ? t("guideRunning") : guide ? t("guideRegenerate") : t("guideGenerate")}
        </Button>
      </div>

      {running ? <Progress value={progress} /> : null}
      {failed ? (
        <Alert variant="destructive">
          <AlertDescription>{t("guideFailed")}</AlertDescription>
        </Alert>
      ) : null}

      {/* Annoncé AVANT l'action tant qu'aucun guide n'existe ; replié ensuite. */}
      <GuideIntro collapsible={Boolean(guide)} />

      {guide ? (
        <Card>
          <CardContent className="pt-6">
            {blocks.length > 0 ? (
              // Guide v2 : mêmes blocs riches que le copilote XAI (tableaux, tuiles, callouts).
              <IbisBlocks blocks={blocks} />
            ) : (
              <GuideText text={guide.text} />
            )}
            <p className="text-muted-foreground mt-4 text-xs">
              {t("guideDate", {
                date: new Date(guide.generated_at).toLocaleString(locale)
              })}
            </p>
          </CardContent>
        </Card>
      ) : !running ? (
        <p className="text-muted-foreground text-sm">{t("guideEmpty")}</p>
      ) : null}
    </div>
  );
}
