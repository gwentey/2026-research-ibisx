"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LayoutListIcon, Grid3X3Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResultsList } from "@/components/ibis/scoring/results-list";
import { ScoreHeatmap } from "@/components/ibis/scoring/score-heatmap";
import { WeightsPanel, type Weights } from "@/components/ibis/scoring/weights-panel";
import { getScoringProfiles, scoreDatasets } from "@/lib/api/generated";
import type { ProfilesResponse, ScoreResponse } from "@/lib/api/generated";
import type { CatalogFilters } from "@/lib/datasets/use-catalog";

const FILTERS_STORAGE_KEY = "ibis:score:filters";

/** Filtres transmis par « Scorer cette sélection » du catalogue (sessionStorage). */
function readSelectionFilters(): CatalogFilters | null {
  try {
    const raw = sessionStorage.getItem(FILTERS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CatalogFilters) : null;
  } catch {
    return null;
  }
}

export default function ScorePage() {
  const t = useTranslations("scoring");
  const [profiles, setProfiles] = useState<ProfilesResponse | null>(null);
  const [weights, setWeights] = useState<Weights>({});
  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  const [response, setResponse] = useState<ScoreResponse | null>(null);
  const [view, setView] = useState<"list" | "heatmap">("heatmap");
  const [loading, setLoading] = useState(true);
  const filtersRef = useRef<CatalogFilters | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    filtersRef.current = readSelectionFilters();
    getScoringProfiles({ throwOnError: false }).then(({ data }) => {
      if (data) {
        setProfiles(data);
        setWeights({ ...data.default_weights });
      }
    });
  }, []);

  const score = useCallback(async (currentWeights: Weights) => {
    const id = ++requestRef.current;
    setLoading(true);
    const { data } = await scoreDatasets({
      body: {
        filters: filtersRef.current ?? undefined,
        weights: Object.entries(currentWeights).map(([criterion_name, weight]) => ({
          criterion_name,
          weight
        }))
      },
      throwOnError: false
    });
    if (id !== requestRef.current) return;
    setResponse(data ?? null);
    setLoading(false);
  }, []);

  // Aperçu temps réel : re-scoring debouncé à chaque changement de poids (CDC §6.4)
  useEffect(() => {
    if (Object.keys(weights).length === 0) return;
    const timer = setTimeout(() => void score(weights), 400);
    return () => clearTimeout(timer);
  }, [weights, score]);

  const handleWeightsChange = (next: Weights, profile: string | null) => {
    setWeights(next);
    setActiveProfile(profile);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant={view === "list" ? "secondary" : "ghost"}
            aria-label={t("viewList")}
            onClick={() => setView("list")}>
            <LayoutListIcon />
          </Button>
          <Button
            size="icon-sm"
            variant={view === "heatmap" ? "secondary" : "ghost"}
            aria-label={t("viewHeatmap")}
            onClick={() => setView("heatmap")}>
            <Grid3X3Icon />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <WeightsPanel
          criteria={profiles?.criteria ?? []}
          profiles={profiles}
          weights={weights}
          activeProfile={activeProfile}
          onChange={handleWeightsChange}
        />

        <div className="min-w-0 space-y-3">
          <p className="text-muted-foreground text-sm">
            {loading
              ? t("loading")
              : t("resultsCount", { count: response?.results.length ?? 0 })}
          </p>
          {loading && !response ? (
            <Skeleton className="h-96 w-full" />
          ) : !response || response.results.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground text-sm">{t("empty")}</p>
              </CardContent>
            </Card>
          ) : view === "heatmap" ? (
            <ScoreHeatmap results={response.results} criteria={response.criteria} />
          ) : (
            <ResultsList results={response.results} criteria={response.criteria} />
          )}
        </div>
      </div>
    </div>
  );
}
