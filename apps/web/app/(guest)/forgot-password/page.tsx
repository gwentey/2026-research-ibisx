"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GuestShell } from "@/components/ibis/guest-shell";
import { forgotPassword } from "@/lib/api/generated";

const schema = z.object({ email: z.string().email() });

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [sent, setSent] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" }
  });

  const onSubmit = async (values: FormValues) => {
    await forgotPassword({ body: { email: values.email }, throwOnError: false });
    setSent(true);
  };

  return (
    <GuestShell>
      <div className="text-center">
        <h2 className="mt-6 text-3xl font-bold">{t("forgotTitle")}</h2>
        <p className="text-muted-foreground mt-2 text-sm">{t("forgotSubtitle")}</p>
      </div>

      {sent ? (
        <Alert>
          <AlertDescription>{t("resetLinkSent")}</AlertDescription>
        </Alert>
      ) : (
        <form className="mt-8 space-y-6" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div>
            <Label htmlFor="email" className="sr-only">
              {t("email")}
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t("email")}
              aria-invalid={!!form.formState.errors.email}
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="text-destructive mt-1 text-xs">{t("emailInvalid")}</p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {t("sendResetLink")}
          </Button>
        </form>
      )}

      <div className="mt-6 text-center text-sm">
        <Link href="/login" className="underline">
          {t("backToLogin")}
        </Link>
      </div>
    </GuestShell>
  );
}
