"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { LanguagesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { updateMe } from "@/lib/api/generated";
import { useAuthStore } from "@/lib/auth/store";

export function LanguageSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { status, user } = useAuthStore();

  const switchTo = async (next: Locale) => {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    if (status === "authenticated" && user) {
      const { data } = await updateMe({ body: { locale: next }, throwOnError: false });
      if (data) useAuthStore.getState().setUser(data);
    }
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={t("language")}>
          <LanguagesIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => void switchTo("fr")}
          className={locale === "fr" ? "bg-muted" : undefined}>
          {t("french")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => void switchTo("en")}
          className={locale === "en" ? "bg-muted" : undefined}>
          {t("english")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
