"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  BookOpenIcon,
  BrainCircuitIcon,
  CalendarDaysIcon,
  CompassIcon,
  GaugeIcon,
  GraduationCapIcon,
  MicroscopeIcon,
  PuzzleIcon,
  RocketIcon,
  SchoolIcon,
  SparklesIcon,
  SproutIcon,
  type LucideIcon
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup } from "@/components/ui/radio-group";
import Logo from "@/components/layout/logo";
import { OnboardingGuard } from "@/components/ibis/auth-guard";
import { AgeStepper } from "@/components/ibis/onboarding/age-stepper";
import { CalibrationPattern } from "@/components/ibis/onboarding/calibration-pattern";
import { ChoiceCard } from "@/components/ibis/onboarding/choice-card";
import { OnboardingPath, type OnboardingPathStep } from "@/components/ibis/onboarding/onboarding-path";
import { completeOnboarding } from "@/lib/api/generated";
import type { EducationLevel } from "@/lib/api/generated";
import { useAuthStore } from "@/lib/auth/store";

const EDUCATION_LEVELS: EducationLevel[] = ["lycee", "licence", "master", "doctorat", "autre"];
const FAMILIARITY_LEVELS = [1, 2, 3, 4, 5] as const;
const TOTAL_STEPS = 3;

const STEP_ICONS: Record<number, LucideIcon> = {
  1: GraduationCapIcon,
  2: CalendarDaysIcon,
  3: GaugeIcon
};

const EDUCATION_ICONS: Record<EducationLevel, LucideIcon> = {
  lycee: SchoolIcon,
  licence: BookOpenIcon,
  master: GraduationCapIcon,
  doctorat: MicroscopeIcon,
  autre: SparklesIcon
};

// Icônes des 5 niveaux de familiarité — dégradé de gravité tonale (plan 03) : la forme
// progresse de la pousse (novice) au circuit neuronal (expert), jamais une couleur inventée.
const FAMILIARITY_ICONS: Record<number, LucideIcon> = {
  1: SproutIcon,
  2: PuzzleIcon,
  3: CompassIcon,
  4: RocketIcon,
  5: BrainCircuitIcon
};

// Tuile qui s'assombrit avec le niveau : chart-5 (le plus clair) → chart-1 (le plus foncé).
const FAMILIARITY_TONE: Record<number, string> = {
  1: "bg-[var(--chart-5)]/15 text-[var(--chart-5)]",
  2: "bg-[var(--chart-4)]/15 text-[var(--chart-4)]",
  3: "bg-[var(--chart-3)]/15 text-[var(--chart-3)]",
  4: "bg-[var(--chart-2)]/15 text-[var(--chart-2)]",
  5: "bg-[var(--chart-1)]/15 text-[var(--chart-1)]"
};

function audienceFor(familiarity: number): "novice" | "intermediate" | "expert" {
  if (familiarity <= 2) return "novice";
  if (familiarity === 3) return "intermediate";
  return "expert";
}

