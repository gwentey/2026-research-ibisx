"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { GaugeIcon, LayoutGridIcon, PlusIcon, SearchIcon, TableIcon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { DatasetCard } from "@/components/ibis/datasets/dataset-card";
import { FiltersSheet } from "@/components/ibis/datasets/filters-sheet";
import { getDatasetFacets } from "@/lib/api/generated";
import type { DatasetFacets } from "@/lib/api/generated";
import { PAGE_SIZES, SORT_KEYS, formatCount, scoreColorClass } from "@/lib/datasets/constants";
import { activeFilterEntries, useCatalog } from "@/lib/datasets/use-catalog";
import { useAuthStore } from "@/lib/auth/store";

export default function DatasetsPage() {
  const t = useTranslations("datasets");
  const tScoring = useTranslations("scoring");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const catalog = useCatalog();
  const [facets, setFacets] = useState<DatasetFacets | null>(null);
  const [view, setView] = useState<"grid" | "table">("grid");
  const user = useAuthStore((state) => state.user);
  const canUpload = user?.role === "contributor" || user?.role === "admin";

  useEffect(() => {
    getDatasetFacets({ throwOnError: false }).then(({ data }) => setFacets(data ?? null));
  }, []);

  const activeEntries = activeFilterEntries(catalog.filters);
  const items = catalog.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              sessionStorage.setItem(
                "ibis:score:filters",
                JSON.stringify({ ...catalog.filters, q: catalog.search || undefined })
              );
              router.push("/datasets/score");
            }}>
            <GaugeIcon />
            {tScoring("scoreSelection")}
          </Button>
          {canUpload ? (
            <Button asChild>
              <Link href="/datasets/upload">
                <PlusIcon />
                {t("upload")}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-sm">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={catalog.search}
            onChange={(event) => catalog.setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-8"
          />
        </div>
        <FiltersSheet
          facets={facets}
          value={catalog.filters}
          activeCount={activeEntries.length}
          onApply={catalog.applyFilters}
        />
        <Select
          value={`${catalog.sortBy}:${catalog.sortOrder}`}
          onValueChange={(value) => {
            const [by, order] = value.split(":");
            catalog.setSort(by as never, order as never);
          }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_KEYS.flatMap((key) => [
              <SelectItem key={`${key}:asc`} value={`${key}:asc`}>
                {t(`sort.${key}`)} ↑
              </SelectItem>,
              <SelectItem key={`${key}:desc`} value={`${key}:desc`}>
                {t(`sort.${key}`)} ↓
              </SelectItem>
            ])}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon-sm"
            variant={view === "grid" ? "secondary" : "ghost"}
            aria-label={t("viewGrid")}
            onClick={() => setView("grid")}>
            <LayoutGridIcon />
          </Button>
          <Button
            size="icon-sm"
            variant={view === "table" ? "secondary" : "ghost"}
            aria-label={t("viewTable")}
            onClick={() => setView("table")}>
            <TableIcon />
          </Button>
        </div>
      </div>

      {activeEntries.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeEntries.map(([key, value]) => (
            <Badge key={key} variant="secondary" className="gap-1">
              {key} : {Array.isArray(value) ? value.join(", ") : String(value)}
              <button
                type="button"
                aria-label={tCommon("delete")}
                onClick={() => catalog.removeFilter(key)}>
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={catalog.clearFilters}>
            {t("clearAll")}
          </Button>
        </div>
      ) : null}

      <p className="text-muted-foreground text-sm">
        {catalog.data ? t("results", { count: catalog.data.total }) : tCommon("loading")}
      </p>

      {catalog.state === "error" ? (
        <Card>
          <CardContent className="flex items-center justify-between py-6">
            <span>{t("error.title")}</span>
            <Button variant="outline" onClick={() => void catalog.reload()}>
              {tCommon("retry")}
            </Button>
          </CardContent>
        </Card>
      ) : catalog.state === "loading" && !catalog.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-56 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <p className="font-medium">{t("empty.title")}</p>
            <p className="text-muted-foreground text-sm">
              {activeEntries.length > 0 || catalog.search
                ? t("empty.filtered")
                : t("empty.body")}
            </p>
            {activeEntries.length > 0 || catalog.search ? (
              <Button variant="outline" onClick={catalog.clearFilters}>
                {t("empty.reset")}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((dataset) => (
            <DatasetCard key={dataset.id} dataset={dataset} />
          ))}
        </div>
      ) : (
        <Card className="py-0">
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("sort.name")}</TableHead>
                  <TableHead>{t("sort.year")}</TableHead>
                  <TableHead className="text-right">{t("sort.instances")}</TableHead>
                  <TableHead className="text-right">{t("sort.features")}</TableHead>
                  <TableHead className="text-right">{t("card.missing")}</TableHead>
                  <TableHead className="text-right">{t("card.ethical")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((dataset) => (
                  <TableRow key={dataset.id}>
                    <TableCell>
                      <Link href={`/datasets/${dataset.id}`} className="font-medium hover:underline">
                        {dataset.display_name}
                      </Link>
                    </TableCell>
                    <TableCell>{dataset.year ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {formatCount(dataset.instances_number)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCount(dataset.features_number)}
                    </TableCell>
                    <TableCell className="text-right">
                      {dataset.global_missing_percentage ?? 0}%
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${scoreColorClass(Math.round(dataset.ethical_score * 100))}`}>
                      {Math.round(dataset.ethical_score * 100)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {catalog.data && catalog.data.total_pages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Select
            value={String(catalog.pageSize)}
            onValueChange={(value) => catalog.setPageSize(Number(value))}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {t("perPage", { count: size })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={catalog.page <= 1}
              onClick={() => catalog.setPage(catalog.page - 1)}>
              {t("pagePrev")}
            </Button>
            <span className="text-muted-foreground text-sm">
              {t("pageOf", { page: catalog.page, total: catalog.data.total_pages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={catalog.page >= catalog.data.total_pages}
              onClick={() => catalog.setPage(catalog.page + 1)}>
              {t("pageNext")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
