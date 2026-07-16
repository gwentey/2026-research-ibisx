"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiAuthError, finishGoogleLogin, postLoginDestination } from "@/lib/auth/session";

function GoogleCallback() {
  const t = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    // Strict Mode double-invoque les effets : l'échange du code est à usage unique.
    if (startedRef.current) return;
    startedRef.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!code || !state) {
      setErrorCode("INVALID_OAUTH_STATE");
      return;
    }
    finishGoogleLogin(code, state)
      .then((user) => router.replace(postLoginDestination(user)))
      .catch((error: unknown) => {
        setErrorCode(error instanceof ApiAuthError ? error.code : "UNKNOWN_ERROR");
      });
  }, [searchParams, router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        {errorCode ? (
          <>
            <Alert variant="destructive">
              <AlertDescription>
                {tErrors.has(errorCode) ? tErrors(errorCode) : tErrors("UNKNOWN_ERROR")}
              </AlertDescription>
            </Alert>
            <Link href="/login" className="text-sm underline">
              {t("backToLogin")}
            </Link>
          </>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">{t("googleFinalizing")}</p>
            <Skeleton className="mx-auto h-2 w-48" />
          </>
        )}
      </div>
    </main>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-24 h-32 w-full max-w-md" />}>
      <GoogleCallback />
    </Suspense>
  );
}
