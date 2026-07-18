"use client";

import type { ReactNode } from "react";
import { SparklesIcon, WandSparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Motif d'aide IA UNIQUE et réutilisable (demandé par Anthony) : partout où une carte
// propose une assistance IA, on annonce la même chose, de la même façon.
//  - <AiAssistButton> : déclencheur discret en HAUT À DROITE d'une carte (« Guide-moi
//    avec l'IA »), en accent IA indigo.
//  - <AiAssistPanel> : le contenu d'aide, présenté en carte à BORDURE POINTILLÉE + DÉGRADÉ
//    violet → bleu (couleur IA), avec un petit en-tête « Assistance IA ».
// Couleurs = tokens uniquement (--ai / --ai-violet / --ai-blue), définis clair + sombre.

/** Déclencheur « Guide-moi avec l'IA » — à poser dans le coin haut-droite d'une carte. */
export function AiAssistButton({
  open,
  onToggle,
  label
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-expanded={open}
      onClick={onToggle}
      className="border-ai/50 text-ai hover:border-ai hover:bg-ai/10 hover:text-ai gap-1.5">
      <WandSparklesIcon className="size-4" />
      {label}
    </Button>
  );
}

/** Panneau d'aide IA : bordure pointillée + dégradé violet→bleu, en-tête « Assistance IA ». */
export function AiAssistPanel({
  title,
  children,
  className
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "from-ai-violet/10 via-ai/5 to-ai-blue/10 space-y-3 rounded-xl border border-dashed bg-gradient-to-br p-4",
        "border-ai/40",
        className
      )}>
      <div className="flex items-center gap-2">
        <span className="bg-ai/15 text-ai flex size-6 shrink-0 items-center justify-center rounded-md">
          <SparklesIcon className="size-3.5" />
        </span>
        <span className="text-ai text-sm font-semibold">{title}</span>
      </div>
      {children}
    </div>
  );
}
