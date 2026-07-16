"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { listDatasets } from "@/lib/api/generated";
import type { DatasetPage, ListDatasetsData } from "@/lib/api/generated";

export type CatalogQuery = NonNullable<ListDatasetsData["query"]>;
export type CatalogFilters = Omit<CatalogQuery, "sort_by" | "sort_order" | "page" | "page_size">;

const EMPTY_FILTERS: CatalogFilters = {};

/** Clés de filtres actives (pour le badge + les chips supprimables). */
export function activeFilterEntries(filters: CatalogFilters): [string, unknown][] {
  return Object.entries(filters).filter(
    ([key, value]) =>
      key !== "q" &&
      value !== undefined &&
      value !== null &&
      (!Array.isArray(value) || value.length > 0)
  );
}

export function useCatalog() {
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<NonNullable<CatalogQuery["sort_by"]>>("name");
  const [sortOrder, setSortOrder] = useState<NonNullable<CatalogQuery["sort_order"]>>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [data, setData] = useState<DatasetPage | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const debouncedSearch = useDebounced(search, 300);
  const requestId = useRef(0);

  const query: CatalogQuery = useMemo(
    () => ({
      ...filters,
      q: debouncedSearch || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
      page,
      page_size: pageSize as 12 | 24 | 48 | 96
    }),
    [filters, debouncedSearch, sortBy, sortOrder, page, pageSize]
  );

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setState("loading");
    const { data: result } = await listDatasets({ query, throwOnError: false });
    if (id !== requestId.current) return; // réponse obsolète
    if (!result) {
      setState("error");
      return;
    }
    setData(result);
    setState("ready");
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = (next: CatalogFilters) => {
    setFilters(next);
    setPage(1);
  };

  const removeFilter = (key: string) => {
    setFilters((current) => {
      const next = { ...current };
      delete next[key as keyof CatalogFilters];
      return next;
    });
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearch("");
    setPage(1);
  };

  return {
    data,
    state,
    reload: load,
    filters,
    applyFilters,
    removeFilter,
    clearFilters,
    search,
    setSearch: (value: string) => {
      setSearch(value);
      setPage(1);
    },
    sortBy,
    sortOrder,
    setSort: (by: typeof sortBy, order: typeof sortOrder) => {
      setSortBy(by);
      setSortOrder(order);
      setPage(1);
    },
    page,
    setPage,
    pageSize,
    setPageSize: (size: number) => {
      setPageSize(size);
      setPage(1);
    }
  };
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
