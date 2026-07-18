import type { LucideIcon } from "lucide-react";

import { Label } from "@/components/ui/label";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { cn } from "@/lib/utils";

// Carte-choix incarnée (plan 03, bloc pillé : onboarding-flow/account-type-step.tsx l.44-73) —
// icône + libellé + description optionnelle. ⚠️ Contrat e2e : `title` doit TOUJOURS être seul
// dans son propre `<ItemTitle>` (jamais concaténé à `description` ou à un eyebrow dans le même
// nœud texte), sinon `getByText(title, { exact: true })` ne matche plus rien côté test.
//
// La sélection est pilotée par l'état React du parent (prop `selected`), pas par un sélecteur
// CSS `peer-data-[state=checked]` — plus simple et déjà la convention de cette page.

export function ChoiceCard({
  id,
  value,
  icon: Icon,
  title,
  description,
  selected,
  orientation = "grid",
  mediaClassName,
  eyebrow
}: {
  id: string;
  value: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  selected: boolean;
  orientation?: "grid" | "row";
  /** Classe de teinte de la tuile icône (ex. jauge de familiarité chart-5→chart-1). */
  mediaClassName?: string;
  /** Élément décoratif isolé (ex. numéro de niveau) — jamais dans le même nœud que `title`. */
  eyebrow?: string;
}) {
  return (
    <div className="relative">
      <RadioGroupItem value={value} id={id} className="sr-only" />
      {/* Label = wrapper cliquable (association explicite via htmlFor, pas besoin d'imbrication
          avec le radio). Item/ItemMedia/ItemContent restent des `div` normaux à l'intérieur —
          pas de `asChild`/Slot ici, pour garder un merge de classes prévisible via `cn()`. */}
      <Label htmlFor={id} className="flex h-full cursor-pointer">
        <Item
          variant="outline"
          size={orientation === "row" ? "default" : "sm"}
          className={cn(
            "hover:border-primary/50 h-full w-full transition-colors",
            selected && "border-primary bg-primary/5",
            orientation === "grid" && "flex-col items-start gap-3 text-left"
          )}>
          <ItemMedia
            variant="icon"
            className={cn(
              "size-9 rounded-lg border-0 [&_svg:not([class*='size-'])]:size-4.5",
              mediaClassName ?? (selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")
            )}>
            <Icon aria-hidden="true" />
          </ItemMedia>
          <ItemContent>
            <div className="flex items-center gap-2">
              {eyebrow ? (
                <span aria-hidden="true" className="text-muted-foreground font-mono text-xs">
                  {eyebrow}
                </span>
              ) : null}
              <ItemTitle>{title}</ItemTitle>
            </div>
            {description ? <ItemDescription>{description}</ItemDescription> : null}
          </ItemContent>
        </Item>
      </Label>
    </div>
  );
}
