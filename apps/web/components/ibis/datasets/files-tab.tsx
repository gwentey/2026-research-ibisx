"use client";

import { useTranslations } from "next-intl";
import { DownloadIcon, FileIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { downloadDatasetFile } from "@/lib/api/generated";
import type { DatasetDetail } from "@/lib/api/generated";
import { formatCount } from "@/lib/datasets/constants";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function FilesTab({ dataset }: { dataset: DatasetDetail }) {
  const t = useTranslations("datasets.detail");

  const download = async (fileId: string, filename: string) => {
    // Téléchargement authentifié via le client généré (jamais d'URL de fichier publique)
    const { data } = await downloadDatasetFile({
      path: { dataset_id: dataset.id, file_id: fileId },
      parseAs: "blob",
      throwOnError: false
    });
    if (!(data instanceof Blob)) return;
    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${filename.replace(/\.[^.]+$/, "")}.parquet`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {dataset.files.map((file) => (
        <Card key={file.id}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <div className="bg-primary/10 rounded-lg p-1.5">
                <FileIcon className="text-primary size-4" />
              </div>
              {file.original_filename}
              <Badge variant="secondary">{t(`role.${file.logical_role}` as never)}</Badge>
              <Badge variant="outline">parquet</Badge>
              <span className="text-muted-foreground text-xs font-normal">
                {formatBytes(file.size_bytes)} · {formatCount(file.row_count)}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => void download(file.id, file.original_filename)}>
                <DownloadIcon />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{t("colName")}</TableHead>
                  <TableHead>{t("colType")}</TableHead>
                  <TableHead>{t("colPII")}</TableHead>
                  <TableHead className="text-right">{t("colNulls")}</TableHead>
                  <TableHead>{t("colExamples")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {file.columns.map((column) => (
                  <TableRow key={column.id}>
                    <TableCell className="text-muted-foreground">{column.position}</TableCell>
                    <TableCell className="font-medium">{column.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{column.dtype_interpreted}</Badge>
                    </TableCell>
                    <TableCell>
                      {column.is_pii ? <Badge variant="destructive">PII</Badge> : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {(column.stats as { null_percentage?: number }).null_percentage ?? 0}%
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-64 truncate text-xs">
                      {column.example_values.slice(0, 3).join(" · ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
