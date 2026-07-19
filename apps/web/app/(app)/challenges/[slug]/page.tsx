"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ChallengeBriefing } from "@/components/ibis/challenges/challenge-briefing";
import { getChallenge } from "@/lib/challenges/catalog";
import { resolveDatasetId } from "@/lib/challenges/resolve-dataset";
import { useQuestStore } from "@/lib/challenges/store";

export default function ChallengeBriefingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const challenge = getChallenge(slug);
  const t = useTranslations("challenges");
  const router = useRouter();
  const start = useQuestStore((state) => state.start);

  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  // Pré-résout l'id du dataset dès l'affichage du briefing (le lien profond en a besoin).
  useEffect(() => {
    if (!challenge) return;
    let active = true;
    void resolveDatasetId(challenge.datasetSlug).then((id) => {
      if (active) setDatasetId(id);
    });
    return () => {
      active = false;
    };
  }, [challenge]);

  const onStart = useCallback(async () => {
    if (!challenge) return;
    setLaunching(true);
    const id = datasetId ?? (await resolveDatasetId(challenge.datasetSlug));
    if (!id) {
      toast.error(t("resolveError"));
      setLaunching(false);
      return;
    }
    start(challenge.slug); // active la quête AVANT de naviguer (le traceur suivra)
    if (challenge.entryMode === "project_direct") {
      // Nom de projet pré-rempli (= titre de l'enquête) : sinon le bouton « Créer et lancer »
      // reste désactivé (champ nom requis), et le novice se retrouve bloqué.
      const projectName = encodeURIComponent(t(`items.${challenge.slug}.title`));
      router.push(
        `/projects/new?datasetId=${id}&datasetName=${challenge.datasetSlug}&name=${projectName}&challenge=${challenge.slug}`
      );
    } else {
      router.push(`/datasets/${id}?challenge=${challenge.slug}`);
    }
  }, [challenge, datasetId, router, start, t]);

  if (!challenge) {
    return (
      <div className="mx-auto mt-16 max-w-lg space-y-3 text-center">
        <p className="text-sm">{t("notFound")}</p>
        <Button asChild variant="outline">
          <Link href="/challenges">{t("backToList")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <ChallengeBriefing
      challenge={challenge}
      datasetId={datasetId}
      launching={launching}
      onStart={onStart}
    />
  );
}
