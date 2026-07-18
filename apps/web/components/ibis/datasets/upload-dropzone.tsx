"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  FileArchiveIcon,
  FileJsonIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  UploadCloudIcon,
  XIcon,
  type LucideIcon
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle
} from "@/components/ui/item";
import { DomainPattern } from "@/components/ibis/datasets/domain-pattern";
import { formatBytes, useFileUpload } from "@/hooks/use-file-upload";
import { cn } from "@/lib/utils";

// Zone de dépôt à motif pointillé — étape 1 de l'atelier upload (docs/refonte/07).
// Source de vérité des fichiers = useFileUpload (déjà présent) ; on remonte les File
// natifs au parent via onFilesChange pour que submit()/createDataset ne change pas.

const ACCEPT = ".csv,.xlsx,.json,.parquet";
const MAX_SIZE = 100 * 1024 * 1024; // 100 Mo

const EXTENSION_ICONS: Record<string, LucideIcon> = {
  csv: FileSpreadsheetIcon,
  xlsx: FileSpreadsheetIcon,
  json: FileJsonIcon,
  parquet: FileArchiveIcon
};

function fileIconFor(name: string): LucideIcon {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_ICONS[ext] ?? FileTextIcon;
}

export function UploadDropzone({
  onFilesChange,
  disabled
}: {
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("datasets.uploadWizard");
  const [{ files, isDragging, errors }, actions] = useFileUpload({
    multiple: true,
    accept: ACCEPT,
    maxSize: MAX_SIZE
  });

  useEffect(() => {
    // Le hook expose files[].file comme File natif (pas d'initialFiles ici) — mappage direct.
    // Dépendance volontairement limitée à `files` (onFilesChange peut n'être pas mémoïsé).
    onFilesChange(files.map((f) => f.file as File));
  }, [files]);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={actions.openFileDialog}
        onDragEnter={actions.handleDragEnter}
        onDragLeave={actions.handleDragLeave}
        onDragOver={actions.handleDragOver}
        onDrop={actions.handleDrop}
        disabled={disabled}
        data-dragging={isDragging || undefined}
        className="hover:bg-muted/40 data-[dragging=true]:border-chart-1 data-[dragging=true]:bg-chart-1/5 relative flex min-h-52 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed p-10 text-center transition-colors">
        <DomainPattern pattern="dots" className="text-foreground/5" />
        <span className="bg-background text-chart-1 relative z-10 flex size-12 items-center justify-center rounded-full border">
          <UploadCloudIcon className="size-5" />
        </span>
        <span className="relative z-10 space-y-1">
          <span className="block font-medium">{t("dropTitle")}</span>
          <span className="text-muted-foreground block text-xs">{t("dropHint")}</span>
        </span>
        <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "relative z-10")}>
          {t("dropzoneCta")}
        </span>
      </button>
      {/* Hors du <button> : un <input type=file> est du contenu interactif, invalide en
          descendant d'un bouton — déclenché uniquement via actions.openFileDialog(). */}
      <input {...actions.getInputProps()} className="sr-only" tabIndex={-1} />

      {errors.length > 0 ? <p className="text-destructive text-xs">{errors[0]}</p> : null}

      {files.length > 0 ? (
        <ItemGroup className="gap-2">
          {files.map((f) => {
            const Icon = fileIconFor(f.file.name);
            return (
              <Item key={f.id} variant="outline" size="sm">
                <ItemMedia variant="icon">
                  <Icon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="truncate">{f.file.name}</ItemTitle>
                  <ItemDescription>{formatBytes(f.file.size)}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <button
                    type="button"
                    aria-label={t("removeFile")}
                    onClick={() => actions.removeFile(f.id)}
                    className="text-muted-foreground hover:text-foreground rounded-sm p-1">
                    <XIcon className="size-4" />
                  </button>
                </ItemActions>
              </Item>
            );
          })}
        </ItemGroup>
      ) : null}
    </div>
  );
}
