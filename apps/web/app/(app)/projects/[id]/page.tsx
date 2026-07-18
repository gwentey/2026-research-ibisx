"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  FlaskConicalIcon,
  ListChecksIcon,
  PencilIcon,
  PlayIcon,
  RouteIcon,
  ScaleIcon,
  Settings2Icon,
  SparklesIcon,
  Trash2Icon
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MissionStepper } from "@/components/ibis/mission-stepper";
import { StatTile } from "@/components/ibis/dashboard/stat-tile";
import { ProjectExperimentsTab } from "@/components/ibis/experiments/project-experiments-tab";
import { ResultsList } from "@/components/ibis/scoring/results-list";
import { ScoreHeatmap } from "@/components/ibis/scoring/score-heatmap";
import {
  deleteProject,
  getProject,
  getProjectRecommendations
} from "@/lib/api/generated";
import type { ProjectRead, ScoreResponse } from "@/lib/api/generated";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("projects");
  const td = useTranslations("projects.detail");
  const tScoring = useTranslations("scoring");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [project, setProject] = useState<ProjectRead | null>(null);
  const [recommendations, setRecommendations] = useState<ScoreResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [view, setView] = useState<"list" | "heatmap">("list");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    const [projectResult, recoResult] = await Promise.all([
      getProject({ path: { project_id: id }, throwOnError: false }),
      getProjectRecommendations({ path: { project_id: id }, throwOnError: false })
    ]);
    if (!projectResult.data) {
      setState("error");
      return;
    }
    setProject(projectResult.data);
    setRecommendations(recoResult.data ?? null);
    setState("ready");
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async () => {
    setDeleting(true);
    await deleteProject({ path: { project_id: id }, throwOnError: false });
    router.replace("/projects");
  };

  if (state === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (state === "error" || !project) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between py-6">
          <span>{tCommon("error")}</span>
          <Button variant="outline" onClick={() => void load()}>
            {tCommon("retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <MissionStepper current="project" label={td("missionLabel")} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
              <RouteIcon className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {project.name}
              </h1>
              {project.description ? (
                <p className="text-muted-foreground mt-0.5 max-w-2xl text-sm">
                  {project.description}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/projects/${project.id}/edit`}>
                <PencilIcon />
                {td("edit")}
              </Link>
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="text-destructive">
                  <Trash2Icon />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{td("deleteConfirmTitle")}</DialogTitle>
                  <DialogDescription>{td("deleteConfirmBody")}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="destructive" disabled={deleting} onClick={() => void remove()}>
                    {td("delete")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Bandeau de pilotage : lecture instantanée de l'état réel du projet */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile
            icon={ListChecksIcon}
            tone="chart-1"
            label={t("kpi.criteria")}
            value={String(project.active_criteria_count)}
          />
          <StatTile
            icon={ScaleIcon}
            tone="chart-2"
            label={t("kpi.weights")}
            value={String(Object.keys(project.weights).length)}
          />
          <StatTile
            icon={SparklesIcon}
            tone="chart-3"
            label={t("kpi.recommendations")}
            value={String(recommendations?.results.length ?? 0)}
          />
        </div>
      </div>

      <Tabs defaultValue="recommendations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recommendations" className="gap-1.5">
            <SparklesIcon className="size-3.5" />
            {td("tabRecommendations")}
          </TabsTrigger>
          <TabsTrigger value="experiments" className="gap-1.5">
            <FlaskConicalIcon className="size-3.5" />
            {td("tabExperiments")}
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5">
            <Settings2Icon className="size-3.5" />
            {td("tabConfig")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="space-y-3">
          <p className="text-muted-foreground max-w-2xl text-sm">
            {td("recommendationsHint")}
          </p>
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {tScoring("resultsCount", { count: recommendations?.results.length ?? 0 })}
            </p>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={view === "list" ? "secondary" : "ghost"}
                onClick={() => setView("list")}>
                {tScoring("viewList")}
              </Button>
              <Button
                size="sm"
                variant={view === "heatmap" ? "secondary" : "ghost"}
                onClick={() => setView("heatmap")}>
                {tScoring("viewHeatmap")}
              </Button>
            </div>
          </div>
          {recommendations && recommendations.results.length > 0 ? (
            view === "heatmap" ? (
              <ScoreHeatmap
                results={recommendations.results}
                criteria={recommendations.criteria}
              />
            ) : (
              <ResultsList
                results={recommendations.results}
                criteria={recommendations.criteria}
                renderAction={(datasetId) => (
                  <Button size="sm" asChild>
                    <Link href={`/wizard?projectId=${project.id}&datasetId=${datasetId}`}>
                      <PlayIcon />
                      {tScoring("train")}
                    </Link>
                  </Button>
                )}
              />
            )
          ) : (
            <Empty className="border-dashed">
              <EmptyMedia variant="icon">
                <SparklesIcon />
              </EmptyMedia>
              <EmptyDescription>{tScoring("empty")}</EmptyDescription>
            </Empty>
          )}
        </TabsContent>

        <TabsContent value="experiments">
          <ProjectExperimentsTab projectId={project.id} />
        </TabsContent>

        <TabsContent value="config">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{td("criteria")}</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(project.criteria).length === 0 ? (
                  <p className="text-muted-foreground text-sm">{td("noCriteria")}</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(project.criteria).map(([key, value]) => (
                      <Badge key={key} variant="secondary">
                        {key} :{" "}
                        {Array.isArray(value) ? (value as string[]).join(", ") : String(value)}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{td("weights")}</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(project.weights).length === 0 ? (
                  <p className="text-muted-foreground text-sm">{td("noWeights")}</p>
                ) : (
                  <div className="space-y-1">
                    {Object.entries(project.weights).map(([criterion, weight]) => (
                      <div key={criterion} className="flex items-center gap-2 text-sm">
                        <span className="w-44 truncate">
                          {tScoring(`criteria.${criterion}` as never)}
                        </span>
                        <div className="bg-muted h-2 flex-1 rounded">
                          <div
                            className="bg-primary h-2 rounded"
                            style={{ width: `${Math.min(100, weight * 100)}%` }}
                          />
                        </div>
                        <span className="w-10 text-right font-mono text-xs">
                          {weight.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
