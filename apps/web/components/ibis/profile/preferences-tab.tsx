"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { ExpertiseGauge } from "@/components/ibis/profile/expertise-gauge";
import { LOCALE_COOKIE } from "@/i18n/config";
import { updateMe } from "@/lib/api/generated";
import type { EducationLevel, UserRead, XaiAudience } from "@/lib/api/generated";
import { useAuthStore } from "@/lib/auth/store";

const AUDIENCES: XaiAudience[] = ["novice", "intermediate", "expert"];
const EDUCATION_LEVELS: EducationLevel[] = ["lycee", "licence", "master", "doctorat", "autre"];
const FAMILIARITIES = ["1", "2", "3", "4", "5"];

export function PreferencesTab({ user }: { user: UserRead }) {
  const t = useTranslations("profile");
  const tOnboarding = useTranslations("onboarding");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);

  const [locale, setLocale] = useState(user.locale);
  const [audience, setAudience] = useState<XaiAudience>(user.xai_audience);
  const [familiarity, setFamiliarity] = useState(
    user.ai_familiarity !== null ? String(user.ai_familiarity) : "3"
  );
  const [education, setEducation] = useState<EducationLevel | null>(user.education_level);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { data, error } = await updateMe({
      body: {
        locale,
        xai_audience: audience !== user.xai_audience ? audience : undefined,
        ai_familiarity: Number(familiarity),
        education_level: education ?? undefined
      },
      throwOnError: false
    });
    setSaving(false);
    if (!data) {
      const code =
        (error as { detail?: { code?: string } } | undefined)?.detail?.code ?? "UNKNOWN_ERROR";
      toast.error(tErrors.has(code) ? tErrors(code) : tErrors("UNKNOWN_ERROR"));
      return;
    }
    setUser(data);
    setAudience(data.xai_audience);
    document.cookie = `${LOCALE_COOKIE}=${data.locale};path=/;max-age=31536000;samesite=lax`;
    toast.success(t("preferencesSaved"));
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("tabPreferences")}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field>
              <FieldLabel>{t("language")}</FieldLabel>
              <Select value={locale} onValueChange={setLocale}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fr">{tCommon("french")}</SelectItem>
                  <SelectItem value="en">{tCommon("english")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>{t("educationLevel")}</FieldLabel>
              <Select
                value={education ?? undefined}
                onValueChange={(value) => setEducation(value as EducationLevel)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDUCATION_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {tOnboarding(`education.${level}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <FieldSeparator>{t("adaptExplainability")}</FieldSeparator>

          <Field>
            <FieldLabel>{t("aiFamiliarity")}</FieldLabel>
            <Select value={familiarity} onValueChange={setFamiliarity}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FAMILIARITIES.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level} — {tOnboarding(`familiarity.${level}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <ExpertiseGauge level={Number(familiarity)} />

          <Field>
            <FieldLabel>{t("xaiAudience")}</FieldLabel>
            <Select value={audience} onValueChange={(value) => setAudience(value as XaiAudience)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCES.map((level) => (
                  <SelectItem key={level} value={level}>
                    {t(`audience.${level}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{t("xaiAudienceHelp")}</FieldDescription>
          </Field>
        </FieldGroup>

        <Button className="mt-6" onClick={() => void save()} disabled={saving}>
          {saving ? tCommon("loading") : tCommon("save")}
        </Button>
      </CardContent>
    </Card>
  );
}
