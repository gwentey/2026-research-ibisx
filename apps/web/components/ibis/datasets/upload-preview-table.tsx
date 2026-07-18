"use client";

import { useTranslations } from "next-intl";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import type { UploadFileAnalysis } from "@/lib/api/generated";

// Aperçu tabulaire réel de l'étape 2 (docs/refonte/07) — calqué sur preview-tab.tsx,
// mais alimenté par UploadFileAnalysis.preview_rows (analyse pré-upload, sans persistance).

const MAX_ROWS = 5;

type UploadColumn = { name: string; dtype_interpreted: string };

export function UploadPreviewTable({ file }: { file: UploadFileAnalysis }) {
  const t = useTranslations("datasets.uploadWizard");
  const columns = file.columns as UploadColumn[];
  const rows = file.preview_rows.slice(0, MAX_ROWS);

  if (rows.length === 0 || columns.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">
        {t("previewRowsCaption", { count: rows.length, total: file.row_count })}
      </p>
      <Card className="py-0">
        <CardContent className="max-h-72 overflow-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.name} className="min-w-28">
                    <p className="font-medium">{column.name}</p>
                    <p className="text-muted-foreground text-[10px] font-normal">
                      {column.dtype_interpreted}
                    </p>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  {columns.map((column) => {
                    const cell = (row as Record<string, unknown>)[column.name];
                    return (
                      <TableCell key={column.name} className="max-w-48 truncate text-xs">
                        {cell === null || cell === undefined ? "—" : String(cell)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
