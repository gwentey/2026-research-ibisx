"use client";

import { use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { LessonView } from "@/components/ibis/formation/lesson-view";
import { findLesson } from "@/lib/formation/catalog";

export default function LessonPage({
  params
}: {
  params: Promise<{ cursus: string; lecon: string }>;
}) {
  const { cursus: cursusSlug, lecon } = use(params);
  const t = useTranslations("formation");
  const found = findLesson(lecon);

  // Leçon inconnue OU incohérence cursus↔leçon → message + retour.
  if (!found || found.cursus.slug !== cursusSlug) {
    return (
      <div className="mx-auto mt-16 max-w-lg space-y-3 text-center">
        <p className="text-sm">{t("home.notFound")}</p>
        <Button asChild variant="outline">
          <Link href="/formation">{t("home.backToAcademy")}</Link>
        </Button>
      </div>
    );
  }

  return <LessonView cursus={found.cursus} module={found.module} lesson={found.lesson} />;
}
