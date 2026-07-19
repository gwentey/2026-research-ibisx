"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronDownIcon, SlidersHorizontalIcon } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * Section « Détails avancés » : replie (jamais ne supprime — P1) les blocs de résultats
 * au-dessus du niveau effectif. Un novice curieux peut déplier ; l'expert n'en a pas besoin
 * (aucun bloc n'y tombe pour lui, la section ne s'affiche donc pas).
 */
export function AdvancedDetails({ children }: { children: ReactNode }) {
  const t = useTranslations("audience");
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border border-dashed">
      <CollapsibleTrigger className="hover:bg-muted/40 flex w-full items-center gap-3 rounded-xl p-4 text-left transition-colors">
        <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
          <SlidersHorizontalIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t("advancedTitle")}</p>
          <p className="text-muted-foreground text-xs">{t("advancedHint")}</p>
        </div>
        <ChevronDownIcon
          className={cn("text-muted-foreground size-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 p-4 pt-0">{children}</CollapsibleContent>
    </Collapsible>
  );
}
