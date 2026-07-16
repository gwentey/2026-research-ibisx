"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FlaskConicalIcon, PencilIcon, Trash2Icon } from "lucide-react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MissionStepper } from "@/components/ibis/mission-stepper";
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
      <div className="space-y-3">
        <MissionStepper current="project" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            {project.description ? (
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
                {project.description}
              </p>
            ) : null}
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
      </div>

      <Tabs defaultValue="recommendations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recommendations">{td("tabRecommendations")}</TabsTrigger>
          <TabsTrigger value="experiments">{td("tabExperiments")}</TabsTrigger>
          <TabsTrigger value="config">{td("tabConfig")}</TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="space-y-3">
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
              />
            )
          ) : (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground text-sm">{tScoring("empty")}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="experiments">
          <Card>
            <CardContent className="space-y-2 py-10 text-center">
              <FlaskConicalIcon className="text-muted-foreground mx-auto size-8" />
              <p className="font-medium">{td("experimentsEmptyTitle")}</p>
              <p className="text-muted-foreground mx-auto max-w-md text-sm">
                {td("experimentsEmptyBody")}
              </p>
            </CardContent>
          </Card>
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
