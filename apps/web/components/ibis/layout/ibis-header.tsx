"use client";

import { CoinsIcon, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTranslations } from "next-intl";

import ThemeSwitch from "@/components/layout/header/theme-switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import { LanguageSwitcher } from "@/components/ibis/language-switcher";
import { useAuthStore } from "@/lib/auth/store";

// Header applicatif — même structure/classes que le SiteHeader du template (P6),
// sans les éléments promotionnels du kit.
export function IbisHeader() {
  const tCommon = useTranslations("common");
  const { toggleSidebar, open } = useSidebar();
  const user = useAuthStore((state) => state.user);

  return (
    <header className="bg-background/40 sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-2 border-b backdrop-blur-md transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) md:rounded-tl-xl md:rounded-tr-xl">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2">
        <Button onClick={toggleSidebar} size="icon" variant="ghost">
          {open ? <PanelLeftClose /> : <PanelLeftOpen />}
        </Button>
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <Badge variant="outline" className="gap-1 font-mono">
              <CoinsIcon className="size-3.5" />
              {tCommon("credits", { count: user.credits })}
            </Badge>
          ) : null}
          <LanguageSwitcher />
          <ThemeSwitch />
        </div>
      </div>
    </header>
  );
}
