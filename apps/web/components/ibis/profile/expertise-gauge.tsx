import { useTranslations } from "next-intl";

import { Progress } from "@/components/ui/progress";

// Jauge pédagogique (P11) : prévisualise le palier de familiarité IA actuellement
// sélectionné (1-5) avec son libellé — aide à comprendre l'impact sur l'adaptation
// de l'explicabilité. Purement visuelle : la valeur reste pilotée par le Select
// ai_familiarity au-dessus (aucune logique/état dupliqué).
export function ExpertiseGauge({ level }: { level: number }) {
  const t = useTranslations("profile");
  const tOnboarding = useTranslations("onboarding");
  const clamped = Math.min(5, Math.max(1, level));

  return (
    <div className="bg-muted/40 space-y-2.5 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{t("expertiseTitle")}</p>
        <span className="text-muted-foreground text-xs">
          {t("expertiseLevel", { level: clamped })}
        </span>
      </div>
      <Progress value={clamped * 20} />
      <p className="text-muted-foreground text-sm">{tOnboarding(`familiarity.${clamped}`)}</p>
    </div>
  );
}
