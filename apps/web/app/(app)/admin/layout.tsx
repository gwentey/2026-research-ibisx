"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShieldIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { ADMIN_NAV } from "@/components/ibis/layout/nav-config";
import { useAuthStore } from "@/lib/auth/store";

/**
 * Layout admin — back-office dense (surface 13, docs/refonte/00-synthese.md) :
 * en-tête sobre + sous-navigation à onglets (ADMIN_NAV). Garde UX (la sécurité
 * réelle est backend — chaque route /admin revérifie en base).
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tAdmin = useTranslations("admin");
  const user = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (status === "authenticated" && user && user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [status, user, router]);

  if (!user || user.role !== "admin") return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
          <ShieldIcon className="size-4.5" />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight">{t("administration")}</h2>
          <p className="text-muted-foreground text-xs">{tAdmin("layout.subtitle")}</p>
        </div>
      </div>

      <nav
        aria-label={tAdmin("layout.nav")}
        className="flex flex-wrap gap-1 border-b">
        {ADMIN_NAV.map((item) => {
          const active = pathname?.startsWith(item.href) ?? false;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground border-transparent"
              )}>
              <item.icon className="size-4" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
