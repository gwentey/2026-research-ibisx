import {
  BellIcon,
  BrainCircuitIcon,
  BuildingIcon,
  CookieIcon,
  DatabaseIcon,
  FileTextIcon,
  GavelIcon,
  HeartHandshakeIcon,
  KeyRoundIcon,
  LockIcon,
  LogOutIcon,
  ScaleIcon,
  ServerIcon,
  ShareIcon,
  ShieldAlertIcon,
  SparklesIcon,
  TimerIcon,
  UploadIcon,
  UserCheckIcon,
  UserPlusIcon,
  type LucideIcon
} from "lucide-react";

// Plan des documents légaux. Les `id` sont des ancres publiques (#cookies, #google) :
// ils sont cités depuis l'écran de consentement OAuth et depuis des liens externes —
// ne jamais les renommer, même lors d'une réécriture du texte.
export type LegalSection = { id: string; icon: LucideIcon };

export const PRIVACY_SECTIONS: LegalSection[] = [
  { id: "controller", icon: BuildingIcon },
  { id: "data", icon: DatabaseIcon },
  { id: "purposes", icon: ScaleIcon },
  { id: "google", icon: KeyRoundIcon },
  { id: "ai", icon: BrainCircuitIcon },
  { id: "recipients", icon: ShareIcon },
  { id: "retention", icon: TimerIcon },
  { id: "rights", icon: UserCheckIcon },
  { id: "cookies", icon: CookieIcon },
  { id: "security", icon: LockIcon },
  { id: "changes", icon: BellIcon }
];

export const TERMS_SECTIONS: LegalSection[] = [
  { id: "purpose", icon: FileTextIcon },
  { id: "service", icon: SparklesIcon },
  { id: "account", icon: UserPlusIcon },
  { id: "acceptable", icon: HeartHandshakeIcon },
  { id: "content", icon: UploadIcon },
  { id: "ai", icon: BrainCircuitIcon },
  { id: "availability", icon: ServerIcon },
  { id: "liability", icon: ShieldAlertIcon },
  { id: "termination", icon: LogOutIcon },
  { id: "law", icon: GavelIcon },
  { id: "changes", icon: BellIcon }
];
