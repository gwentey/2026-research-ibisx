"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GuestShell } from "@/components/ibis/guest-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { resetPassword } from "@/lib/api/generated";

const schema = z.object({ new_password: z.string().min(8) });

type FormValues = z.infer<typeof schema>;

function ResetForm() {
  const t = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<"idle" | "done" | "error">("idle");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { new_password: "" }
  });

  const onSubmit = async (values: FormValues) => {
    const { response } = await resetPassword({
      body: { token, new_password: values.new_password },
      throwOnError: false
    });
    setState(response?.ok ? "done" : "error");
  };

  return (
    <GuestShell>
      <div className="text-center">
        <h2 className="mt-6 text-3xl font-bold">{t("resetTitle")}</h2>
        <p className="text-muted-foreground mt-2 text-sm">{t("resetSubtitle")}</p>
      </div>

      {state === "done" ? (
        <Alert>
          <AlertDescription>{t("resetSuccess")}</AlertDescription>
        </Alert>
      ) : (
        <form className="mt-8 space-y-6" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {state === "error" ? (
            <Alert variant="destructive">
              <AlertDescription>{tErrors("INVALID_RESET")}</AlertDescription>
            </Alert>
          ) : null}
          <div>
            <Label htmlFor="new_password" className="sr-only">
              {t("newPassword")}
            </Label>
            <Input
              id="new_password"
              type="password"
              autoComplete="new-password"
              placeholder={t("newPassword")}
              aria-invalid={!!form.formState.errors.new_password}
              {...form.register("new_password")}
            />
            <p
              className={
                form.formState.errors.new_password
                  ? "text-destructive mt-1 text-xs"
                  : "text-muted-foreground mt-1 text-xs"
              }>
              {t("passwordHint")}
            </p>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={form.formState.isSubmitting || !token}>
            {t("resetSubmit")}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-24 h-64 w-full max-w-md" />}>
      <ResetForm />
    </Suspense>
  );
}
