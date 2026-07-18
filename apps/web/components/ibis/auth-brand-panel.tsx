"use client";

import { useTranslations } from "next-intl";
import { DatabaseIcon, RouteIcon, ShieldCheckIcon, type LucideIcon } from "lucide-react";

import Logo from "@/components/layout/logo";

// Panneau de marque des pages invité (login/register/forgot/reset-password) — refonte 02.
// Remplace la photo stock du template (`/images/extra/image4.jpg`) par un fond tonal +
// un chemin en pointillés à 9 jalons : la promesse du wizard, montrée avant même d'y entrer.
// Un seul composant, un seul contenu source : deux rendus internes pilotés par les classes
// responsive (panneau plein desktop en `lg:flex`, bande compacte mobile en `lg:hidden`).

const MILESTONES = [
  { x: 90, y: 50 },
  { x: 190, y: 120 },
  { x: 120, y: 240 }, // jalon 3 : "vous êtes ici", avant le grand voyage
  { x: 260, y: 320 },
  { x: 150, y: 440 },
  { x: 290, y: 520 },
  { x: 170, y: 640 },
  { x: 270, y: 740 },
  { x: 190, y: 840 }
] as const;

const HERE_INDEX = 2;

const COMPACT_MILESTONES = [
  { x: 10, y: 60 },
  { x: 80, y: 25 },
  { x: 150, y: 65 }, // jalon "vous êtes ici", cohérent avec la version desktop
  { x: 220, y: 20 }
] as const;

const COMPACT_HERE_INDEX = 2;

function trailPath(points: ReadonlyArray<{ x: number; y: number }>) {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
}

function TrailMilestones({
  points,
  hereIndex
}: {
  points: ReadonlyArray<{ x: number; y: number }>;
  hereIndex: number;
}) {
  return (
    <>
      {points.map((p, i) =>
        i === hereIndex ? (
          <circle key={i} cx={p.x} cy={p.y} r={7} className="fill-primary" />
        ) : (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={6}
            fill="none"
            strokeWidth={2}
            className="stroke-primary/25"
          />
        )
      )}
    </>
  );
}

// Motif plein — panneau desktop : chemin diagonal complet + 2 grands cercles
// concentriques très estompés en coin bas-droit (esprit ProgressRing, purement décoratif).
function TrailPatternDesktop() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 900"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full">
      <circle cx={380} cy={860} r={260} fill="none" strokeWidth={1} className="stroke-primary/10" />
      <circle cx={380} cy={860} r={180} fill="none" strokeWidth={1} className="stroke-primary/10" />
      <path
        d={trailPath(MILESTONES)}
        fill="none"
        strokeWidth={2}
        strokeDasharray="2 10"
        strokeLinecap="round"
        className="stroke-foreground/10"
      />
      <TrailMilestones points={MILESTONES} hereIndex={HERE_INDEX} />
    </svg>
  );
}

// Motif rogné — bande mobile : quelques jalons visibles, pas les cercles concentriques.
function TrailPatternCompact() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 260 90"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full">
      <path
        d={trailPath(COMPACT_MILESTONES)}
        fill="none"
        strokeWidth={2}
        strokeDasharray="2 8"
        strokeLinecap="round"
        className="stroke-foreground/10"
      />
      <TrailMilestones points={COMPACT_MILESTONES} hereIndex={COMPACT_HERE_INDEX} />
    </svg>
  );
}

function ProofTile({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function AuthBrandPanel() {
  const t = useTranslations("auth");

  const proofs: Array<{ icon: LucideIcon; label: string }> = [
    { icon: DatabaseIcon, label: t("panel.proofDatasets") },
    { icon: ShieldCheckIcon, label: t("panel.proofEthics") },
    { icon: RouteIcon, label: t("panel.proofSteps") }
  ];

  return (
    <>
      {/* Panneau plein — desktop (lg+) */}
      <div className="bg-muted/30 dark:bg-muted/20 relative hidden w-1/2 flex-col overflow-hidden lg:flex">
        <div className="from-primary/[0.06] to-chart-2/[0.12] absolute inset-0 bg-gradient-to-br via-transparent" />
        <TrailPatternDesktop />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="text-lg font-semibold tracking-tight">IBIS-X</span>
          </div>

          <div className="max-w-sm space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight text-balance">
                {t("panel.tagline")}
              </h2>
              <p className="text-muted-foreground text-sm">{t("panel.subtitle")}</p>
            </div>
            <div className="space-y-3">
              {proofs.map((proof) => (
                <ProofTile key={proof.label} icon={proof.icon} label={proof.label} />
              ))}
            </div>
          </div>

          <p className="text-muted-foreground text-xs">{t("panel.researchNote")}</p>
        </div>
      </div>

      {/* Bande compacte — mobile/tablette (< lg) */}
      <div className="bg-muted/30 dark:bg-muted/20 relative flex h-24 w-full shrink-0 items-center overflow-hidden lg:hidden">
        <div className="from-primary/[0.06] to-chart-2/[0.12] absolute inset-0 bg-gradient-to-br via-transparent" />
        <TrailPatternCompact />
        <div className="relative z-10 flex items-center gap-2 px-4">
          <Logo />
          <span className="text-sm font-semibold tracking-tight">IBIS-X</span>
          <span className="text-muted-foreground text-xs">· {t("panel.compactLabel")}</span>
        </div>
      </div>
    </>
  );
}
