"use client";

import * as React from "react";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import Logo from "@/components/layout/logo";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from "@/components/ui/sidebar";
import { useIsTablet } from "@/hooks/use-mobile";
import { ADMIN_NAV, MAIN_NAV } from "@/components/ibis/layout/nav-config";
import { IbisNavUser } from "@/components/ibis/layout/ibis-nav-user";
import { useAuthStore } from "@/lib/auth/store";

export function IbisSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const { setOpen, setOpenMobile, isMobile } = useSidebar();
  const isTablet = useIsTablet();
  const isAdmin = useAuthStore((state) => state.user?.role === "admin");

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname]);

  useEffect(() => {
    setOpen(!isTablet);
  }, [isTablet]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="hover:text-foreground h-10 group-data-[collapsible=icon]:px-0!">
              <Link href="/dashboard">
                <Logo />
                <span className="text-foreground font-semibold">{tCommon("appName")}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="h-full">
          <SidebarGroup>
            <SidebarGroupLabel>{t("platform")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {MAIN_NAV.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      tooltip={t(item.labelKey)}
                      isActive={pathname.startsWith(item.href)}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{t(item.labelKey)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {isAdmin ? (
            <SidebarGroup>
              <SidebarGroupLabel>{t("administration")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {ADMIN_NAV.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        tooltip={t(item.labelKey)}
                        isActive={pathname.startsWith(item.href)}>
                        <Link href={item.href}>
                          <item.icon />
                          <span>{t(item.labelKey)}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter>
        <IbisNavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
