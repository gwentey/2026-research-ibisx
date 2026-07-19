"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeftIcon, AwardIcon, CheckCircle2Icon, LockIcon, PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GradeBadge } from "@/components/ibis/formation/grade-badge";
import { ProgressRing } from "@/components/ibis/progress-ring";
import { BADGES, earnedBadges } from "@/lib/formation/badges";
import { CURSUS } from "@/lib/formation/catalog";
import { cursusComplete, gradeFor, gradeRank } from "@/lib/formation/progress";
import { useAcademyStore } from "@/lib/formation/store";
import { cn } from "@/lib/utils";

// Empreinte déterministe (nod à la reproductibilité E5) : dérivée des leçons faites, pas un vrai
// hash cryptographique — un identifiant stable et vérifiable de la progression.
function fingerprint(done: string[]): string {
  let h = 0;
  for (const s of [...done].sort()) {
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0").toUpperCase();
}

export default function PassportPage() {
  const t = useTranslations("formation");
  const lessonsDone = useAcademyStore((s) => s.lessonsDone);
  const notionsOwned = useAcademyStore((s) => s.notionsOwned);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const done = mounted ? lessonsDone : [];

  const total = CURSUS.reduce((n, c) => n + c.modules.reduce((m, mod) => m + mod.lessons.length, 0), 0);
  const percent = total > 0 ? Math.round((done.length / total) * 100) : 0;
  const grade = gradeFor(CURSUS, done);
  const earned = mounted ? earnedBadges(done) : [];
  const certified = gradeRank(grade) >= 2; // Praticien ou plus

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="text-muted-foreground -ml-2 print:hidden">
        <Link href="/formation">
          <ArrowLeftIcon />
          {t("home.backToAcademy")}
        </Link>
      </Button>

      {/* Le certificat */}
      <Card className="overflow-hidden">
        <div className="from-primary/[0.07] bg-gradient-to-br to-transparent p-6 text-center">
          <AwardIcon className="text-primary mx-auto size-8" />
          <p className="text-muted-foreground mt-2 text-[11px] font-medium tracking-widest uppercase">
            {t("passport.certLabel")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("passport.title")}</h1>
          <div className="mt-3 flex items-center justify-center gap-3">
            <GradeBadge grade={grade} />
            <div className="relative flex items-center justify-center">
              <ProgressRing value={percent} size={44} strokeWidth={3} />
              <span className="absolute text-[10px] font-semibold">{percent}%</span>
            </div>
          </div>
          <p className="text-muted-foreground mx-auto mt-3 max-w-md text-sm">
            {certified ? t("passport.certifiedLead") : t("passport.progressLead")}
          </p>
          <div className="text-muted-foreground mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs">
            <span>{t("passport.lessonsStat", { done: done.length, total })}</span>
            <span>{t("passport.notionsStat", { count: notionsOwned.length })}</span>
            <span>{t("passport.badgesStat", { count: earned.length, total: BADGES.length })}</span>
          </div>
          <p className="text-muted-foreground/70 mt-3 font-mono text-[11px]">
            {t("passport.fingerprint")} {fingerprint(done)}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-4 print:hidden"
            onClick={() => window.print()}>
            <PrinterIcon />
            {t("passport.print")}
          </Button>
        </div>
      </Card>

      {/* Progression par cursus */}
      <div>
        <h2 className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">
          {t("passport.cursusTitle")}
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {CURSUS.map((c) => {
            const ok = cursusComplete(c, done);
            return (
              <div
                key={c.slug}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                  ok ? "border-primary/30" : "text-muted-foreground"
                )}>
                {ok ? (
                  <CheckCircle2Icon className="text-primary size-4 shrink-0" />
                ) : (
                  <span className="border-muted-foreground/30 size-4 shrink-0 rounded-full border" />
                )}
                {t(`cursus.${c.slug}.title`)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Badges de compétence */}
      <div>
        <h2 className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">
          {t("passport.badgesTitle")}
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {BADGES.map((badge) => {
            const has = earned.includes(badge.id);
            return (
              <div
                key={badge.id}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border p-3",
                  has ? "border-primary/30 bg-primary/[0.03]" : "opacity-60"
                )}>
                {has ? (
                  <AwardIcon className="text-primary mt-0.5 size-4 shrink-0" />
                ) : (
                  <LockIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium">{t(`badges.${badge.id}.title`)}</p>
                  <p className="text-muted-foreground text-xs">{t(`badges.${badge.id}.description`)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
