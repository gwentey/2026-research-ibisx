"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  IdCardIcon,
  InfoIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  XIcon,
  type LucideIcon
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { DatasetMetadataUpdate } from "@/lib/api/generated";
import { ETHICAL_KEYS, KNOWN_DOMAINS, KNOWN_TASKS } from "@/lib/datasets/constants";
import { cn } from "@/lib/utils";

// Mapping tonal partagé des 3 sections (repris par /datasets/[id]/complete pour la
// nav d'ancrage — mêmes icônes/nuances que les tuiles ci-dessous, cf. docs/refonte/07).
export const METADATA_SECTIONS: Record<
  "general" | "technical" | "ethical",
  { icon: LucideIcon; tile: string }
> = {
  general: { icon: IdCardIcon, tile: "bg-chart-3/10 text-chart-3" },
  technical: { icon: SlidersHorizontalIcon, tile: "bg-chart-4/10 text-chart-4" },
  ethical: {
    icon: ShieldCheckIcon,
    tile: "bg-chart-5/15 text-foreground border border-chart-5/40"
  }
};

function SectionHeader({
  section,
  title
}: {
  section: keyof typeof METADATA_SECTIONS;
  title: string;
}) {
  const { icon: Icon, tile } = METADATA_SECTIONS[section];
  return (
    <CardHeader>
      <div className="flex items-center gap-3">
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tile)}>
          <Icon className="size-5" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
      </div>
    </CardHeader>
  );
}

export type MetadataFormValue = DatasetMetadataUpdate;

interface MetadataFormProps {
  value: MetadataFormValue;
  onChange: (value: MetadataFormValue) => void;
}

function TagPicker({
  label,
  values,
  suggestions,
  placeholder,
  onChange
}: {
  label: string;
  values: string[];
  suggestions: readonly string[];
  placeholder: string;
  onChange: (values: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const add = (tag: string) => {
    const clean = tag.trim().toLowerCase();
    if (clean && !values.includes(clean)) onChange([...values, clean]);
    setInput("");
  };
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1">
        {values.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1">
            {tag}
            <button type="button" onClick={() => onChange(values.filter((v) => v !== tag))}>
              <XIcon className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {suggestions
          .filter((s) => !values.includes(s))
          .map((s) => (
            <button
              key={s}
              type="button"
              className="hover:bg-muted rounded-md border px-2 py-0.5 text-xs"
              onClick={() => add(s)}>
              + {s}
            </button>
          ))}
      </div>
      <Input
        value={input}
        placeholder={placeholder}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(input);
          }
        }}
        className="h-8 max-w-xs"
      />
    </div>
  );
}

