import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// Layout partagé des pages d'état (404 / error) — refonte P3, lot 14. Consommé par
// `app/not-found.tsx` (Server Component) et `app/error.tsx` (Client Component) pour
// garantir la même grammaire visuelle entre les deux variantes sans dupliquer le
// markup. Composant pur (aucun hook) : compatible Server et Client Component.
// Reprend la tuile-icône du header wizard (bg-primary/10 text-primary rounded-xl +
// icône lucide size-6) sous l'illustration, cf. wizard-shell.tsx.

export function StatePage({
  icon: Icon,
  title,
  body,
  illustration,
  actions
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  illustration: ReactNode;
  actions: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-12 text-center">
      <div className="w-full max-w-sm">{illustration}</div>

      <div className="max-w-md space-y-3">
        <div className="bg-primary/10 text-primary mx-auto flex size-12 items-center justify-center rounded-xl">
          <Icon className="size-6" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        <p className="text-muted-foreground text-sm">{body}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">{actions}</div>
    </main>
  );
}
