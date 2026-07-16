"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CoinsIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PreferencesTab } from "@/components/ibis/profile/preferences-tab";
import { ProfileTab } from "@/components/ibis/profile/profile-tab";
import { SecurityTab } from "@/components/ibis/profile/security-tab";
import { useAuthStore } from "@/lib/auth/store";

const TABS = ["profile", "security", "preferences", "credits"] as const;

function ProfileContent() {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);

  const requested = searchParams.get("tab") ?? "profile";
  const defaultTab = (TABS as readonly string[]).includes(requested) ? requested : "profile";

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </div>
        <Badge variant="outline">{t(`role.${user.role}`)}</Badge>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">{t("tabProfile")}</TabsTrigger>
          <TabsTrigger value="security">{t("tabSecurity")}</TabsTrigger>
          <TabsTrigger value="preferences">{t("tabPreferences")}</TabsTrigger>
          <TabsTrigger value="credits">{t("tabCredits")}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab user={user} />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab user={user} />
        </TabsContent>
        <TabsContent value="preferences">
          <PreferencesTab user={user} />
        </TabsContent>
        <TabsContent value="credits">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("tabCredits")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <CoinsIcon className="text-muted-foreground size-5" />
                <span className="text-2xl font-semibold">
                  {tCommon("credits", { count: user.credits })}
                </span>
              </div>
              <p className="text-muted-foreground text-sm">{t("creditsHelp")}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <ProfileContent />
    </Suspense>
  );
}
