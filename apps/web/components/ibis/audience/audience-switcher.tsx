"use client";

import { useTranslations } from "next-intl";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AUDIENCE_ORDER } from "@/lib/audience/policy";
import type { XaiAudience } from "@/lib/api/generated";

/**
 * Bascule « Voir en tant que : Novice / Intermédiaire / Expert ». Calquée sur le LensSwitcher.
 * Contrôlée : le parent (page résultats) détient le niveau effectif. Le niveau du PROFIL est
 * marqué « · vous » — par défaut, c'est lui qui est actif.
 */
export function AudienceSwitcher({
  value,
  profile,
  onChange
}: {
  value: XaiAudience;
  profile: XaiAudience | null;
  onChange: (audience: XaiAudience) => void;
}) {
  const t = useTranslations("audience");

  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {t("viewAs")}
      </p>
      <ToggleGroup
        type="single"
        variant="outline"
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next as XaiAudience);
        }}
        className="flex-wrap"
        aria-label={t("viewAs")}>
        {AUDIENCE_ORDER.map((audience) => (
          <ToggleGroupItem key={audience} value={audience} className="gap-1.5">
            {t(`short.${audience}`)}
            {profile === audience ? (
              <span className="text-muted-foreground text-[10px] font-normal">· {t("you")}</span>
            ) : null}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
