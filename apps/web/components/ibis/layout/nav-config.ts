import { ActivityIcon, HomeIcon, type LucideIcon } from "lucide-react";

// Navigation de l'app — UNIQUEMENT des routes vivantes (P5 : zéro lien mort).
// Chaque jalon ajoute ses entrées (datasets J2, projets J4, expériences J5, admin J8).

export interface NavItem {
  /** Clé de traduction dans le namespace `nav`. */
  labelKey: "dashboard" | "datasets" | "projects" | "experiments" | "systemStatus";
  href: string;
  icon: LucideIcon;
}

export const MAIN_NAV: NavItem[] = [
  { labelKey: "dashboard", href: "/dashboard", icon: HomeIcon },
  { labelKey: "systemStatus", href: "/status", icon: ActivityIcon }
];
