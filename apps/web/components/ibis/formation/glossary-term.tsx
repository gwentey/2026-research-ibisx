"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, BookOpenIcon } from "lucide-react";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { notionLesson } from "@/lib/formation/glossary";
import type { ReactNode } from "react";

// Glossaire vivant (O4) : un terme survolable n'importe où → définition + lien vers la leçon
// qui l'enseigne. Le texte vient de l'i18n `formation.notions.<id>` (source unique avec le deck).
export function GlossaryTerm({ notionId, children }: { notionId: string; children: ReactNode }) {
  const t = useTranslations("formation");
  const entry = notionLesson(notionId);
  const base = `notions.${notionId}`;

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span
          tabIndex={0}
          className="decoration-primary/40 hover:decoration-primary cursor-help underline decoration-dotted underline-offset-4 outline-none">
          {children}
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 space-y-2">
        <p className="text-primary inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
          <BookOpenIcon className="size-3.5" />
          {t("blocks.notionLabel")}
        </p>
        <p className="font-semibold">{t(`${base}.term`)}</p>
        <p className="text-sm leading-relaxed">{t(`${base}.definition`)}</p>
        {entry ? (
          <Link
            href={`/formation/${entry.cursusSlug}/${entry.lessonSlug}`}
            className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline">
            {t("glossary.learnMore")}
            <ArrowRightIcon className="size-3.5" />
          </Link>
        ) : null}
      </HoverCardContent>
    </HoverCard>
  );
}
