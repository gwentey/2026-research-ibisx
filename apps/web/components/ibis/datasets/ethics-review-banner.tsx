"use client";

import { useLocale, useTranslations } from "next-intl";
import { ShieldCheckIcon, SparklesIcon } from "lucide-react";

import { EthicsReviewDialog } from "@/components/ibis/datasets/ethics-review-dialog";
import type { DatasetDetail } from "@/lib/api/generated";
import { ethicsReviewState } from "@/lib/datasets/ethics-review";

/**
 * Bandeau « à confirmer » au-dessus de la grille éthique.
 *
 * La décision d'affichage vit dans `lib/datasets/ethics-review` (testée) — ici, uniquement
 * le rendu.
 */
export function EthicsReviewBanner({
  dataset,
  canEdit,
  onReviewed
}: {
  dataset: DatasetDetail;
  canEdit: boolean;
  onReviewed?: (updated: DatasetDetail) => void;
}) {
  const t = useTranslations("datasets.ethicsReview");
  const locale = useLocale();
  const state = ethicsReviewState(dataset);

  if (state.kind === "hidden") {
    return null;
  }

  if (state.kind === "reviewed") {
    return (
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <ShieldCheckIcon className="size-3.5" />
        {t("reviewedAt", { date: new Date(state.reviewedAt).toLocaleDateString(locale) })}
      </p>
    );
  }

  return (
    <div className="border-ai/30 bg-ai/5 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-dashed p-4">
      <div className="min-w-0 space-y-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          <SparklesIcon className="text-ai size-4" />
          {t("bannerTitle")}
        </p>
        <p className="text-muted-foreground text-sm">{t("bannerBody")}</p>
        <p className="text-muted-foreground text-xs">{t("pending", { count: state.unset })}</p>
      </div>
      {canEdit ? <EthicsReviewDialog dataset={dataset} onReviewed={onReviewed} /> : null}
    </div>
  );
}
