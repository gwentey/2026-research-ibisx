"use client";

import { useTranslations } from "next-intl";
import { InfoIcon, TriangleAlertIcon, Undo2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { compareAudience } from "@/lib/audience/policy";
import type { XaiAudience } from "@/lib/api/generated";
import { cn } from "@/lib/utils";

/**
 * Garde-fou affiché quand le niveau effectif ≠ niveau du profil.
 *  - AU-DESSUS de son niveau → alerte sérieuse (ton destructive, subtil) + retour.
 *  - EN-DESSOUS → note informative légère + retour.
 */
export function AudienceWarning({
  effective,
  profile,
  onReset
}: {
  effective: XaiAudience;
  profile: XaiAudience;
  onReset: () => void;
}) {
  const t = useTranslations("audience");
  const comparison = compareAudience(effective, profile);
  if (comparison === "same") return null;
  const above = comparison === "above";

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between",
        above ? "border-destructive/40 bg-destructive/[0.05]" : "bg-muted/40"
      )}>
      <div className="flex items-start gap-2.5">
        {above ? (
          <TriangleAlertIcon className="text-destructive mt-0.5 size-4 shrink-0" />
        ) : (
          <InfoIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        )}
        <p className="text-sm">
          {above
            ? t("warnAbove", {
                profile: t(`short.${profile}`),
                effective: t(`short.${effective}`)
              })
            : t("belowNote", { effective: t(`short.${effective}`) })}
        </p>
      </div>
      <Button
        size="sm"
        variant={above ? "default" : "outline"}
        onClick={onReset}
        className="shrink-0">
        <Undo2Icon />
        {t("backToMine", { level: t(`short.${profile}`) })}
      </Button>
    </div>
  );
}
