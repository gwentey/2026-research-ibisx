"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { OnboardingGuard } from "@/components/ibis/auth-guard";
import { completeOnboarding } from "@/lib/api/generated";
import type { EducationLevel } from "@/lib/api/generated";
import { useAuthStore } from "@/lib/auth/store";
import { cn } from "@/lib/utils";

const EDUCATION_LEVELS: EducationLevel[] = ["lycee", "licence", "master", "doctorat", "autre"];
const FAMILIARITY_LEVELS = [1, 2, 3, 4, 5] as const;
const TOTAL_STEPS = 3;

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
    <main className="bg-muted/40 flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground text-xs font-medium uppercase">
            {t("step", { current: step, total: TOTAL_STEPS })}
          </p>
          <Progress value={(step / TOTAL_STEPS) * 100} />
        </div>

        <Card>
          <CardContent className="space-y-6 pt-6">
            {step === 1 ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">{t("educationTitle")}</h2>
                  <p className="text-muted-foreground text-sm">{t("educationHelp")}</p>
                </div>
                <RadioGroup
                  value={education ?? undefined}
                  onValueChange={(value) => setEducation(value as EducationLevel)}
                  className="grid gap-2">
                  {EDUCATION_LEVELS.map((level) => (
                    <Label
                      key={level}
                      htmlFor={`education-${level}`}
                      className={cn(
                        "hover:bg-muted flex cursor-pointer items-center gap-3 rounded-md border p-3",
                        education === level && "border-primary bg-muted"
                      )}>
                      <RadioGroupItem value={level} id={`education-${level}`} />
                      <span>{t(`education.${level}`)}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">{t("ageTitle")}</h2>
                  <p className="text-muted-foreground text-sm">{t("ageHelp")}</p>
                </div>
                <div className="max-w-40">
                  <Label htmlFor="age">{t("ageLabel")}</Label>
                  <Input
                    id="age"
                    type="number"
                    min={13}
                    max={120}
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                    className="mt-2"
                    aria-invalid={age !== "" && !ageValid}
                  />
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">{t("familiarityTitle")}</h2>
                  <p className="text-muted-foreground text-sm">{t("familiarityHelp")}</p>
                </div>
                <RadioGroup
                  value={familiarity !== null ? String(familiarity) : undefined}
                  onValueChange={(value) => setFamiliarity(Number(value))}
                  className="grid gap-2">
                  {FAMILIARITY_LEVELS.map((level) => (
                    <Label
                      key={level}
                      htmlFor={`familiarity-${level}`}
                      className={cn(
                        "hover:bg-muted flex cursor-pointer items-center gap-3 rounded-md border p-3",
                        familiarity === level && "border-primary bg-muted"
                      )}>
                      <RadioGroupItem value={String(level)} id={`familiarity-${level}`} />
                      <span className="font-mono text-sm">{level}</span>
                      <span>{t(`familiarity.${level}`)}</span>
                    </Label>
                  ))}
                </RadioGroup>
                {familiarity !== null ? (
                  <p className="text-muted-foreground bg-muted rounded-md p-3 text-sm">
                    {t(`audiencePreview.${audienceFor(familiarity)}`)}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-2">
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
