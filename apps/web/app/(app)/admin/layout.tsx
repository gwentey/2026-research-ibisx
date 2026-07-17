"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/lib/auth/store";

/** Garde UX : redirige les non-admins (la sécurité réelle est backend — chaque route /admin revérifie en base). */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (status === "authenticated" && user && user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [status, user, router]);

  if (!user || user.role !== "admin") return null;
  return <>{children}</>;
}
