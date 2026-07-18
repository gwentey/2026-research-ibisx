import { CheckIcon, LoaderCircleIcon, XIcon } from "lucide-react";

import {
  Timeline,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle
} from "@/components/ui/timeline";
import { cn } from "@/lib/utils";

export type SmokeState = "idle" | "running" | "completed" | "failed";

// Timeline du smoke test SSE (P6/lot 6, doc 12-status.md) : remplace le <ul> de logs
// brut. Chaque `log_line` reçu via EventSource devient un jalon ; le dernier jalon
// porte l'icône d'état vivant (spinner/coche/croix) reflétant le statut courant du job.
export function SmokeTimeline({ state, logs }: { state: SmokeState; logs: string[] }) {
  return (
    <Timeline defaultValue={logs.length}>
      {logs.map((line, index) => {
        const isLast = index === logs.length - 1;
        const failedHere = isLast && state === "failed";
        const runningHere = isLast && state === "running";

        return (
          <TimelineItem key={index} step={index + 1} className="pb-6">
            <TimelineHeader>
              <TimelineSeparator />
              <TimelineTitle className="-mt-0.5 font-mono text-xs font-normal break-words">
                {line}
              </TimelineTitle>
              <TimelineIndicator
                className={cn(
                  "bg-background flex items-center justify-center",
                  failedHere && "border-destructive/50",
                  runningHere && "border-primary/50",
                  !failedHere && !runningHere && "border-primary/30"
                )}>
                {failedHere ? (
                  <XIcon className="text-destructive size-2" />
                ) : runningHere ? (
                  <LoaderCircleIcon className="text-primary size-2 animate-spin" />
                ) : (
                  <CheckIcon className="text-primary size-2" />
                )}
              </TimelineIndicator>
            </TimelineHeader>
          </TimelineItem>
        );
      })}
    </Timeline>
  );
}
