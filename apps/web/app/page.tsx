import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { GraduationCapIcon } from "lucide-react";

import Logo from "@/components/layout/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ibis/language-switcher";
import { EthicsBand } from "@/components/ibis/landing/ethics-band";
import { HeroPreview } from "@/components/ibis/landing/hero-preview";
import { HonestySection } from "@/components/ibis/landing/honesty-section";
import { JourneySection } from "@/components/ibis/landing/journey-section";

// Landing publique (CDC §10 [SHOULD]) — sobre, zéro lien mort, zéro donnée fictive.
// Signature (docs/refonte/01-landing.md + 00-synthese.md) : le hero MONTRE le produit
// (HeroPreview reconstruit le wizard + le graphe d'importance en vrais composants,
// figés sur un exemple explicitement étiqueté), sur un wash chart-2 + masque radial
// (texture réservée à cette page — ne pas réintroduire ailleurs). Puis le même fil de
// mission que le reste de l'app (JourneySection), les critères éthiques (EthicsBand) et
// la pédagogie de l'honnêteté (HonestySection).
export default async function LandingPage() {
  const t = await getTranslations("landing");
  const tCommon = await getTranslations("common");

  return (
    <main className="bg-background min-h-screen">
      <header className="bg-background/95 sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="font-semibold">{tCommon("appName")}</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button variant="ghost" asChild>
              <Link href="/login">{t("login")}</Link>
            </Button>
            <Button asChild>
              <Link href="/register">{t("cta")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        {/* Wash chart-2 + masque radial — texture réservée de la landing (00-synthese.md) */}
        <div
          aria-hidden
          className="bg-chart-2/10 dark:bg-chart-2/20 pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] [mask-image:radial-gradient(ellipse_65%_55%_at_50%_0%,black,transparent_75%)]"
        />

        <div className="mx-auto max-w-3xl px-6 pt-16 pb-10 text-center sm:pt-20">
          <Badge variant="outline" className="mx-auto max-w-full gap-1.5 py-1.5 whitespace-normal">
            <GraduationCapIcon className="size-3.5 shrink-0" />
            {t("research")}
          </Badge>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">{t("tagline")}</h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg">{t("subtitle")}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/register">{t("cta")}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/dashboard">{t("open")}</Link>
            </Button>
          </div>
        </div>

        <div className="px-6 pb-20">
          <HeroPreview />
        </div>
      </section>

      <JourneySection />
      <EthicsBand />
      <HonestySection />

      <footer className="text-muted-foreground mx-auto max-w-5xl border-t px-6 py-8 text-center text-xs">
        {t("research")}
      </footer>
    </main>
  );
}
