"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/lib/auth/store";

// Accueil provisoire J1 — le vrai dashboard (KPI réels, activités) arrive au J7.
// P1 : aucun chiffre fictif ici, uniquement un état d'accueil explicite.
export default function DashboardPage() {
  const t = useTranslations("dashboardHome");
  const user = useAuthStore((state) => state.user);
  const name = user?.pseudo || user?.given_name;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {name ? t("welcome", { name }) : t("welcomeFallback")}
      </h1>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("placeholderTitle")}</CardTitle>
          <CardDescription>{t("placeholderBody")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/status">{t("seeStatus")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
