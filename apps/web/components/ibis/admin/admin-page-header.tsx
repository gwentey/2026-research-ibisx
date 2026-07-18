import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * En-tête de section admin — tuile-icône + titre + compteur, cohérent avec
 * le langage graphique global (wizard-shell, projects/page.tsx…).
 * Surface 13 (admin) : sobre, aucun gradient — voir docs/refonte/00-synthese.md.
 */
export function AdminPageHeader({
  icon: Icon,
  title,
  count,
  subtitle,
  actions
}: {
  icon: LucideIcon;
  title: string;
  count?: number;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
          <Icon className="size-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {title}
            {count !== undefined ? (
              <span className="text-muted-foreground ml-2 align-middle text-base font-normal">
                · {count}
              </span>
            ) : null}
          </h1>
          <p className="text-muted-foreground mt-0.5 max-w-2xl text-sm">{subtitle}</p>
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
