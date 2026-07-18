"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from "lucide-react";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { GoogleButton } from "@/components/ibis/google-button";
import { GuestShell } from "@/components/ibis/guest-shell";
import { ApiAuthError, loginAction, postLoginDestination } from "@/lib/auth/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const t = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" }
  });

  const onSubmit = async (values: FormValues) => {
    setErrorCode(null);
    try {
      const user = await loginAction(values.email, values.password);
      router.replace(postLoginDestination(user));
    } catch (error) {
      setErrorCode(error instanceof ApiAuthError ? error.code : "UNKNOWN_ERROR");
    }
  };

  return (
    <GuestShell>
      <div className="text-center">
        <h2 className="mt-6 text-3xl font-bold">{t("loginTitle")}</h2>
        <p className="text-muted-foreground mt-2 text-sm">{t("loginSubtitle")}</p>
      </div>

      <form className="mt-8 space-y-6" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        {errorCode ? (
          <Alert variant="destructive">
            <AlertDescription>
              {tErrors.has(errorCode) ? tErrors(errorCode) : tErrors("UNKNOWN_ERROR")}
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-4">
          <div>
            <Label htmlFor="email" className="sr-only">
              {t("email")}
            </Label>
            <InputGroup>
              <InputGroupAddon>
                <MailIcon />
              </InputGroupAddon>
              <InputGroupInput
                id="email"
                type="email"
                autoComplete="email"
                placeholder={t("email")}
                aria-invalid={!!form.formState.errors.email}
                {...form.register("email")}
              />
            </InputGroup>
            {form.formState.errors.email ? (
              <p className="text-destructive mt-1 text-xs">{t("emailInvalid")}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="password" className="sr-only">
              {t("password")}
            </Label>
            <InputGroup>
              <InputGroupAddon>
                <LockIcon />
              </InputGroupAddon>
              <InputGroupInput
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder={t("password")}
                aria-invalid={!!form.formState.errors.password}
                {...form.register("password")}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  size="icon-xs"
                  aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                  onClick={() => setShowPassword((prev) => !prev)}>
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>
          <div className="text-end">
            <Link href="/forgot-password" className="ml-auto inline-block text-sm underline">
              {t("forgotPassword")}
            </Link>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t("signingIn") : t("signIn")}
        </Button>
      </form>

      <div className="mt-6">
        <div className="flex items-center gap-3">
          <div className="w-full border-t" />
          <span className="text-muted-foreground shrink-0 text-sm">{t("orContinueWith")}</span>
          <div className="w-full border-t" />
        </div>

        <div className="mt-6">
          <GoogleButton />
        </div>

        <div className="mt-6 text-center text-sm">
          {t("noAccount")}{" "}
          <Link href="/register" className="underline">
            {t("signUp")}
          </Link>
        </div>
      </div>
    </GuestShell>
  );
}
