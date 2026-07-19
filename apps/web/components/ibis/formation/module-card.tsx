"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle2Icon, CircleIcon, SwordsIcon } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { lessonPractice } from "@/lib/formation/bridge";
import { moduleDone } from "@/lib/formation/progress";
import type { Cursus, Module } from "@/lib/formation/types";
import { cn } from "@/lib/utils";

// Carte de module : en-tête (titre + accroche) puis la liste des leçons, chacune un lien profond
// vers /formation/<cursus>/<lecon>. Les leçons faites portent une coche ; une leçon « mise en
// pratique » (pont vers un Défi) porte l'icône d'enquête.
export function ModuleCard({
  cursus,
  module,
  index,
  lessonsDone
}: {
  cursus: Cursus;
  module: Module;
  index: number;
  lessonsDone: string[];
}) {
  const t = useTranslations("formation");
  const complete = moduleDone(module, lessonsDone);

  return (
    <Card className={cn("gap-0 overflow-hidden", complete && "border-primary/30")}>
      <CardHeader className="gap-1">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
            {t("home.moduleLabel", { index: index + 1 })}
          </span>
          {complete ? <CheckCircle2Icon className="text-primary size-4" /> : null}
        </div>
        <h3 className="leading-tight font-semibold">{t(`modules.${module.slug}.title`)}</h3>
        <p className="text-muted-foreground text-sm">{t(`modules.${module.slug}.tagline`)}</p>
      </CardHeader>
      <CardContent className="pt-2">
        <ol className="divide-border/60 divide-y">
          {module.lessons.map((lesson, i) => {
            const done = lessonsDone.includes(lesson.slug);
            const isPractice = Boolean(lessonPractice(lesson));
            return (
              <li key={lesson.slug}>
                <Link
                  href={`/formation/${cursus.slug}/${lesson.slug}`}
                  className="hover:bg-muted/50 -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      done
                        ? "text-primary"
                        : "border-border text-muted-foreground border"
                    )}>
                    {done ? <CheckCircle2Icon className="size-5" /> : i + 1}
                  </span>
                  <span className={cn("flex-1 text-sm", done && "text-muted-foreground")}>
                    {t(`lessons.${lesson.slug}.title`)}
                  </span>
                  {isPractice ? (
                    <span className="text-primary inline-flex items-center gap-1 text-[11px] font-medium">
                      <SwordsIcon className="size-3.5" />
                      {t("home.practiceTag")}
                    </span>
                  ) : done ? null : (
                    <CircleIcon className="text-muted-foreground/40 size-3.5" />
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
