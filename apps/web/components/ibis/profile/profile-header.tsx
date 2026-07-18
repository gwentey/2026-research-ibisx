"use client";

import { useTranslations } from "next-intl";
import { BrainIcon, CalendarIcon, CoinsIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemGroup, ItemMedia } from "@/components/ui/item";
import { useAvatarUrl, userInitials } from "@/components/ibis/use-avatar";
import type { UserRead } from "@/lib/api/generated";

// Bannière-identité (signature P11) : monogramme sur halo radial gradient (tokens
// primary/chart-2 uniquement) + méta réelles (rôle, niveau d'explications, crédits,
// expertise, ancienneté). Volontairement distincte du header à tuile-icône du wizard :
// ici le sujet est une PERSONNE (avatar), pas une étape (icône). Aucune donnée inventée.
export function ProfileHeader({ user }: { user: UserRead }) {
  const t = useTranslations("profile");
  const avatarUrl = useAvatarUrl();

  const displayName =
    user.pseudo?.trim() ||
    [user.given_name, user.family_name].filter(Boolean).join(" ").trim() ||
    user.email;

  const memberSince = new Intl.DateTimeFormat(user.locale, { dateStyle: "long" }).format(
    new Date(user.created_at)
  );

  return (
    <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/8 via-chart-2/8 to-transparent p-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {/* Halo radial — texture réservée à cette page (pas de champ de points, pas de conique) */}
            <div
              aria-hidden
              className="absolute top-1/2 left-1/2 size-28 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl"
              style={{
                background:
                  "radial-gradient(circle, color-mix(in oklch, var(--primary) 26%, transparent), color-mix(in oklch, var(--chart-2) 16%, transparent) 55%, transparent 75%)"
              }}
            />
            <Avatar className="ring-background relative size-16 shadow-sm ring-4 sm:size-20">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
              <AvatarFallback className="bg-gradient-to-br from-primary/15 to-chart-2/15 text-base font-semibold">
                {userInitials(user.pseudo, user.email)}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">{displayName}</h1>
              <Badge variant="outline">{t(`role.${user.role}`)}</Badge>
              <Badge variant="secondary">{t(`audience.${user.xai_audience}`)}</Badge>
            </div>
            <p className="text-muted-foreground truncate text-sm">{user.email}</p>
          </div>
        </div>

        <ItemGroup className="divide-border grid grid-cols-1 divide-y overflow-hidden rounded-lg border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Item size="sm" className="rounded-none">
            <ItemMedia variant="icon">
              <CoinsIcon />
            </ItemMedia>
            <ItemContent>
              <p className="text-sm">
                <span className="font-medium">{user.credits}</span>{" "}
                <span className="text-muted-foreground">· {t("statCredits")}</span>
              </p>
            </ItemContent>
          </Item>
          <Item size="sm" className="rounded-none">
            <ItemMedia variant="icon">
              <BrainIcon />
            </ItemMedia>
            <ItemContent>
              <p className="text-sm">
                <span className="font-medium">
                  {user.ai_familiarity !== null ? `${user.ai_familiarity}/5` : "—"}
                </span>{" "}
                <span className="text-muted-foreground">· {t("statExpertise")}</span>
              </p>
            </ItemContent>
          </Item>
          <Item size="sm" className="rounded-none">
            <ItemMedia variant="icon">
              <CalendarIcon />
            </ItemMedia>
            <ItemContent>
              <p className="text-muted-foreground text-sm">
                {t("memberSince", { date: memberSince })}
              </p>
            </ItemContent>
          </Item>
        </ItemGroup>
      </div>
    </div>
  );
}
