"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowUpDownIcon, FolderKanbanIcon, PlusIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectCard } from "@/components/ibis/projects/project-card";
import { listProjects } from "@/lib/api/generated";
import type { ProjectPage } from "@/lib/api/generated";

// 09 — Projets : espace de pilotage. Chaque carte porte le MissionStepper
// partagé comme colonne vertébrale (voir project-card.tsx) — signature
// distincte du catalogue (05) et du dashboard (04).
export default function ProjectsPage() {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"updated" | "name">("updated");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ProjectPage | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
    const { data: result } = await listProjects({
      query: { q: search || undefined, page, page_size: 12 },
      throwOnError: false
    });
    if (!result) {
      setState("error");
      return;
    }
    setData(result);
    setState("ready");
  }, [search, page]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

  const items = data?.items ?? [];
  // Tri côté client sur les items déjà chargés (listProjects n'accepte que q/page/page_size).
  const sortedItems = [...items].sort((a, b) =>
    sort === "name"
      ? a.name.localeCompare(b.name)
      : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
            <FolderKanbanIcon className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
            <p className="text-muted-foreground mt-0.5 max-w-2xl text-sm">{t("subtitle")}</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <PlusIcon />
            {t("new")}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-sm">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={t("searchPlaceholder")}
            className="pl-8"
          />
        </div>
        <Select value={sort} onValueChange={(value) => setSort(value as "updated" | "name")}>
          <SelectTrigger className="w-52" aria-label={t("sortBy")}>
            <ArrowUpDownIcon />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">{t("sort.updated")}</SelectItem>
            <SelectItem value="name">{t("sort.name")}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground ml-auto text-sm">
          {data ? t("results", { count: data.total }) : tCommon("loading")}
        </p>
      </div>

      {state === "error" ? (
        <Card>
          <CardContent className="flex items-center justify-between py-6">
            <span>{tCommon("error")}</span>
            <Button variant="outline" onClick={() => void load()}>
              {tCommon("retry")}
            </Button>
          </CardContent>
        </Card>
      ) : state === "loading" && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-56 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderKanbanIcon />
            </EmptyMedia>
            <EmptyTitle>{t("empty.title")}</EmptyTitle>
            <EmptyDescription className="mx-auto max-w-md">{t("empty.body")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/projects/new">{t("empty.cta")}</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sortedItems.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
