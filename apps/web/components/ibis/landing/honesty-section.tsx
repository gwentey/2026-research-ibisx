import { getTranslations } from "next-intl/server";
import { ActivityIcon, RepeatIcon, ShieldAlertIcon, type LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// 3 cards « honnêteté » (docs/refonte/01-landing.md) : pattern « ligne dans une carte »
// inspiré de learning-path-card.tsx du template (icône dans CardHeader, corps court),
// sans couleur inventée (indicatorColor du template écarté) — icônes en nuance neutre.
// Grille 3 colonnes reprise de default/page.tsx (gap-4 space-y-4 lg:grid lg:grid-cols-3).
const CARDS: { key: "fallback" | "reproducibility" | "kpis"; icon: LucideIcon }[] = [
  { key: "fallback", icon: ShieldAlertIcon },
  { key: "reproducibility", icon: RepeatIcon },
  { key: "kpis", icon: ActivityIcon }
];

export async function HonestySection() {
  const t = await getTranslations("landing.honesty");

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">{t("title")}</h2>

      <div className="mt-8 space-y-4 lg:grid lg:grid-cols-3 lg:space-y-0 lg:gap-4">
        {CARDS.map(({ key, icon: Icon }) => (
          <Card key={key}>
            <CardHeader>
              <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg">
                <Icon className="size-5" />
              </div>
              <CardTitle className="mt-3 text-base">{t(`${key}.title` as never)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">{t(`${key}.body` as never)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
