"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  GaugeIcon,
  LayoutGridIcon,
  PlusIcon,
  SearchIcon,
  TableIcon,
  XIcon
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink
} from "@/components/ui/pagination";
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
import { KaggleImportDialog } from "@/components/ibis/datasets/kaggle-import-dialog";
import { FiltersSheet } from "@/components/ibis/datasets/filters-sheet";
import { getDatasetFacets } from "@/lib/api/generated";
import type { DatasetFacets } from "@/lib/api/generated";
import { PAGE_SIZES, SORT_KEYS, formatCount, scoreColorClass } from "@/lib/datasets/constants";
import { primaryDomainVisual } from "@/lib/datasets/domain-visuals";
import { activeFilterEntries, useCatalog } from "@/lib/datasets/use-catalog";
import { useAuthStore } from "@/lib/auth/store";
import { cn } from "@/lib/utils";

// Numéros de page avec ellipses (repris de real-estate/filter/property-listing.tsx).
function pageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "ellipsis")[] = [1];
  if (current > 3) pages.push("ellipsis");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i += 1) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

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
        {/* L'import Kaggle est ouvert à TOUT compte connecté (source publique, licence
            vérifiée, taille plafonnée, attribution nominative) ; l'upload libre, qui dépose
            des octets arbitraires sur le serveur, reste réservé aux contributeurs. */}
        <div className="flex flex-wrap items-center gap-2">
          {user !== null ? <KaggleImportDialog onImported={() => catalog.reload()} /> : null}
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

      {/* Barre-outil centrale : recherche proéminente, puis filtres / tri / affichage
          regroupés dans un panneau élevé (bg-card). L'action « Scorer » vit dans la barre
          de résultats ci-dessous, pour ne pas être confondue avec la recherche. */}
      <div className="bg-card rounded-xl border p-3 shadow-sm sm:p-4">
        <div className="relative">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2" />
          <Input
            value={catalog.search}
            onChange={(event) => catalog.setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-11 pl-11 md:text-base"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
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
          <div className="bg-background ml-auto flex items-center gap-0.5 rounded-md border p-0.5">
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {catalog.data ? t("results", { count: catalog.data.total }) : tCommon("loading")}
        </p>
        {catalog.data && catalog.data.total > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              sessionStorage.setItem(
                "ibis:score:filters",
                JSON.stringify({ ...catalog.filters, q: catalog.search || undefined })
              );
              router.push("/datasets/score");
            }}>
            <GaugeIcon />
            {tScoring("scoreSelectionCount", { count: catalog.data.total })}
          </Button>
        ) : null}
      </div>

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
                {items.map((dataset) => {
                  const visual = primaryDomainVisual(dataset.domain);
                  return (
                  <TableRow key={dataset.id}>
                    <TableCell>
                      <Link
                        href={`/datasets/${dataset.id}`}
                        className="flex items-center gap-2 font-medium hover:underline">
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                            visual.tone.bgTile,
                            visual.tone.text
                          )}>
                          {visual.monogram}
                        </span>
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
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {catalog.data && catalog.data.total_pages > 1
        ? (() => {
            const totalPages = catalog.data!.total_pages;
            return (
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
                <Pagination className="mx-0 w-auto">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        aria-label={t("pagePrev")}
                        size="icon"
                        className={cn(catalog.page <= 1 && "pointer-events-none opacity-50")}
                        onClick={(event) => {
                          event.preventDefault();
                          catalog.setPage(Math.max(1, catalog.page - 1));
                        }}>
                        <ChevronLeftIcon className="size-4" />
                      </PaginationLink>
                    </PaginationItem>
                    {pageNumbers(catalog.page, totalPages).map((page, index) =>
                      page === "ellipsis" ? (
                        <PaginationItem key={`ellipsis-${index}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={page}>
                          <PaginationLink
                            href="#"
                            isActive={page === catalog.page}
                            onClick={(event) => {
                              event.preventDefault();
                              catalog.setPage(page);
                            }}>
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    )}
                    <PaginationItem>
                      <PaginationLink
                        href="#"
                        aria-label={t("pageNext")}
                        size="icon"
                        className={cn(
                          catalog.page >= totalPages && "pointer-events-none opacity-50"
                        )}
                        onClick={(event) => {
                          event.preventDefault();
                          catalog.setPage(Math.min(totalPages, catalog.page + 1));
                        }}>
                        <ChevronRightIcon className="size-4" />
                      </PaginationLink>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            );
          })()
        : null}
    </div>
  );
}
