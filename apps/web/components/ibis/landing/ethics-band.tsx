import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  ArrowRightIcon,
  BookOpenIcon,
  EyeIcon,
  GaugeIcon,
  ScaleIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  type LucideIcon
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Bandeau des critères éthiques (docs/refonte/01-landing.md) : reprend la grammaire de
// `dataset-card.tsx` (icône + libellé court, sans pourcentage puisqu'aucun dataset réel
// n'est chargé sur la landing publique). Fond wash chart-2 léger (from-chart-2/5), même
// nuance que le hero — cohérence de page sans dupliquer sa texture (le hero garde le
// masque radial, ici c'est un simple gradient plat en bas de page).
const CRITERIA: { key: string; icon: LucideIcon }[] = [
  { key: "anonymization", icon: ShieldCheckIcon },
  { key: "transparency", icon: EyeIcon },
  { key: "informed_consent", icon: UserCheckIcon },
  { key: "documentation", icon: BookOpenIcon },
  { key: "data_quality", icon: GaugeIcon },
  { key: "sample_balance", icon: ScaleIcon }
];

export async function EthicsBand() {
  const t = await getTranslations("landing");
  const tCriteria = await getTranslations("scoring.criteria");

  return (
    <section className="bg-gradient-to-b from-chart-2/5 to-transparent">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("ethics.title")}</h2>
          <p className="text-muted-foreground mt-3 text-sm sm:text-base">{t("ethics.subtitle")}</p>
        </div>

        <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-2">
          {CRITERIA.map(({ key, icon: Icon }) => (
            <Badge key={key} variant="outline" className="gap-1.5 py-1.5 text-sm font-normal">
              <Icon className="size-3.5" />
              {tCriteria(key as never)}
            </Badge>
          ))}
        </div>

        <div className="mx-auto mt-8 max-w-xl text-center">
          <p className="text-muted-foreground text-sm">{t("phase1Body")}</p>
          <Button className="mt-5" asChild>
            <Link href="/register">
              {t("cta")}
              <ArrowRightIcon />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