function TristateSelect({
  label,
  value,
  onChange
}: {
  label: string;
  value: boolean | null | undefined;
  onChange: (value: boolean | null) => void;
}) {
  const te = useTranslations("datasets.ethics");
  const current = value === true ? "true" : value === false ? "false" : "null";
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border p-2">
      <span className="text-sm">{label}</span>
      <Select
        value={current}
        onValueChange={(v) => onChange(v === "true" ? true : v === "false" ? false : null)}>
        <SelectTrigger size="sm" className="w-36 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="null">{te("unknown")}</SelectItem>
          <SelectItem value="true">{te("present")}</SelectItem>
          <SelectItem value="false">{te("absent")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function MetadataForm({ value, onChange }: MetadataFormProps) {
  const t = useTranslations("datasets.uploadWizard");
  const te = useTranslations("datasets.ethics");
  const tf = useTranslations("datasets.filterPanel");

  const set = <K extends keyof MetadataFormValue>(key: K, val: MetadataFormValue[K]) =>
    onChange({ ...value, [key]: val });

  return (
    <div className="space-y-4">
      <Card id="section-general">
        <SectionHeader section="general" title={t("sectionGeneral")} />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="display_name">{t("fields.displayName")} *</Label>
            <Input
              id="display_name"
              value={value.display_name ?? ""}
              onChange={(e) => set("display_name", e.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="year">{t("fields.year")}</Label>
            <Input
              id="year"
              type="number"
              value={value.year ?? ""}
              onChange={(e) => set("year", e.target.value === "" ? null : Number(e.target.value))}
              className="mt-2"
            />
          </div>
          <div>
            <Label>{t("fields.access")}</Label>
            <Select
              value={value.access ?? "public"}
              onValueChange={(v) => set("access", v as "public" | "private")}>
              <SelectTrigger className="mt-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">{t("fields.accessPublic")}</SelectItem>
                <SelectItem value="private">{t("fields.accessPrivate")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="objective">{t("fields.objective")}</Label>
            <Textarea
              id="objective"
              value={value.objective ?? ""}
              onChange={(e) => set("objective", e.target.value || null)}
              className="mt-2"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="sources">{t("fields.sources")}</Label>
            <Input
              id="sources"
              value={value.sources ?? ""}
              onChange={(e) => set("sources", e.target.value || null)}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="storage_uri">{t("fields.storageUri")}</Label>
            <Input
              id="storage_uri"
              value={value.storage_uri ?? ""}
              onChange={(e) => set("storage_uri", e.target.value || null)}
              className="mt-2"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="documentation_link">{t("fields.documentationLink")}</Label>
            <Input
              id="documentation_link"
              value={value.documentation_link ?? ""}
              onChange={(e) => set("documentation_link", e.target.value || null)}
              className="mt-2"
            />
          </div>
        </CardContent>
      </Card>

      <Card id="section-technical">
        <SectionHeader section="technical" title={t("sectionTechnical")} />
        <CardContent className="space-y-4">
          <TagPicker
            label={t("fields.domains")}
            values={value.domain ?? []}
            suggestions={KNOWN_DOMAINS}
            placeholder={t("addDomain")}
            onChange={(v) => set("domain", v)}
          />
          <TagPicker
            label={t("fields.tasks")}
            values={value.task ?? []}
            suggestions={KNOWN_TASKS}
            placeholder={t("addTask")}
            onChange={(v) => set("task", v)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border p-2">
              <span className="text-sm">{t("fields.split")}</span>
              <Switch
                checked={value.split === true}
                onCheckedChange={(c) => set("split", c ? true : null)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-2">
              <span className="text-sm">{t("fields.temporal")}</span>
              <Switch
                checked={value.temporal_factors === true}
                onCheckedChange={(c) => set("temporal_factors", c ? true : null)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-2">
              <span className="text-sm">{t("fields.metadataProvided")}</span>
              <Switch
                checked={value.metadata_provided_with_dataset === true}
                onCheckedChange={(c) => set("metadata_provided_with_dataset", c ? true : null)}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-2">
              <span className="text-sm">{t("fields.externalDoc")}</span>
              <Switch
                checked={value.external_documentation_available === true}
                onCheckedChange={(c) => set("external_documentation_available", c ? true : null)}
              />
            </div>
            <div>
              <Label>{t("fields.representativity")}</Label>
              <Select
                value={value.representativity_level ?? "none"}
                onValueChange={(v) =>
                  set(
                    "representativity_level",
                    v === "none" ? null : (v as "high" | "medium" | "low")
                  )
                }>
                <SelectTrigger className="mt-2 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{te("unknown")}</SelectItem>
                  <SelectItem value="high">{tf("level.high")}</SelectItem>
                  <SelectItem value="medium">{tf("level.medium")}</SelectItem>
                  <SelectItem value="low">{tf("level.low")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("fields.balance")}</Label>
              <Select
                value={value.sample_balance_level ?? "none"}
                onValueChange={(v) =>
                  set("sample_balance_level", v === "none" ? null : (v as never))
                }>
                <SelectTrigger className="mt-2 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{te("unknown")}</SelectItem>
                  {(["balanced", "moderate", "imbalanced", "severely_imbalanced"] as const).map(
                    (level) => (
                      <SelectItem key={level} value={level}>
                        {t(`balanceLevels.${level}`)}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="section-ethical">
        <SectionHeader section="ethical" title={t("sectionEthicalAdvanced")} />
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <div className="bg-muted/50 flex items-start gap-2 rounded-md p-3 text-sm sm:col-span-2">
            <InfoIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <p className="text-muted-foreground">{t("ethicsHint")}</p>
          </div>
          {ETHICAL_KEYS.map((key) => (
            <TristateSelect
              key={key}
              label={te(key)}
              value={(value as Record<string, boolean | null | undefined>)[key]}
              onChange={(v) => set(key as keyof MetadataFormValue, v as never)}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
