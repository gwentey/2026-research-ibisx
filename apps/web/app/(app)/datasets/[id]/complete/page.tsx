"use client";

import { use, useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ClipboardCheckIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import CountAnimation from "@/components/ui/custom/count-animation";
import { MetadataForm, METADATA_SECTIONS, type MetadataFormValue } from "@/components/ibis/datasets/metadata-form";
import { ProgressRing } from "@/components/ibis/progress-ring";
import { getDataset, getDatasetCompletion, updateDataset } from "@/lib/api/generated";
import type { CompletionStatus } from "@/lib/api/generated";
import { ETHICAL_KEYS } from "@/lib/datasets/constants";

export default function CompleteMetadataPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("datasets.completion");
  const te = useTranslations("datasets.ethics");
  const tCommon = useTranslations("common");
  const [completion, setCompletion] = useState<CompletionStatus | null>(null);
  const [metadata, setMetadata] = useState<MetadataFormValue | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [detail, status] = await Promise.all([
      getDataset({ path: { dataset_id: id }, throwOnError: false }),
      getDatasetCompletion({ path: { dataset_id: id }, throwOnError: false })
    ]);
    setCompletion(status.data ?? null);
    if (detail.data) {
      const d = detail.data;
      setMetadata({
        display_name: d.display_name,
        year: d.year,
        objective: d.objective,
        sources: d.sources,
        storage_uri: d.storage_uri,
        documentation_link: d.documentation_link,
        citation_link: d.citation_link,
        num_citations: d.num_citations,
        access: d.access as "public" | "private",
        availability: d.availability,
        metadata_provided_with_dataset: d.metadata_provided_with_dataset,
        external_documentation_available: d.external_documentation_available,
        features_description: d.features_description,
        domain: d.domain,
        task: d.task,
        split: d.split,
        temporal_factors: d.temporal_factors,
        missing_values_description: d.missing_values_description,
        missing_values_handling_method: d.missing_values_handling_method,
        representativity_level: d.representativity_level as never,
        representativity_description: d.representativity_description,
        sample_balance_level: d.sample_balance_level as never,
        sample_balance_description: d.sample_balance_description,
        ...Object.fromEntries(
          ETHICAL_KEYS.map((key) => [
            key,
            (d.ethical_criteria as Record<string, boolean | null>)[key]
          ])
        )
      });
    }
  };

  useEffect(() => {
    void load();

  }, [id]);

  const save = async () => {
    if (!metadata) return;
    setSaving(true);
    const { data } = await updateDataset({
      path: { dataset_id: id },
      body: metadata,
      throwOnError: false
    });
    setSaving(false);
    if (!data) {
      toast.error(tCommon("error"));
      return;
    }
    toast.success(tCommon("saved"));
    void load();
  };

  const jumpTo = (name: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    document.getElementById(`section-${name}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!metadata || !completion) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
            <ClipboardCheckIcon className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">{t("subtitle")}</p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/datasets/${id}`}>{t("backToDataset")}</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-6 pt-6 sm:flex-row sm:items-center">
          <div
            className="relative mx-auto size-[72px] shrink-0 sm:mx-0"
            role="img"
            aria-label={`${t("overall")} ${completion.overall_percentage}%`}>
            <ProgressRing value={completion.overall_percentage} size={72} strokeWidth={6} />
            <div className="absolute inset-0 grid place-items-center">
              <span className="text-sm font-semibold tabular-nums">
                <CountAnimation number={completion.overall_percentage} />%
              </span>
            </div>
          </div>
          <nav aria-label={t("jumpTo")} className="min-w-0 flex-1 space-y-1.5">
            {completion.sections.map((section) => {
              const { icon: Icon, tile } = METADATA_SECTIONS[section.name];
              return (
                <a
                  key={section.name}
                  href={`#section-${section.name}`}
                  onClick={jumpTo(section.name)}
                  className="hover:bg-muted flex items-start gap-3 rounded-md px-2.5 py-2 text-sm transition-colors">
                  <span
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${tile}`}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">
                        {t(`section.${section.name}`)}
                      </span>
                      <Badge variant="outline" className="shrink-0">
                        {section.filled}/{section.total}
                      </Badge>
                    </span>
                    {section.missing_fields.length > 0 ? (
                      <span className="text-muted-foreground mt-0.5 line-clamp-1 block text-xs">
                        {t("missingFields")} : {section.missing_fields.join(", ")}
                      </span>
                    ) : null}
                  </span>
                </a>
              );
            })}
          </nav>
        </CardContent>
      </Card>

      {completion.needs_human_review.length > 0 ? (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>{t("humanReview")}</AlertTitle>
          <AlertDescription>
            <div className="flex flex-wrap gap-1.5">
              {completion.needs_human_review.map((field) => (
                <Badge key={field} variant="secondary">
                  {te(field as never)}
                </Badge>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <MetadataForm value={metadata} onChange={setMetadata} />
      <Button className="w-full" onClick={() => void save()} disabled={saving}>
        {saving ? tCommon("loading") : tCommon("save")}
      </Button>
    </div>
  );
}
