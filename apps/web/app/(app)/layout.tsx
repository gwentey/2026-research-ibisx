import React from "react";
import { cookies } from "next/headers";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppGuard } from "@/components/ibis/auth-guard";
import { IbisHeader } from "@/components/ibis/layout/ibis-header";
import { IbisSidebar } from "@/components/ibis/layout/ibis-sidebar";
import { QuestTracker } from "@/components/ibis/challenges/quest-tracker";

// Layout applicatif : structure identique au layout (auth) du template (P6).
export default async function AppLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const defaultOpen =
    cookieStore.get("sidebar_state")?.value === "true" ||
    cookieStore.get("sidebar_state") === undefined;

  return (
    <AppGuard>
      <SidebarProvider
        defaultOpen={defaultOpen}
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 64)",
            "--header-height": "calc(var(--spacing) * 14)",
            "--content-padding": "calc(var(--spacing) * 4)",
            "--content-margin": "calc(var(--spacing) * 1.5)",
            "--content-full-height":
              "calc(100vh - var(--header-height) - (var(--content-padding) * 2) - (var(--content-margin) * 2))"
          } as React.CSSProperties
        }>
        <IbisSidebar variant="inset" />
        <SidebarInset>
          <IbisHeader />
          <div className="bg-muted/40 flex flex-1 flex-col">
            <div className="@container/main p-(--content-padding) xl:group-data-[theme-content-layout=centered]/layout:container xl:group-data-[theme-content-layout=centered]/layout:mx-auto">
              {children}
            </div>
          </div>
          <QuestTracker />
        </SidebarInset>
      </SidebarProvider>
    </AppGuard>
  );
}
