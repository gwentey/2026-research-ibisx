import {
  ActivityIcon,
  DatabaseIcon,
  FlaskConicalIcon,
  FolderIcon,
  HomeIcon,
  ListChecksIcon,
  ScaleIcon,
  UsersIcon,
  type LucideIcon
} from "lucide-react";

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
  { labelKey: "datasets", href: "/datasets", icon: DatabaseIcon },
  { labelKey: "projects", href: "/projects", icon: FolderIcon },
  { labelKey: "experiments", href: "/experiments", icon: FlaskConicalIcon },
  { labelKey: "systemStatus", href: "/status", icon: ActivityIcon }
];

export interface AdminNavItem {
  labelKey: "adminUsers" | "adminDatasets" | "adminEthicalTemplates" | "adminJobs";
  href: string;
  icon: LucideIcon;
}

// Visible UNIQUEMENT pour le rôle admin — la sécurité reste côté backend (J8).
export const ADMIN_NAV: AdminNavItem[] = [
  { labelKey: "adminUsers", href: "/admin/users", icon: UsersIcon },
  { labelKey: "adminDatasets", href: "/admin/datasets", icon: DatabaseIcon },
  { labelKey: "adminEthicalTemplates", href: "/admin/ethical-templates", icon: ScaleIcon },
  { labelKey: "adminJobs", href: "/admin/jobs", icon: ListChecksIcon }
];
