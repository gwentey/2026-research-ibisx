// Source de vérité UNIQUE du langage visuel par domaine (refonte P6).
// Consommé par le catalogue (dataset-card) ET la fiche détail (dataset-detail-header).
// Thème monochrome : les tokens --chart-1..5 sont des NUANCES neutres, pas des teintes —
// la différenciation se fait par nuance + motif SVG + icône + monogramme, jamais par une
// couleur inventée. Toutes les classes chart-* sont écrites en toutes lettres (JIT Tailwind).

import {
  BriefcaseIcon,
  CpuIcon,
  DatabaseIcon,
  FlaskConicalIcon,
  GraduationCapIcon,
  HeartPulseIcon,
  LeafIcon,
  LineChartIcon,
  SproutIcon,
  UsersIcon,
  type LucideIcon
} from "lucide-react";

import type { DomainPatternId } from "@/components/ibis/datasets/domain-pattern";

export type ChartToken = "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5";

/** Fragments de classes littérales par token (Tailwind ne voit que les chaînes complètes). */
export interface DomainTone {
  /** Fond doux de vignette / bandeau. */
  bgSoft: string;
  /** Fond de tuile-icône. */
  bgTile: string;
  /** Texte / icône à la nuance. */
  text: string;
  /** Motif SVG (opacité intégrée). */
  patternText: string;
  /** Départ de gradient tonal. */
  gradientFrom: string;
}

const TONES: Record<ChartToken, DomainTone> = {
  "chart-1": {
    bgSoft: "bg-chart-1/10",
    bgTile: "bg-chart-1/20",
    text: "text-chart-1",
    patternText: "text-chart-1/20",
    gradientFrom: "from-chart-1/15"
  },
  "chart-2": {
    bgSoft: "bg-chart-2/10",
    bgTile: "bg-chart-2/20",
    text: "text-chart-2",
    patternText: "text-chart-2/20",
    gradientFrom: "from-chart-2/15"
  },
  "chart-3": {
    bgSoft: "bg-chart-3/10",
    bgTile: "bg-chart-3/20",
    text: "text-chart-3",
    patternText: "text-chart-3/20",
    gradientFrom: "from-chart-3/15"
  },
  "chart-4": {
    bgSoft: "bg-chart-4/10",
    bgTile: "bg-chart-4/20",
    text: "text-chart-4",
    patternText: "text-chart-4/20",
    gradientFrom: "from-chart-4/15"
  },
  "chart-5": {
    bgSoft: "bg-chart-5/15",
    bgTile: "bg-chart-5/25",
    text: "text-foreground",
    patternText: "text-chart-5/30",
    gradientFrom: "from-chart-5/20"
  }
};

export interface DomainVisual {
  /** Clé de domaine normalisée (ou la chaîne brute si inconnue). */
  key: string;
  chartToken: ChartToken;
  icon: LucideIcon;
  pattern: DomainPatternId;
  /** Monogramme fantôme (2 lettres). */
  monogram: string;
  /** Clé i18n `datasets.domains.<key>` (repli : chaîne brute). */
  labelKey: string;
  tone: DomainTone;
}

interface DomainSpec {
  chartToken: ChartToken;
  icon: LucideIcon;
  pattern: DomainPatternId;
  monogram: string;
}

// Mapping figé (cf. docs/refonte/05-catalogue.md). Les 9 domaines connus (constants.ts).
const DOMAIN_SPECS: Record<string, DomainSpec> = {
  education: { chartToken: "chart-3", icon: GraduationCapIcon, pattern: "grid", monogram: "ED" },
  healthcare: { chartToken: "chart-1", icon: HeartPulseIcon, pattern: "cross", monogram: "HC" },
  finance: { chartToken: "chart-2", icon: LineChartIcon, pattern: "chevrons", monogram: "FI" },
  social: { chartToken: "chart-4", icon: UsersIcon, pattern: "dots", monogram: "SO" },
  biology: { chartToken: "chart-5", icon: LeafIcon, pattern: "waves", monogram: "BI" },
  business: { chartToken: "chart-3", icon: BriefcaseIcon, pattern: "diagonals", monogram: "BU" },
  environment: { chartToken: "chart-1", icon: SproutIcon, pattern: "rings", monogram: "EN" },
  technology: { chartToken: "chart-2", icon: CpuIcon, pattern: "circuit", monogram: "TE" },
  research: { chartToken: "chart-4", icon: FlaskConicalIcon, pattern: "hatch", monogram: "RE" }
};

const FALLBACK_TOKENS: ChartToken[] = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];

/** Hash déterministe simple → index stable pour les domaines inconnus. */
function hashIndex(value: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash % modulo;
}

/** Retourne le langage visuel d'un domaine (repli gracieux si inconnu/absent). */
export function getDomainVisual(domain: string | null | undefined): DomainVisual {
  const key = (domain ?? "").trim().toLowerCase();
  const spec = DOMAIN_SPECS[key];

  if (spec) {
    return {
      key,
      chartToken: spec.chartToken,
      icon: spec.icon,
      pattern: spec.pattern,
      monogram: spec.monogram,
      labelKey: `domains.${key}`,
      tone: TONES[spec.chartToken]
    };
  }

  // Domaine inconnu : token stable par hash, icône/motif génériques, monogramme = 2 lettres.
  const token = key ? FALLBACK_TOKENS[hashIndex(key, FALLBACK_TOKENS.length)] : "chart-1";
  const monogram = key ? key.slice(0, 2).toUpperCase() : "DS";
  return {
    key,
    chartToken: token,
    icon: DatabaseIcon,
    pattern: "dots",
    monogram,
    labelKey: `domains.${key}`,
    tone: TONES[token]
  };
}

/** Premier domaine d'un dataset (ou repli). */
export function primaryDomainVisual(domains: string[] | null | undefined): DomainVisual {
  return getDomainVisual(domains?.[0]);
}
