"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, SwordsIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

// B8 — Mise en pratique. Le pont SIGNATURE : la leçon se solde par un VRAI Défi, sur le vrai
// pipeline (P1). Tons `primary` (pas `--ai`, réservé à l'IA). Lancer la pratique termine la
// leçon puis dépose l'apprenant sur le briefing du Défi.
export function PracticeBlock({
  lessonSlug,
  blockId,
  challengeSlug,
  onStart
}: {
  lessonSlug: string;
  blockId: string;
  challengeSlug: string;
  onStart: () => void;
}) {
  const t = useTranslations("formation");
  const tc = useTranslations("challenges");
  const router = useRouter();
  const base = `lessons.${lessonSlug}.${blockId}`;

  function go() {
    onStart(); // termine la leçon (progression) AVANT de partir vers le Défi
    router.push(`/challenges/${challengeSlug}`);
  }

  return (
    <div className="border-primary/40 from-primary/[0.06] to-primary/[0.02] rounded-xl border border-dashed bg-gradient-to-br p-5">
      <p className="text-primary inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
        <SwordsIcon className="size-3.5" />
        {t("blocks.practiceLabel")}
      </p>
      <h3 className="mt-1.5 font-semibold">{t(`${base}.title`)}</h3>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{t(`${base}.body`)}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={go}>
          {t("blocks.practiceCta")}
          <ArrowRightIcon />
        </Button>
        <span className="text-muted-foreground text-xs">
          {t("blocks.practiceTarget", { challenge: tc(`items.${challengeSlug}.title`) })}
        </span>
      </div>
    </div>
  );
}
