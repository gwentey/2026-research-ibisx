"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { bootstrapSession, postLoginDestination } from "@/lib/auth/session";
import { useAuthStore } from "@/lib/auth/store";

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-4 px-8">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}

/** Pages applicatives : session requise + onboarding complété (P5 : jamais perdu). */
export function AppGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status, user } = useAuthStore();

  useEffect(() => {
    void bootstrapSession();
  }, []);

  useEffect(() => {
    if (status === "guest") router.replace("/login");
    else if (status === "authenticated" && user && !user.onboarding_completed)
      router.replace("/onboarding");
  }, [status, user, router]);

  if (status !== "authenticated" || !user) return <FullPageLoader />;
  if (!user.onboarding_completed) return <FullPageLoader />;
  return <>{children}</>;
}

/** Pages invité (login…) : un utilisateur connecté est renvoyé dans l'app. */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status, user } = useAuthStore();

  useEffect(() => {
    void bootstrapSession();
  }, []);

  useEffect(() => {
    if (status === "authenticated" && user) router.replace(postLoginDestination(user));
  }, [status, user, router]);

  if (status === "loading") return <FullPageLoader />;
  if (status === "authenticated") return <FullPageLoader />;
  return <>{children}</>;
}

/** Onboarding : session requise ; déjà complété → dashboard. */
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status, user } = useAuthStore();

  useEffect(() => {
    void bootstrapSession();
  }, []);

  useEffect(() => {
    if (status === "guest") router.replace("/login");
    else if (status === "authenticated" && user?.onboarding_completed)
      router.replace("/dashboard");
  }, [status, user, router]);

  if (status !== "authenticated" || !user || user.onboarding_completed) {
    return <FullPageLoader />;
  }
  return <>{children}</>;
}
