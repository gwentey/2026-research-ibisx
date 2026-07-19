"use client";

import { useTranslations } from "next-intl";
import { LayersIcon } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LENS_LIST } from "@/lib/lenses/catalog";
import type { LensId } from "@/lib/lenses/types";

const CLASSIC = "classic";

/**
 * Bascule « Résultat classique ⇄ à travers les yeux de {discipline} ».
 * Contrôlée : le parent (page résultats) détient le regard actif.
 */
export function LensSwitcher({
  value,
  onChange
}: {
  value: LensId | null;
  onChange: (value: LensId | null) => void;
}) {
  const t = useTranslations("lenses");

  return (
    <div className="space-y-2">
      <ToggleGroup
        type="single"
        variant="outline"
        value={value ?? CLASSIC}
        onValueChange={(next) => onChange(next === CLASSIC || next === "" ? null : (next as LensId))}
        className="flex-wrap"
        aria-label={t("switcher.label")}>
        <ToggleGroupItem value={CLASSIC} className="gap-1.5">
          <LayersIcon className="size-4" />
          {t("switcher.classic")}
        </ToggleGroupItem>
        {LENS_LIST.map(({ id, icon: Icon }) => (
          <ToggleGroupItem key={id} value={id} className="gap-1.5">
            <Icon className="size-4" />
            {t(`${id}.short` as never)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-muted-foreground text-xs">{t("switcher.learn")}</p>
    </div>
  );
}