function OnboardingWizard() {
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);

  const [step, setStep] = useState(1);
  const [education, setEducation] = useState<EducationLevel | null>(null);
  const [age, setAge] = useState("");
  const [familiarity, setFamiliarity] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const ageNumber = Number(age);
  const ageValid = Number.isInteger(ageNumber) && ageNumber >= 13 && ageNumber <= 120;
  const canNext =
    (step === 1 && education !== null) || (step === 2 && ageValid) || (step === 3 && familiarity !== null);

  const pathSteps: OnboardingPathStep[] = [
    { icon: GraduationCapIcon, label: t("pathLabels.education") },
    { icon: CalendarDaysIcon, label: t("pathLabels.age") },
    { icon: GaugeIcon, label: t("pathLabels.familiarity") }
  ];

  const HeaderIcon = STEP_ICONS[step];

  const submit = async () => {
    if (!education || !ageValid || familiarity === null) return;
    setSubmitting(true);
    const { data, error } = await completeOnboarding({
      body: { education_level: education, age: ageNumber, ai_familiarity: familiarity },
      throwOnError: false
    });
    if (!data) {
      const code = (error as { detail?: { code?: string } } | undefined)?.detail?.code;
      toast.error(code && tErrors.has(code) ? tErrors(code) : tErrors("UNKNOWN_ERROR"));
      setSubmitting(false);
      return;
    }
    setUser(data);
    router.replace("/dashboard");
  };

  return (
    <main className="bg-muted/20 relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
      <CalibrationPattern />

      <div className="relative z-10 w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-center gap-2">
          <Logo />
          <span className="text-sm font-semibold tracking-tight">{tCommon("appName")}</span>
        </div>

        <OnboardingPath
          steps={pathSteps}
          current={step}
          ariaLabel={t("step", { current: step, total: TOTAL_STEPS })}
        />

        <Card className="overflow-hidden">
          <CardContent className="space-y-6 pt-6">
            <div className="flex items-start gap-4">
              <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
                <HeaderIcon className="size-6" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("title")}</h1>
                <p className="text-muted-foreground mt-0.5 text-sm">{t("subtitle")}</p>
              </div>
            </div>

            <div className="space-y-4 border-t pt-6">
              {step === 1 ? (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-base font-semibold">{t("educationTitle")}</h2>
                    <p className="text-muted-foreground text-sm">{t("educationHelp")}</p>
                  </div>
                  <RadioGroup
                    value={education ?? undefined}
                    onValueChange={(value) => setEducation(value as EducationLevel)}
                    className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {EDUCATION_LEVELS.map((level) => (
                      <ChoiceCard
                        key={level}
                        id={`education-${level}`}
                        value={level}
                        icon={EDUCATION_ICONS[level]}
                        title={t(`education.${level}`)}
                        selected={education === level}
                        orientation="grid"
                      />
                    ))}
                  </RadioGroup>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-base font-semibold">{t("ageTitle")}</h2>
                    <p className="text-muted-foreground text-sm">{t("ageHelp")}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="age">{t("ageLabel")}</Label>
                    <AgeStepper
                      id="age"
                      value={age}
                      onChange={setAge}
                      min={13}
                      max={120}
                      invalid={age !== "" && !ageValid}
                      decrementLabel={t("ageStepper.decrement")}
                      incrementLabel={t("ageStepper.increment")}
                    />
                    <p className="text-muted-foreground text-xs">{t("ageReassurance")}</p>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-base font-semibold">{t("familiarityTitle")}</h2>
                    <p className="text-muted-foreground text-sm">{t("familiarityHelp")}</p>
                  </div>
                  <RadioGroup
                    value={familiarity !== null ? String(familiarity) : undefined}
                    onValueChange={(value) => setFamiliarity(Number(value))}
                    className="grid gap-2">
                    {FAMILIARITY_LEVELS.map((level) => (
                      <ChoiceCard
                        key={level}
                        id={`familiarity-${level}`}
                        value={String(level)}
                        icon={FAMILIARITY_ICONS[level]}
                        title={t(`familiarity.${level}`)}
                        selected={familiarity === level}
                        orientation="row"
                        mediaClassName={FAMILIARITY_TONE[level]}
                        eyebrow={String(level)}
                      />
                    ))}
                  </RadioGroup>
                  {familiarity !== null ? (
                    <div className="bg-muted space-y-1.5 rounded-md p-4">
                      <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
                        <SparklesIcon className="size-3.5" aria-hidden="true" />
                        {t("audiencePreviewEyebrow")}
                      </div>
                      <p className="text-sm">{t(`audiencePreview.${audienceFor(familiarity)}`)}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <Button
                variant="ghost"
                onClick={() => setStep((current) => Math.max(1, current - 1))}
                disabled={step === 1 || submitting}>
                {tCommon("back")}
              </Button>
              {step < TOTAL_STEPS ? (
                <Button onClick={() => setStep((current) => current + 1)} disabled={!canNext}>
                  {tCommon("next")}
                </Button>
              ) : (
                <Button onClick={() => void submit()} disabled={!canNext || submitting}>
                  {submitting ? t("submitting") : t("submit")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <OnboardingGuard>
      <OnboardingWizard />
    </OnboardingGuard>
  );
}
