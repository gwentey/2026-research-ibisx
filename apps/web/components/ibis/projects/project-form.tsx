"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { WeightsPanel, type Weights } from "@/components/ibis/scoring/weights-panel";
import {
  createProject,
  getDatasetFacets,
  getScoringProfiles,
  scoreDatasets,
  updateProject
} from "@/lib/api/generated";
import type {
  DatasetFacets,
  ProfilesResponse,
  ProjectRead,
  ScoreResponse
} from "@/lib/api/generated";
import { getDomainVisual, primaryDomainVisual } from "@/lib/datasets/domain-visuals";
import type { CatalogFilters } from "@/lib/datasets/use-catalog";
import { cn } from "@/lib/utils";

const TOTAL_STEPS = 3;

interface ProjectFormProps {
  existing?: ProjectRead;
}

export function ProjectForm({ existing }: ProjectFormProps) {
  const t = useTranslations("projects.form");
  const tf = useTranslations("datasets.filterPanel");
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [criteria, setCriteria] = useState<CatalogFilters>(
    (existing?.criteria as CatalogFilters) ?? {}
  );
  const [weights, setWeights] = useState<Weights>(
    (existing?.weights as Weights) ?? {}
  );
  const [activeProfile, setActiveProfile] = useState<string | null>(null);
  const [facets, setFacets] = useState<DatasetFacets | null>(null);
  const [profiles, setProfiles] = useState<ProfilesResponse | null>(null);
  const [preview, setPreview] = useState<ScoreResponse | null>(null);
  const [saving, setSaving] = useState(false);

  // Chargement initial (facettes + profils). `existing` est stable après le premier rendu
  // (prop figée côté page /new comme /edit) et `weights` est lu via l'updater fonctionnel
  // ci-dessous : la dépendance déclarée reste donc exhaustive sans disable-next-line.
  useEffect(() => {
    getDatasetFacets({ throwOnError: false }).then(({ data }) => setFacets(data ?? null));
    getScoringProfiles({ throwOnError: false }).then(({ data }) => {
      setProfiles(data ?? null);
      if (!data || existing) return;
      setWeights((current) =>
        Object.keys(current).length === 0 ? { ...data.default_weights } : current
      );
    });
  }, [existing]);

  // Aperçu temps réel des recommandations (debounce 500 ms — CDC §7.2)
  useEffect(() => {
    const timer = setTimeout(async () => {
      const { data } = await scoreDatasets({
        body: {
          filters: criteria,
          weights: Object.entries(weights).map(([criterion_name, weight]) => ({
            criterion_name,
            weight
          }))
        },
        throwOnError: false
      });
      setPreview(data ?? null);
    }, 500);
    return () => clearTimeout(timer);
  }, [criteria, weights]);

  const setCriterion = <K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) =>
    setCriteria((current) => {
      const next = { ...current };
      if (value === undefined || (Array.isArray(value) && value.length === 0)) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });

  const toggleList = (key: "domains" | "tasks", item: string) => {
    const current = criteria[key] ?? [];
    setCriterion(
      key,
      current.includes(item) ? current.filter((v) => v !== item) : [...current, item]
    );
  };

  const submit = async () => {
    setSaving(true);
    const body = { name, description: description || null, criteria, weights };
    const result = existing
      ? await updateProject({
          path: { project_id: existing.id },
          body,
          throwOnError: false
        })
      : await createProject({ body, throwOnError: false });
    setSaving(false);
    if (!result.data) {
      toast.error(t("saving"));
      return;
    }
    toast.success(existing ? t("saved") : t("created"));
    router.replace(`/projects/${result.data.id}`);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        <div className="space-y-2.5">
          <Progress value={(step / TOTAL_STEPS) * 100} />
          <div className="flex flex-wrap items-center gap-1.5">
            {([1, 2, 3] as const).map((candidate) => (
              <span
                key={candidate}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  candidate === step
                    ? "border-primary bg-primary text-primary-foreground"
                    : candidate < step
                      ? "border-primary/40 text-primary"
                      : "text-muted-foreground"
                )}>
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded-full border text-[10px]",
                    candidate === step && "border-primary-foreground/60"
                  )}>
                  {candidate < step ? <CheckIcon className="size-2.5" /> : candidate}
                </span>
                {candidate === 1 ? t("step1") : candidate === 2 ? t("step2") : t("step3")}
              </span>
            ))}
          </div>
        </div>

        {step === 1 ? (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div>
                <Label htmlFor="project-name">{t("name")} *</Label>
                <Input
                  id="project-name"
                  value={name}
                  maxLength={255}
                  placeholder={t("namePlaceholder")}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="project-description">{t("description")}</Label>
                <Textarea
                  id="project-description"
                  value={description}
                  placeholder={t("descriptionPlaceholder")}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 2 ? (
          <Card>
            <CardContent className="space-y-5 pt-6">
              <p className="text-muted-foreground text-sm">{t("criteriaHint")}</p>
              <div className="space-y-2">
                <Label className="text-sm">{tf("domains")}</Label>
                <div className="flex flex-wrap gap-2">
                  {(facets?.domains ?? []).map((facet) => {
                    const visual = getDomainVisual(facet.value);
                    const DomainIcon = visual.icon;
                    const active = criteria.domains?.includes(facet.value);
                    return (
                      <button
                        key={facet.value}
                        type="button"
                        onClick={() => toggleList("domains", facet.value)}
                        className={cn(
                          "hover:bg-muted flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm",
                          active && "border-primary bg-muted"
                        )}>
                        <DomainIcon
                          className={cn("size-3.5", active ? visual.tone.text : "text-muted-foreground")}
                        />
                        {facet.value}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">{tf("tasks")}</Label>
                <div className="flex flex-wrap gap-2">
                  {(facets?.tasks ?? []).map((facet) => (
                    <button
                      key={facet.value}
                      type="button"
                      onClick={() => toggleList("tasks", facet.value)}
                      className={cn(
                        "hover:bg-muted rounded-md border px-2 py-1 text-sm",
                        criteria.tasks?.includes(facet.value) && "border-primary bg-muted"
                      )}>
                      {facet.value}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-sm">{tf("instances")}</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder={tf("min")}
                      className="h-8"
                      value={criteria.instances_min ?? ""}
                      onChange={(e) =>
                        setCriterion(
                          "instances_min",
                          e.target.value === "" ? undefined : Number(e.target.value)
                        )
                      }
                    />
                    <Input
                      type="number"
                      placeholder={tf("max")}
                      className="h-8"
                      value={criteria.instances_max ?? ""}
                      onChange={(e) =>
                        setCriterion(
                          "instances_max",
                          e.target.value === "" ? undefined : Number(e.target.value)
                        )
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm">{tf("year")}</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder={tf("min")}
                      className="h-8"
                      value={criteria.year_min ?? ""}
                      onChange={(e) =>
                        setCriterion(
                          "year_min",
                          e.target.value === "" ? undefined : Number(e.target.value)
                        )
                      }
                    />
                    <Input
                      type="number"
                      placeholder={tf("max")}
                      className="h-8"
                      value={criteria.year_max ?? ""}
                      onChange={(e) =>
                        setCriterion(
                          "year_max",
                          e.target.value === "" ? undefined : Number(e.target.value)
                        )
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">
                  {tf("ethicalScoreMin")} : {criteria.ethical_score_min ?? 0}%
                </Label>
                <Slider
                  value={[criteria.ethical_score_min ?? 0]}
                  min={0}
                  max={100}
                  step={10}
                  onValueChange={([value]) =>
                    setCriterion("ethical_score_min", value > 0 ? value : undefined)
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["split", tf("split")],
                    ["anonymized", tf("anonymized")],
                    ["temporal", tf("temporal")],
                    ["public", tf("public")]
                  ] as const
                ).map(([key, label]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-md border p-2">
                    <span className="text-sm">{label}</span>
                    <Switch
                      checked={criteria[key] === true}
                      onCheckedChange={(checked) =>
                        setCriterion(key, checked ? true : undefined)
                      }
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {step === 3 ? (
          <WeightsPanel
            criteria={profiles?.criteria ?? []}
            profiles={profiles}
            weights={weights}
            activeProfile={activeProfile}
            onChange={(next, profile) => {
              setWeights(next);
              setActiveProfile(profile);
            }}
          />
        ) : null}

        <div className="flex justify-between">
          <Button
            variant="ghost"
            disabled={step === 1 || saving}
            onClick={() => setStep((s) => s - 1)}>
            ←
          </Button>
          {step < TOTAL_STEPS ? (
            <Button disabled={step === 1 && !name.trim()} onClick={() => setStep((s) => s + 1)}>
              →
            </Button>
          ) : (
            <Button disabled={!name.trim() || saving} onClick={() => void submit()}>
              {saving ? t("saving") : existing ? t("save") : t("create")}
            </Button>
          )}
        </div>
      </div>

      <Card className="h-fit lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SparklesIcon className="text-muted-foreground size-4" />
            {t("preview")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium">
            {t("previewCount", { count: preview?.results.length ?? 0 })}
          </p>
          {preview && preview.results.length > 0 ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium uppercase">
                {t("previewTop")}
              </p>
              {preview.results.slice(0, 3).map((result) => {
                const visual = primaryDomainVisual(result.dataset.domain);
                const DomainIcon = visual.icon;
                return (
                  <div key={result.dataset.id} className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground font-mono text-xs">
                      #{result.rank}
                    </span>
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded",
                        visual.tone.bgTile,
                        visual.tone.text
                      )}>
                      <DomainIcon className="size-3" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {result.dataset.display_name}
                    </span>
                    <span className="font-mono text-xs font-semibold">
                      {Math.round(result.score * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
