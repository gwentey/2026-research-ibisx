"use client";

import { useTranslations } from "next-intl";
import { CircleSlashIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LENS_LIST } from "@/lib/lenses/catalog";
import { useLensStore } from "@/lib/lenses/store";
import type { LensId } from "@/lib/lenses/types";

const NONE = "none";

/** « Ma discipline » — regard appliqué par défaut aux résultats (persisté en localStorage). */
export function DisciplineSelector() {
  const t = useTranslations("lenses");
  const discipline = useLensStore((state) => state.discipline);
  const setDiscipline = useLensStore((state) => state.setDiscipline);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("profile.title")}</CardTitle>
        <CardDescription>{t("profile.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ToggleGroup
          type="single"
          variant="outline"
          value={discipline ?? NONE}
          onValueChange={(next) =>
            setDiscipline(next === NONE || next === "" ? null : (next as LensId))
          }
          className="flex-wrap">
          <ToggleGroupItem value={NONE} className="gap-1.5">
            <CircleSlashIcon className="size-4" />
            {t("profile.none")}
          </ToggleGroupItem>
          {LENS_LIST.map(({ id, icon: Icon }) => (
            <ToggleGroupItem key={id} value={id} className="gap-1.5">
              <Icon className="size-4" />
              {t(`${id}.short` as never)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardContent>
    </Card>
  );
}
