import { Fragment } from "react";
import { getTranslations } from "next-intl/server";
import { BrainCircuitIcon, DatabaseIcon, FolderIcon, LightbulbIcon, type LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Les 4 cards du parcours (docs/refonte/01-landing.md) : même vocabulaire visuel que
// `mission-stepper.tsx` (icônes identiques, ordre Projet→Dataset→Entraînement→Explication)
// mais SANS réutiliser le composant pill lui-même — celui-ci est conçu pour une navigation
// active dans l'app, pas pour du contenu marketing statique. Icônes en nuance neutre
// (bg-muted/text-muted-foreground) : sur la landing, chart-1/primary reste réservé au
// hero-preview (règle "un seul signal chromatique fort par page").
export async function JourneySection() {
  const t = await getTranslations("landing");
  const tMission = await getTranslations("projects.mission");

  const steps: { key: "project" | "dataset" | "training" | "explanation"; icon: LucideIcon; body: string }[] = [
    { key: "project", icon: FolderIcon, body: t("journey.projectBody") },
    { key: "dataset", icon: DatabaseIcon, body: t("phase1Body") },
    { key: "training", icon: BrainCircuitIcon, body: t("phase2Body") },
    { key: "explanation", icon: LightbulbIcon, body: t("phase3Body") }
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("journey.title")}</h2>
        <p className="text-muted-foreground mt-3 text-sm sm:text-base">{t("journey.subtitle")}</p>
      </div>

      <div className="mt-10 flex flex-col lg:flex-row lg:items-stretch">
        {steps.map((step, index) => (
          <Fragment key={step.key}>
            {index > 0 ? (
              <div
                aria-hidden
                className="text-muted-foreground/40 flex items-center justify-center py-1 text-lg lg:px-2 lg:py-0">
                <span className="lg:hidden">↓</span>
                <span className="hidden lg:inline">→</span>
              </div>
            ) : null}
            <Card className="flex-1">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                    <step.icon className="size-5" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <CardTitle className="text-base">{tMission(step.key)}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{step.body}</p>
              </CardContent>
            </Card>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
