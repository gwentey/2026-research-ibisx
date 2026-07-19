"use client";

import { useState, type ReactNode } from "react";
import { CheckCircle2Icon, SparklesIcon, WandSparklesIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Motif d'aide IA UNIQUE et réutilisable (demandé par Anthony). Partout où une étape propose
// une assistance IA, on annonce la même chose, de la même façon, avec les mêmes gestes :
//  - FERMÉ  → une barre pleine largeur, pointillée, teintée IA (« Une recommandation IA est
//             disponible » + déclencheur « Guide-moi avec l'IA ») : plus de bouton solitaire
//             en haut à droite qui laisse un grand vide.
//  - OUVERT → le panneau pointillé + dégradé violet→bleu (couleur IA), en-tête « Assistance
//             IA », le conseil, puis deux actions cohérentes : « Appliquer la recommandation
//             IA » et « Je choisis moi-même ».
//  - À la fermeture (appliquer OU décliner) → le bloc pointillé ÉCLATE comme une bulle
//             (ai-burst + éclats ai-shard), puis se replie sur la barre fermée.
// Couleurs = tokens IA uniquement (--ai / --ai-violet / --ai-blue), définis clair + sombre.

const SHARDS = [
  { tx: "-46px", ty: "-30px", delay: "0ms" },
  { tx: "44px", ty: "-34px", delay: "30ms" },
  { tx: "-58px", ty: "18px", delay: "60ms" },
  { tx: "56px", ty: "24px", delay: "20ms" },
  { tx: "-12px", ty: "-46px", delay: "80ms" },
  { tx: "18px", ty: "40px", delay: "50ms" }
];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Bloc d'aide IA complet et réutilisable.
 * @param onApply  applique la recommandation (met à jour le store de l'étape). Optionnel :
 *                 sans lui, seul « Je choisis moi-même » est proposé (panneau informatif).
 */
export function AiAssist({
  title,
  guideLabel,
  availableLabel,
  applyLabel,
  chooseLabel,
  onApply,
  children,
  defaultOpen = false,
  className
}: {
  title: string;
  guideLabel: string;
  availableLabel: string;
  applyLabel: string;
  chooseLabel: string;
  onApply?: () => void;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  // Par défaut FERMÉ : à l'arrivée sur une étape, on n'assène pas le conseil — on annonce
  // seulement « une recommandation IA est disponible ». L'utilisateur ouvre s'il le souhaite.
  const [phase, setPhase] = useState<"open" | "bursting" | "closed">(
    defaultOpen ? "open" : "closed"
  );

  const close = (apply: boolean) => {
    if (apply) onApply?.();
    if (prefersReducedMotion()) {
      setPhase("closed");
      return;
    }
    setPhase("bursting");
  };

  // Barre fermée : pleine largeur, pointillée, teintée IA. Plus aucun vide à gauche.
  if (phase === "closed") {
    return (
      <button
        type="button"
        onClick={() => setPhase("open")}
        className={cn(
          "border-ai/40 from-ai-violet/5 to-ai-blue/5 hover:border-ai/60 hover:from-ai-violet/10 hover:to-ai-blue/10 group flex w-full items-center gap-3 rounded-xl border border-dashed bg-gradient-to-r px-4 py-3 text-left transition-colors",
          className
        )}>
        <span className="bg-ai/15 text-ai flex size-7 shrink-0 items-center justify-center rounded-md">
          <SparklesIcon className="size-4" />
        </span>
        <span className="text-ai/90 min-w-0 flex-1 text-sm font-medium">{availableLabel}</span>
        <span className="border-ai/50 text-ai group-hover:bg-ai/10 inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium">
          <WandSparklesIcon className="size-3.5" />
          {guideLabel}
        </span>
      </button>
    );
  }

  const bursting = phase === "bursting";

  return (
    <div
      className={cn(
        "from-ai-violet/10 via-ai/5 to-ai-blue/10 border-ai/40 relative space-y-3 rounded-xl border border-dashed bg-gradient-to-br p-4",
        bursting ? "ai-burst pointer-events-none" : "ai-pop-in",
        className
      )}
      onAnimationEnd={(event) => {
        // Ne réagir qu'à l'animation du panneau lui-même (pas des enfants), et uniquement
        // à la fin de l'éclatement.
        if (event.target === event.currentTarget && bursting) setPhase("closed");
      }}>
      {/* Éclats de la « bulle » qui filent vers l'extérieur pendant l'éclatement. */}
      {bursting ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
          {SHARDS.map((shard, index) => (
            <span
              key={index}
              className="ai-shard text-ai absolute top-1/2 left-1/2"
              style={
                {
                  "--tx": shard.tx,
                  "--ty": shard.ty,
                  animationDelay: shard.delay
                } as React.CSSProperties
              }>
              <SparklesIcon className="size-4" />
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <span className="bg-ai/15 text-ai flex size-6 shrink-0 items-center justify-center rounded-md">
          <SparklesIcon className="size-3.5" />
        </span>
        <span className="text-ai text-sm font-semibold">{title}</span>
      </div>

      {children}

      <div className="flex flex-wrap gap-2 pt-1">
        {onApply ? (
          <Button
            size="sm"
            className="bg-ai text-ai-foreground hover:bg-ai/90"
            onClick={() => close(true)}>
            <CheckCircle2Icon />
            {applyLabel}
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={() => close(false)}>
          <XIcon />
          {chooseLabel}
        </Button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------------------------
// Primitives conservées (compat) : utilisées par datasets/guide-tab.tsx. Le nouveau motif
// unifié ci-dessus (AiAssist) est à préférer pour toute nouvelle assistance.

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
