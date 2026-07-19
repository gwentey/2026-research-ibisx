// « Regards métier » — catalogue des 6 disciplines SHS (contenu éditorial = i18n `lenses.<id>`).
// Ici seulement le typage + l'icône ; aucun texte en dur (produit bilingue FR/EN).

import {
  CompassIcon,
  LandmarkIcon,
  ScaleIcon,
  ScrollIcon,
  TrendingUpIcon,
  UsersIcon,
  type LucideIcon
} from "lucide-react";

import { LENS_IDS, type LensId } from "./types";

export interface LensMeta {
  id: LensId;
  icon: LucideIcon;
}

export const LENSES: Record<LensId, LensMeta> = {
  economist: { id: "economist", icon: TrendingUpIcon },
  jurist: { id: "jurist", icon: ScaleIcon },
  politist: { id: "politist", icon: LandmarkIcon },
  sociologist: { id: "sociologist", icon: UsersIcon },
  historian: { id: "historian", icon: ScrollIcon },
  ethicist: { id: "ethicist", icon: CompassIcon }
};

export const LENS_LIST: LensMeta[] = LENS_IDS.map((id) => LENSES[id]);
