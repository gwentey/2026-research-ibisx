"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileStackIcon, GaugeIcon, Rows3Icon, UploadCloudIcon, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CountAnimation from "@/components/ui/custom/count-animation";
import { MetadataForm, type MetadataFormValue } from "@/components/ibis/datasets/metadata-form";
import { UploadDropzone } from "@/components/ibis/datasets/upload-dropzone";
import { UploadPreviewTable } from "@/components/ibis/datasets/upload-preview-table";
import { UploadStepper } from "@/components/ibis/datasets/upload-stepper";
import { analyzeUpload, createDataset } from "@/lib/api/generated";
import type { UploadAnalysis } from "@/lib/api/generated";

// Tuile-icône de résumé (étape 2) — motif "hospital-management/summary-cards" repris en
// monochrome chart-2 (docs/refonte/07). Aucune donnée inventée : uniquement les 3 chiffres
// réels de l'analyse (nb fichiers, total lignes, score indicatif).
function SummaryChip({
  icon: Icon,
  label,
  value,
  suffix
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <Card className="py-0">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="bg-chart-2/10 text-chart-2 flex size-10 shrink-0 items-center justify-center rounded-full">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground truncate text-xs">{label}</p>
          <p className="text-lg font-semibold tabular-nums">
            <CountAnimation number={value} />
            {suffix}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function UploadDatasetPage() {
  const t = useTranslations("datasets.uploadWizard");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [analysis, setAnalysis] = useState<UploadAnalysis | null>(null);
  const [pending, setPending] = useState(false);
  const [metadata, setMetadata] = useState<MetadataFormValue>({
    display_name: "",
    domain: [],
    task: []
  });

  const runAnalysis = async () => {
    if (files.length === 0) return;
    setPending(true);
    const { data, error } = await analyzeUpload({
      body: { files },
      throwOnError: false
    });
    setPending(false);
    if (!data) {
      const code = (error as { detail?: { code?: string } } | undefined)?.detail?.code;
      toast.error(code && tErrors.has(code) ? tErrors(code) : tErrors("UNKNOWN_ERROR"));
      return;
    }
    setAnalysis(data);
    setMetadata((current) => ({
      ...current,
      display_name: current.display_name || data.suggested_name,
      domain: current.domain?.length ? current.domain : data.suggested_domains,
      task: current.task?.length ? current.task : data.suggested_tasks
    }));
    setStep(2);
  };

  const submit = async () => {
    setPending(true);
    const { data, error } = await createDataset({
      body: { files, metadata: JSON.stringify(metadata) },
      throwOnError: false
    });
    setPending(false);
    if (!data) {
      const detail = (error as { detail?: { code?: string; message?: string } } | undefined)
        ?.detail;
      toast.error(detail?.message ?? tErrors("UNKNOWN_ERROR"));
      return;
    }
    toast.success(t("created"));
    router.replace(`/datasets/${data.id}`);
  };

  const totalRows = analysis?.files.reduce((sum, file) => sum + file.row_count, 0) ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-4">
        <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
          <UploadCloudIcon className="size-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{t("subtitle")}</p>
        </div>
      </div>

      <UploadStepper step={step} onStepClick={setStep} />

      {step === 1 ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <UploadDropzone onFilesChange={setFiles} disabled={pending} />
            {files.length > 0 ? (
              <Button
                onClick={() => void runAnalysis()}
                disabled={pending}
                className="w-full sm:w-auto">
                {pending ? t("analyzing") : t("analyze")}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {step === 2 && analysis ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryChip
              icon={FileStackIcon}
              label={t("summaryFiles")}
              value={analysis.files.length}
            />
            <SummaryChip icon={Rows3Icon} label={t("summaryRows")} value={totalRows} />
            <SummaryChip
              icon={GaugeIcon}
              label={t("summaryScore")}
              value={analysis.indicative_quality_score}
              suffix="/100"
            />
          </div>
          <p className="text-muted-foreground text-xs">{t("suggestions")}</p>

          {analysis.files.map((file) => (
            <Card key={file.original_filename}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {file.original_filename}
                  <span className="text-muted-foreground text-xs font-normal">
                    {file.row_count} {t("rows")} · {file.column_count} {t("cols")} ·{" "}
                    {file.missing_percentage}% {t("missingPct")}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-1">
                  {(
                    file.columns as Array<{
                      name: string;
                      dtype_interpreted: string;
                      is_pii: boolean;
                    }>
                  ).map((column) => (
                    <Badge key={column.name} variant={column.is_pii ? "destructive" : "outline"}>
                      {column.name} · {column.dtype_interpreted}
                    </Badge>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">{t("previewTitle")}</p>
                  <UploadPreviewTable file={file} />
                </div>
              </CardContent>
            </Card>
          ))}

          <Button onClick={() => setStep(3)} className="w-full sm:w-auto">
            {t("step3")} →
          </Button>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <MetadataForm value={metadata} onChange={setMetadata} />
          <Button
            onClick={() => void submit()}
            disabled={pending || !metadata.display_name}
            className="w-full">
            {pending ? t("creating") : t("create")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
