import { cn } from "@/lib/utils";

// Pastille d'état vivante (P6/lot 6, doc 12-status.md) : réutilise le keyframe
// `pulse-dot` déjà défini dans app/globals.css (@theme inline). Le halo ne bat que
// pour l'état "ok" (signal vivant) ; "down" reste un point fixe (destructive, pas
// d'animation qui banaliserait une panne) ; "checking" est un point neutre statique.
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
    <span className={cn("relative inline-flex size-2.5 shrink-0", className)} aria-hidden="true">
      {state === "ok" ? (
        <span
          className={cn(
            "absolute inline-flex size-full animate-[pulse-dot_2s_ease-in-out_infinite] rounded-full opacity-70",
            DOT_TONE.ok
          )}
        />
      ) : null}
      <span className={cn("relative inline-flex size-2.5 rounded-full", DOT_TONE[state])} />
    </span>
  );
}
