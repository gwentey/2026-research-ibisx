"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback>{userInitials(user.pseudo, user.email)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              {t("changeAvatar")}
            </Button>
            <p className="text-muted-foreground text-xs">{t("avatarHelp")}</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => void onAvatarChange(event.target.files?.[0])}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="pseudo">{t("pseudo")}</Label>
            <Input
              id="pseudo"
              value={pseudo}
              maxLength={64}
              onChange={(event) => setPseudo(event.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="given_name">{t("givenName")}</Label>
            <Input
              id="given_name"
              value={givenName}
              maxLength={120}
              onChange={(event) => setGivenName(event.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="family_name">{t("familyName")}</Label>
            <Input
              id="family_name"
              value={familyName}
              maxLength={120}
              onChange={(event) => setFamilyName(event.target.value)}
              className="mt-2"
            />
          </div>
        </div>

        <Button onClick={() => void save()} disabled={saving}>
          {saving ? tCommon("loading") : tCommon("save")}
        </Button>
      </CardContent>
    </Card>
  );
}
