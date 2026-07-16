"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { FolderIcon, PlusIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { listProjects } from "@/lib/api/generated";
import type { ProjectPage } from "@/lib/api/generated";

export default function ProjectsPage() {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [search, setSearch] = useState("");
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{t("subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <PlusIcon />
            {t("new")}
          </Link>
        </Button>
      </div>

      <div className="relative max-w-sm">
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

      <p className="text-muted-foreground text-sm">
        {data ? t("results", { count: data.total }) : tCommon("loading")}
      </p>

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
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <FolderIcon className="text-muted-foreground mx-auto size-8" />
            <p className="font-medium">{t("empty.title")}</p>
            <p className="text-muted-foreground mx-auto max-w-md text-sm">{t("empty.body")}</p>
            <Button asChild>
              <Link href="/projects/new">{t("empty.cta")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((project) => (
            <Card key={project.id} className="flex flex-col">
              <CardHeader>
                <Link
                  href={`/projects/${project.id}`}
                  className="line-clamp-1 font-semibold hover:underline">
                  {project.name}
                </Link>
                {project.description ? (
                  <p className="text-muted-foreground line-clamp-2 text-sm">
                    {project.description}
                  </p>
                ) : null}
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-muted-foreground text-xs">
                  {t("card.criteria", { count: project.active_criteria_count })} ·{" "}
                  {t("card.weights", { count: Object.keys(project.weights).length })}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {t("card.updated", {
                    date: new Date(project.updated_at).toLocaleDateString(locale)
                  })}
                </p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/projects/${project.id}`}>{t("card.open")}</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
