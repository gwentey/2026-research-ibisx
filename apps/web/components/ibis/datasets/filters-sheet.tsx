"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { FilterIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { listDatasets } from "@/lib/api/generated";
import type { DatasetFacets } from "@/lib/api/generated";
import { ETHICAL_KEYS } from "@/lib/datasets/constants";
import type { CatalogFilters } from "@/lib/datasets/use-catalog";
import { cn } from "@/lib/utils";

interface FiltersSheetProps {
  facets: DatasetFacets | null;
  value: CatalogFilters;
  activeCount: number;
  onApply: (filters: CatalogFilters) => void;
}

function RangeInputs({
  label,
  min,
  max,
  onMin,
  onMax,
  minLabel,
  maxLabel
}: {
  label: string;
  min: number | null | undefined;
  max: number | null | undefined;
  onMin: (v: number | undefined) => void;
  onMax: (v: number | undefined) => void;
  minLabel: string;
  maxLabel: string;
}) {
  const parse = (raw: string) => (raw === "" ? undefined : Number(raw));
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          placeholder={minLabel}
          value={min ?? ""}
          onChange={(e) => onMin(parse(e.target.value))}
          className="h-8"
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="number"
          placeholder={maxLabel}
          value={max ?? ""}
          onChange={(e) => onMax(parse(e.target.value))}
          className="h-8"
        />
      </div>
    </div>
  );
}

export function FiltersSheet({ facets, value, activeCount, onApply }: FiltersSheetProps) {
  const t = useTranslations("datasets");
  const tf = useTranslations("datasets.filterPanel");
  const te = useTranslations("datasets.ethics");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CatalogFilters>(value);
  const [liveCount, setLiveCount] = useState<number | null>(null);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  // Compteur de résultats en temps réel (CDC §5.3) — page_size minimal
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      const { data } = await listDatasets({
        query: { ...draft, page: 1, page_size: 12 },
        throwOnError: false
      });
      setLiveCount(data?.total ?? null);
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, open]);

  const set = <K extends keyof CatalogFilters>(key: K, val: CatalogFilters[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  const toggleInList = (key: "domains" | "tasks", item: string) => {
    const current = draft[key] ?? [];
    const next = current.includes(item)
      ? current.filter((v) => v !== item)
      : [...current, item];
    set(key, next.length ? next : undefined);
  };

  const missingValue =
    draft.has_missing_values === true ? "with" : draft.has_missing_values === false ? "without" : "any";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <FilterIcon />
          {t("filters")}
          {activeCount > 0 ? <Badge className="ml-1">{activeCount}</Badge> : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("filters")}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-6 px-4 pb-4">
          <div className="space-y-2">
            <Label className="text-sm">{tf("domains")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {(facets?.domains ?? []).map((facet) => (
                <button
                  key={facet.value}
                  type="button"
                  onClick={() => toggleInList("domains", facet.value)}
                  className={cn(
                    "hover:bg-muted flex items-center justify-between rounded-md border p-2 text-left text-sm",
                    draft.domains?.includes(facet.value) && "border-primary bg-muted"
                  )}>
                  <span className="truncate">{facet.value}</span>
                  <span className="text-muted-foreground text-xs">{facet.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">{tf("tasks")}</Label>
            <div className="flex flex-wrap gap-2">
              {(facets?.tasks ?? []).map((facet) => (
                <button
                  key={facet.value}
                  type="button"
                  onClick={() => toggleInList("tasks", facet.value)}
                  className={cn(
                    "hover:bg-muted rounded-md border px-2 py-1 text-sm",
                    draft.tasks?.includes(facet.value) && "border-primary bg-muted"
                  )}>
                  {facet.value} <span className="text-muted-foreground text-xs">{facet.count}</span>
                </button>
              ))}
            </div>
          </div>

          <RangeInputs
            label={tf("instances")}
            min={draft.instances_min}
            max={draft.instances_max}
            onMin={(v) => set("instances_min", v)}
            onMax={(v) => set("instances_max", v)}
            minLabel={tf("min")}
            maxLabel={tf("max")}
          />
          <RangeInputs
            label={tf("features")}
            min={draft.features_min}
            max={draft.features_max}
            onMin={(v) => set("features_min", v)}
            onMax={(v) => set("features_max", v)}
            minLabel={tf("min")}
            maxLabel={tf("max")}
          />
          <RangeInputs
            label={tf("year")}
            min={draft.year_min}
            max={draft.year_max}
            onMin={(v) => set("year_min", v)}
            onMax={(v) => set("year_max", v)}
            minLabel={tf("min")}
            maxLabel={tf("max")}
          />
          <RangeInputs
            label={tf("citations")}
            min={draft.citations_min}
            max={draft.citations_max}
            onMin={(v) => set("citations_min", v)}
            onMax={(v) => set("citations_max", v)}
            minLabel={tf("min")}
            maxLabel={tf("max")}
          />

          <div className="space-y-2">
            <Label className="text-sm">
              {tf("ethicalScoreMin")} : {draft.ethical_score_min ?? 0}%
            </Label>
            <Slider
              value={[draft.ethical_score_min ?? 0]}
              min={0}
              max={100}
              step={10}
              onValueChange={([v]) => set("ethical_score_min", v > 0 ? v : undefined)}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm">{tf("quality")}</Label>
            {(
              [
                ["split", tf("split")],
                ["anonymized", tf("anonymized")],
                ["temporal", tf("temporal")],
                ["public", tf("public")]
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <Switch
                  checked={draft[key] === true}
                  onCheckedChange={(checked) => set(key, checked ? true : undefined)}
                />
              </div>
            ))}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm">{tf("representativity")}</span>
              <Select
                value={draft.representativity_level ?? "any"}
                onValueChange={(v) =>
                  set(
                    "representativity_level",
                    v === "any" ? undefined : (v as "high" | "medium" | "low")
                  )
                }>
                <SelectTrigger size="sm" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{tf("missingAny")}</SelectItem>
                  <SelectItem value="high">{tf("level.high")}</SelectItem>
                  <SelectItem value="medium">{tf("level.medium")}</SelectItem>
                  <SelectItem value="low">{tf("level.low")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm">{tf("missingValues")}</span>
              <Select
                value={missingValue}
                onValueChange={(v) =>
                  set("has_missing_values", v === "with" ? true : v === "without" ? false : undefined)
                }>
                <SelectTrigger size="sm" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{tf("missingAny")}</SelectItem>
                  <SelectItem value="with">{tf("missingWith")}</SelectItem>
                  <SelectItem value="without">{tf("missingWithout")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">{tf("advancedEthics")}</Label>
            <div className="space-y-2">
              {ETHICAL_KEYS.map((key) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={`ethics-${key}`}
                    checked={draft[key] === true}
                    onCheckedChange={(checked) => set(key, checked ? true : undefined)}
                  />
                  <Label htmlFor={`ethics-${key}`} className="text-sm font-normal">
                    {te(key)}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="bg-background sticky bottom-0 border-t">
          <Button
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}>
            {tf("apply")}
            {liveCount !== null ? ` (${liveCount})` : ""}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
