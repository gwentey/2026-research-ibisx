import { cn } from "@/lib/utils";

// Pastille d'état (P6/lot 6, doc 12-status.md) : point FIXE, sans animation.
// Vert = "ok", rouge (destructive) = "down", neutre = "checking" (aucun zoom/pulse).
export type ServiceHealthState = "ok" | "down" | "checking";

const DOT_TONE: Record<ServiceHealthState, string> = {
  ok: "bg-green-500 dark:bg-green-400",
  down: "bg-destructive",
  checking: "bg-muted-foreground/40"
};

export function ServiceStatusDot({
  state,
  className
}: {
  state: ServiceHealthState;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex size-2.5 shrink-0 rounded-full", DOT_TONE[state], className)}
      aria-hidden="true"
    />
  );
}
