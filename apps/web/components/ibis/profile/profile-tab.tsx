"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAvatarUrl, userInitials } from "@/components/ibis/use-avatar";
import { updateMe, uploadAvatar } from "@/lib/api/generated";
import type { UserRead } from "@/lib/api/generated";
import { useAuthStore } from "@/lib/auth/store";

function errorCodeOf(error: unknown): string {
  return (error as { detail?: { code?: string } } | undefined)?.detail?.code ?? "UNKNOWN_ERROR";
}

export function ProfileTab({ user }: { user: UserRead }) {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const setUser = useAuthStore((state) => state.setUser);
  const avatarUrl = useAvatarUrl();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pseudo, setPseudo] = useState(user.pseudo ?? "");
  const [givenName, setGivenName] = useState(user.given_name ?? "");
  const [familyName, setFamilyName] = useState(user.family_name ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { data, error } = await updateMe({
      body: {
        pseudo: pseudo || null,
        given_name: givenName || null,
        family_name: familyName || null
      },
      throwOnError: false
    });
    setSaving(false);
    if (!data) {
      const code = errorCodeOf(error);
      toast.error(tErrors.has(code) ? tErrors(code) : tErrors("UNKNOWN_ERROR"));
      return;
    }
    setUser(data);
    toast.success(t("profileSaved"));
  };

  const onAvatarChange = async (file: File | undefined) => {
    if (!file) return;
    const { data, error } = await uploadAvatar({ body: { file }, throwOnError: false });
    if (!data) {
      const code = errorCodeOf(error);
      toast.error(tErrors.has(code) ? tErrors(code) : tErrors("UNKNOWN_ERROR"));
      return;
    }
    setUser({ ...data });
    toast.success(t("profileSaved"));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("tabProfile")}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field orientation="horizontal">
            <Avatar className="size-16">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
              <AvatarFallback>{userInitials(user.pseudo, user.email)}</AvatarFallback>
            </Avatar>
            <FieldContent>
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => fileInputRef.current?.click()}>
                {t("changeAvatar")}
              </Button>
              <FieldDescription>{t("avatarHelp")}</FieldDescription>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => void onAvatarChange(event.target.files?.[0])}
              />
            </FieldContent>
          </Field>

          <FieldSeparator />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="pseudo">{t("pseudo")}</FieldLabel>
              <Input
                id="pseudo"
                value={pseudo}
                maxLength={64}
                onChange={(event) => setPseudo(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="given_name">{t("givenName")}</FieldLabel>
              <Input
                id="given_name"
                value={givenName}
                maxLength={120}
                onChange={(event) => setGivenName(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="family_name">{t("familyName")}</FieldLabel>
              <Input
                id="family_name"
                value={familyName}
                maxLength={120}
                onChange={(event) => setFamilyName(event.target.value)}
              />
            </Field>
          </div>
        </FieldGroup>

        <Button className="mt-6" onClick={() => void save()} disabled={saving}>
          {saving ? tCommon("loading") : tCommon("save")}
        </Button>
      </CardContent>
    </Card>
  );
}
