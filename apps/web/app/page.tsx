import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BrainCircuitIcon, LightbulbIcon, ShieldCheckIcon } from "lucide-react";

import Logo from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Landing publique (CDC §10 [SHOULD]) — sobre, zéro lien mort, zéro donnée fictive.
export default async function LandingPage() {
  const t = await getTranslations("landing");
  const tCommon = await getTranslations("common");

  const phases = [
    { icon: ShieldCheckIcon, title: t("phase1"), body: t("phase1Body") },
    { icon: BrainCircuitIcon, title: t("phase2"), body: t("phase2Body") },
    { icon: LightbulbIcon, title: t("phase3"), body: t("phase3Body") }
  ];

  return (
    <main className="bg-background min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="font-semibold">{tCommon("appName")}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" asChild>
            <Link href="/login">{t("login")}</Link>
          </Button>
          <Button asChild>
            <Link href="/register">{t("cta")}</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("tagline")}</h1>
        <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg">{t("subtitle")}</p>
        <div className="mt-8 flex justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/register">{t("cta")}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/dashboard">{t("open")}</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-16 sm:grid-cols-3">
        {phases.map((phase, index) => (
          <Card key={phase.title}>
            <CardHeader>
              <phase.icon className="text-muted-foreground size-6" />
              <CardTitle className="text-base">
                {index + 1}. {phase.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">{phase.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <footer className="text-muted-foreground mx-auto max-w-5xl border-t px-6 py-8 text-center text-xs">
        {t("research")}
      </footer>
    </main>
  );
}
