"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileUpIcon, UploadCloudIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MetadataForm, type MetadataFormValue } from "@/components/ibis/datasets/metadata-form";
import { analyzeUpload, createDataset } from "@/lib/api/generated";
import type { UploadAnalysis } from "@/lib/api/generated";

const STEPS = 3;

export default function UploadDatasetPage() {
  const t = useTranslations("datasets.uploadWizard");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("step1")} → {t("step2")} → {t("step3")}
        </p>
      </div>
      <Progress value={(step / STEPS) * 100} />

      {step === 1 ? (
        <Card>
          <CardContent className="pt-6">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setFiles(Array.from(e.dataTransfer.files));
              }}
              className="hover:bg-muted flex w-full flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
              <UploadCloudIcon className="text-muted-foreground size-8" />
              <p className="font-medium">{t("dropTitle")}</p>
              <p className="text-muted-foreground text-xs">{t("dropHint")}</p>
              <span className="text-sm underline">{t("browse")}</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".csv,.xlsx,.json,.parquet"
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 ? (
              <div className="mt-4 space-y-2">
                {files.map((file) => (
                  <div key={file.name} className="flex items-center gap-2 text-sm">
                    <FileUpIcon className="size-4" />
                    {file.name}
                    <span className="text-muted-foreground text-xs">
                      {(file.size / 1024).toFixed(0)} Ko
                    </span>
                  </div>
                ))}
                <Button onClick={() => void runAnalysis()} disabled={pending}>
                  {pending ? t("analyzing") : t("analyze")}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {step === 2 && analysis ? (
        <div className="space-y-4">
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
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {file.columns.map((column) => {
                    const c = column as {
                      name: string;
                      dtype_interpreted: string;
                      is_pii: boolean;
                    };
                    return (
                      <Badge key={c.name} variant={c.is_pii ? "destructive" : "outline"}>
                        {c.name} · {c.dtype_interpreted}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <p className="text-sm font-medium">{t("suggestedIndicative")}</p>
                <p className="text-2xl font-semibold">{analysis.indicative_quality_score}/100</p>
                <p className="text-muted-foreground text-xs">{t("suggestions")}</p>
              </div>
              <Button onClick={() => setStep(3)}>{t("step3")} →</Button>
            </CardContent>
          </Card>
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
