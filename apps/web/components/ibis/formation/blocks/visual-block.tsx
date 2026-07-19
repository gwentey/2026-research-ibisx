"use client";

import { useTranslations } from "next-intl";

import { DomainPattern } from "@/components/ibis/datasets/domain-pattern";
import { getDomainVisual } from "@/lib/datasets/domain-visuals";

// B2 — Explication visuelle. Le cœur pédagogique : un titre, une explication en clair, et un
// cadre-schéma teinté par domaine (motif SVG en tokens, jamais de couleur inventée). La
// « légende » (caption) porte l'idée-image à retenir.
export function VisualBlock({
  lessonSlug,
  blockId,
  domain
}: {
  lessonSlug: string;
  blockId: string;
  domain: string;
}) {
  const t = useTranslations("formation");
  const base = `lessons.${lessonSlug}.${blockId}`;
  const visual = getDomainVisual(domain);

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">{t(`${base}.title`)}</h3>
      <p className="leading-relaxed">{t(`${base}.body`)}</p>
      <figure
        className={`relative overflow-hidden rounded-xl border p-5 ${visual.vignette}`}>
        <DomainPattern pattern={visual.pattern} className="text-foreground/[0.06]" />
        <figcaption className="relative text-sm font-medium">{t(`${base}.caption`)}</figcaption>
      </figure>
    </div>
  );
}
