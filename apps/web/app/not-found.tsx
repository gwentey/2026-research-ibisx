import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LayoutDashboardIcon, SearchXIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StateIllustration } from "@/components/ibis/states/state-illustration";
import { StatePage } from "@/components/ibis/states/state-page";

export default async function NotFound() {
  const t = await getTranslations("states");

  return (
    <StatePage
      icon={SearchXIcon}
      title={t("notFoundTitle")}
      body={t("notFoundBody")}
      illustration={<StateIllustration variant="not-found" />}
      actions={
        <>
          <Button asChild>
            <Link href="/dashboard">
              <LayoutDashboardIcon />
              {t("backDashboard")}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">{t("backHome")}</Link>
          </Button>
        </>
      }
    />
  );
}
