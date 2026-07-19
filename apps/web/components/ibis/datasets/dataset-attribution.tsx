"use client";

import { useTranslations } from "next-intl";
import { BadgeCheckIcon, UsersIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DatasetOwner } from "@/lib/api/generated";
import { cn } from "@/lib/utils";

/**
 * Attribution d'un dataset : « importé par <avatar> <pseudo> », plus le badge de confiance.
 *
 * L'attribution n'est pas décorative — c'est le garde-fou social du catalogue ouvert :
 * un import fantaisiste porte le nom de qui l'a fait.
 */
export function DatasetAttribution({
  owner,
  isVerified,
  className,
  compact = false
}: {
  owner?: DatasetOwner | null;
  isVerified?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslations("datasets.attribution");

  if (isVerified) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className={cn("gap-1", className)}>
            <BadgeCheckIcon className="size-3.5" />
            {t("verified")}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{t("verifiedHint")}</TooltipContent>
      </Tooltip>
    );
  }

  if (!owner) {
    return null;
  }

  const label = owner.pseudo?.trim() || t("anonymous");
  const initials = label.slice(0, 2).toUpperCase();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Avatar className="size-6">
        {owner.has_avatar ? (
          <AvatarImage src={`/api/v1/users/${owner.id}/avatar`} alt={label} />
        ) : null}
        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
      </Avatar>
      <span className="text-muted-foreground truncate text-xs">
        {compact ? label : t("importedBy", { name: label })}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1 text-[10px]">
            <UsersIcon className="size-3" />
            {t("community")}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{t("communityHint")}</TooltipContent>
      </Tooltip>
    </div>
  );
}
