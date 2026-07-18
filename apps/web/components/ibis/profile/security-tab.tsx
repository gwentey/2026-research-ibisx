"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { changePassword, deleteAccount } from "@/lib/api/generated";
import type { UserRead } from "@/lib/api/generated";
import { useAuthStore } from "@/lib/auth/store";

function errorCodeOf(error: unknown): string {
  return (error as { detail?: { code?: string } } | undefined)?.detail?.code ?? "UNKNOWN_ERROR";
}

export function SecurityTab({ user }: { user: UserRead }) {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);

  const submitPassword = async () => {
    setSaving(true);
    const { response, error } = await changePassword({
      body: {
        current_password: user.has_password ? currentPassword : null,
        new_password: newPassword
      },
      throwOnError: false
    });
    setSaving(false);
    if (!response?.ok) {
      const code = errorCodeOf(error);
      toast.error(tErrors.has(code) ? tErrors(code) : tErrors("UNKNOWN_ERROR"));
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    toast.success(t("passwordChanged"));
  };

  const submitDelete = async () => {
    setDeleting(true);
    const { response, error } = await deleteAccount({
      body: { email_confirmation: confirmEmail },
      throwOnError: false
    });
    setDeleting(false);
    if (!response?.ok) {
      const code = errorCodeOf(error);
      toast.error(tErrors.has(code) ? tErrors(code) : tErrors("UNKNOWN_ERROR"));
      return;
    }
    useAuthStore.getState().clearSession();
    router.replace("/login");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {user.has_password ? t("changePassword") : t("setPassword")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!user.has_password ? (
            <Alert>
              <AlertDescription>{t("googleOnlyHint")}</AlertDescription>
            </Alert>
          ) : null}
          {user.has_password ? (
            <Field className="max-w-sm">
              <FieldLabel htmlFor="current_password">{t("currentPassword")}</FieldLabel>
              <Input
                id="current_password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </Field>
          ) : null}
          <Field className="max-w-sm">
            <FieldLabel htmlFor="new_password">{t("newPassword")}</FieldLabel>
            <Input
              id="new_password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </Field>
          <Button
            onClick={() => void submitPassword()}
            disabled={
              saving || newPassword.length < 8 || (user.has_password && !currentPassword)
            }>
            {user.has_password ? t("changePassword") : t("setPassword")}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive text-base">{t("dangerZone")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">{t("deleteWarning")}</p>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive">{t("deleteAccount")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("deleteAccount")}</DialogTitle>
                <DialogDescription>{t("deleteWarning")}</DialogDescription>
              </DialogHeader>
              <Field>
                <FieldLabel htmlFor="confirm_email">{t("deleteConfirmLabel")}</FieldLabel>
                <Input
                  id="confirm_email"
                  type="email"
                  value={confirmEmail}
                  onChange={(event) => setConfirmEmail(event.target.value)}
                  placeholder={user.email}
                />
              </Field>
              <DialogFooter>
                <Button
                  variant="destructive"
                  disabled={deleting || confirmEmail.toLowerCase() !== user.email.toLowerCase()}
                  onClick={() => void submitDelete()}>
                  {deleting ? tCommon("loading") : t("deleteConfirm")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
