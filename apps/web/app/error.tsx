"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LayoutDashboardIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StateIllustration } from "@/components/ibis/states/state-illustration";
import { StatePage } from "@/components/ibis/states/state-page";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("states");

  return (
    <StatePage
      icon={TriangleAlertIcon}
      title={t("errorTitle")}
      body={t("errorBody")}
      illustration={<StateIllustration variant="error" />}
      actions={
        <>
          <Button onClick={() => reset()}>{t("retry")}</Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <LayoutDashboardIcon />
              {t("backDashboard")}
            </Link>
          </Button>
        </>
      }
    />
  );
}
