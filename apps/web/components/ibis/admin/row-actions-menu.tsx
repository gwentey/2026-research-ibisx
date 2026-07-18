import { Fragment } from "react";
import type { LucideIcon } from "lucide-react";
import { MoreHorizontalIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export interface RowAction {
  key: string;
  label: string;
  icon?: LucideIcon;
  onSelect?: () => void;
  href?: string;
  variant?: "default" | "destructive";
  disabled?: boolean;
  separatorBefore?: boolean;
}

/**
 * Menu d'actions par ligne (dropdown-menu) — densité tabulaire admin (surface 13) :
 * remplace les rangées de boutons par un trigger unique « … ».
 */
export function RowActionsMenu({ actions, label }: { actions: RowAction[]; label: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) => (
          <Fragment key={action.key}>
            {action.separatorBefore ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              variant={action.variant}
              disabled={action.disabled}
              asChild={Boolean(action.href)}
              onSelect={(event) => {
                if (action.href) return;
                event.preventDefault();
                action.onSelect?.();
              }}>
              {action.href ? (
                <Link href={action.href}>
                  {action.icon ? <action.icon /> : null}
                  {action.label}
                </Link>
              ) : (
                <>
                  {action.icon ? <action.icon /> : null}
                  {action.label}
                </>
              )}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
