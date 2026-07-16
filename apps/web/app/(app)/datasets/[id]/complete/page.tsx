"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { MetadataForm, type MetadataFormValue } from "@/components/ibis/datasets/metadata-form";
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

  if (!metadata || !completion) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/datasets/${id}`}>{t("backToDataset")}</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            {t("overall")}
            <span>{completion.overall_percentage}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={completion.overall_percentage} />
          <div className="grid gap-3 sm:grid-cols-3">
            {completion.sections.map((section) => (
              <div key={section.name} className="rounded-md border p-3">
                <p className="text-sm font-medium">
                  {t(`section.${section.name}`)} · {section.filled}/{section.total}
                </p>
                {section.missing_fields.length > 0 ? (
                  <p className="text-muted-foreground mt-1 line-clamp-3 text-xs">
                    {t("missingFields")} : {section.missing_fields.join(", ")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          {completion.needs_human_review.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{t("humanReview")} :</span>
              {completion.needs_human_review.map((field) => (
                <Badge key={field} variant="secondary">
                  {te(field as never)}
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <MetadataForm value={metadata} onChange={setMetadata} />
      <Button className="w-full" onClick={() => void save()} disabled={saving}>
        {saving ? tCommon("loading") : tCommon("save")}
      </Button>
    </div>
  );
}
