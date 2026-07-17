"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  adminReanalyzeDataset,
  deleteDataset,
  listDatasets,
  type DatasetCard,
  type DatasetPage
} from "@/lib/api/generated";

export default function AdminDatasetsPage() {
  const t = useTranslations("admin.datasets");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<DatasetPage | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DatasetCard | null>(null);

  const load = useCallback(async () => {
    const { data: result } = await listDatasets({
      query: { q: search.trim() || undefined, page, page_size: 20, sort_by: "created" },
      throwOnError: false
    });
    if (result) setData(result);
  }, [search, page]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  const reanalyze = async (dataset: DatasetCard) => {
    setBusyId(dataset.id);
    const { data: result, error } = await adminReanalyzeDataset({
      path: { dataset_id: dataset.id },
      throwOnError: false
    });
    setBusyId(null);
    if (error || !result) {
      toast.error(t("error"));
      return;
    }
    toast.success(
      t("reanalyzed", { score: (result as { quality_score: number }).quality_score })
    );
  };

  const remove = async (dataset: DatasetCard) => {
    const { response } = await deleteDataset({
      path: { dataset_id: dataset.id },
      throwOnError: false
    });
    if (!response?.ok) {
      toast.error(t("error"));
      return;
    }
    toast.success(t("deleted"));
    void load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </div>

      <Input
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        placeholder={t("search")}
        className="max-w-sm"
      />

      {data === null ? (
        <Skeleton className="h-64 w-full" />
      ) : data.items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground text-sm">{t("empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.name")}</TableHead>
                  <TableHead>{t("table.domain")}</TableHead>
                  <TableHead>{t("table.origin")}</TableHead>
                  <TableHead className="text-right">{t("table.size")}</TableHead>
                  <TableHead className="text-right">{t("table.ethical")}</TableHead>
                  <TableHead className="text-right">{t("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((dataset) => (
                  <TableRow key={dataset.id}>
                    <TableCell>
                      <div className="font-medium">{dataset.display_name}</div>
                      <div className="text-muted-foreground font-mono text-xs">
                        {dataset.dataset_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {(dataset.domain ?? []).join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={dataset.created_by ? "secondary" : "outline"}>
                        {dataset.created_by ? t("userOrigin") : t("system")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {dataset.instances_number ?? "—"} × {dataset.features_number ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {dataset.ethical_score !== null && dataset.ethical_score !== undefined
                        ? `${Math.round(dataset.ethical_score * 100)}%`
                        : "—"}
                    </TableCell>
                    <TableCell className="space-x-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/datasets/${dataset.id}`}>{t("open")}</Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === dataset.id}
                        onClick={() => void reanalyze(dataset)}>
                        {t("reanalyze")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteTarget(dataset)}>
                        {t("delete")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {data && data.total_pages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <span className="text-muted-foreground text-sm">
            {t("pagination", { page: data.page, total: data.total_pages })}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}>
            {t("previous")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= data.total_pages}
            onClick={() => setPage((current) => current + 1)}>
            {t("next")}
          </Button>
        </div>
      ) : null}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteBody", { name: deleteTarget?.display_name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) void remove(deleteTarget);
                setDeleteTarget(null);
              }}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
