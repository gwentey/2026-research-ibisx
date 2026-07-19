"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { bootstrapSession } from "@/lib/auth/session";
import { useAuthStore } from "@/lib/auth/store";

// /status vit HORS du shell applicatif (aucune sidebar, aucun header) : un
// utilisateur connecté qui suit le lien « État du système » n'a plus aucun
// chemin de retour. On restaure la session pour distinguer les deux publics de
// cette page publique — visiteur anonyme (aucun lien) vs utilisateur de l'app
// (retour au tableau de bord). P5 : jamais perdu.
export function BackToAppLink() {
  const t = useTranslations("status");
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    void bootstrapSession();
  }, []);

  if (status !== "authenticated") return null;

  return (
    <Button variant="ghost" size="sm" asChild className="text-muted-foreground -ml-2 w-fit">
      <Link href="/dashboard">
        <ArrowLeftIcon />
        {t("backToDashboard")}
      </Link>
    </Button>
  );
}
