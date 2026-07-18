import { getTranslations } from "next-intl/server";
import {
  BarChart3Icon,
  BrainCircuitIcon,
  CheckIcon,
  DatabaseIcon,
  EraserIcon,
  RocketIcon,
  Settings2Icon,
  SlidersHorizontalIcon,
  SplitIcon,
  TargetIcon,
  type LucideIcon
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ibis/progress-ring";
import { MiniImportanceChart } from "@/components/ibis/landing/mini-importance-chart";
import { cn } from "@/lib/utils";

// Signature de la landing (docs/refonte/01-landing.md) : le hero ne promet pas, il MONTRE
// le produit — une « fenêtre d'app » qui reconstruit fidèlement, en vrais composants
// tokens, le rail du wizard (wizard-shell.tsx) et le mini graphe d'importance
// (explanation-view.tsx), figée sur l'étape 6. Server Component pur (aucun useState) :
// seul le mini graphe (MiniImportanceChart) est un sous-bloc client, pour limiter le JS
// envoyé à un visiteur public non authentifié.
//
// Les icônes par étape miroitent volontairement `STEP_ICONS` de wizard-shell.tsx : elles
// sont redéclarées ici (au lieu d'être importées) car ce fichier reste un Server Component
// et wizard-shell.tsx est un module "use client" — indexer un export non-composant d'un
// tel module depuis le serveur n'est pas un contrat fiable de React Server Components.
const MOCK_STEPS: { id: number; icon: LucideIcon }[] = [
  { id: 1, icon: DatabaseIcon },
  { id: 2, icon: TargetIcon },
  { id: 3, icon: EraserIcon },
  { id: 4, icon: SplitIcon },
  { id: 5, icon: SlidersHorizontalIcon },
  { id: 6, icon: BrainCircuitIcon },
  { id: 7, icon: Settings2Icon },
  { id: 8, icon: RocketIcon },
  { id: 9, icon: BarChart3Icon }
];
const MOCK_STEP = 6;

function stepState(id: number) {
  return id < MOCK_STEP ? "done" : id === MOCK_STEP ? "current" : "locked";
}

export async function HeroPreview() {
  const t = await getTranslations("landing");
  const tWizard = await getTranslations("wizard");
  const tXai = await getTranslations("xai");
  const HeaderIcon = MOCK_STEPS[MOCK_STEP - 1].icon;

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="gap-0 overflow-hidden py-0 shadow-lg">
        {/* Barre de titre — device frame (3 pastilles + libellé réel + badge honnêteté) */}
        <div className="bg-muted/40 flex items-center gap-3 border-b px-4 py-2.5">
          <div className="flex gap-1.5" aria-hidden>
            <span className="bg-foreground/15 size-2.5 rounded-full" />
            <span className="bg-foreground/15 size-2.5 rounded-full" />
            <span className="bg-foreground/15 size-2.5 rounded-full" />
          </div>
          <p className="text-muted-foreground truncate text-xs font-medium">
            {tWizard("title")} · {tWizard("stepOf", { current: MOCK_STEP, total: 9 })}
          </p>
          <Badge variant="outline" className="ml-auto shrink-0">
            {t("preview.exampleBadge")}
          </Badge>
        </div>

        <div className="grid lg:grid-cols-[10rem_1fr]">
          {/* Rail mini (desktop) — réplique réduite de wizard-shell.tsx lignes 115-145 */}
          <nav aria-hidden className="hidden shrink-0 flex-col gap-0.5 border-r p-3 lg:flex">
            {MOCK_STEPS.map(({ id, icon: Icon }) => {
              const state = stepState(id);
              return (
                <div
                  key={id}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-1.5 py-1 text-xs",
                    state === "current" && "bg-primary/10 text-primary font-medium",
                    state === "locked" && "text-muted-foreground/50"
                  )}>
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-medium",
                      state === "current" && "border-primary bg-primary text-primary-foreground",
                      state === "done" && "border-primary/40 bg-primary/10 text-primary",
                      state === "locked" && "border-border/60"
                    )}>
                    {state === "done" ? <CheckIcon className="size-2.5" /> : id}
                  </span>
                  <Icon className="size-3 shrink-0" />
                </div>
              );
            })}
          </nav>

          {/* Bandeau compact (mobile) — même logique que wizard-shell.tsx lignes 163-182 */}
          <div aria-hidden className="flex gap-1 overflow-x-auto border-b p-2 lg:hidden">
            {MOCK_STEPS.map(({ id }) => {
              const state = stepState(id);
              return (
                <span
                  key={id}
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    state === "current" && "border-primary bg-primary text-primary-foreground",
                    state === "done" && "border-primary/40 text-primary",
                    state === "locked" && "text-muted-foreground/50"
                  )}>
                  {id}
                </span>
              );
            })}
          </div>

          <div className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <HeaderIcon className="size-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-semibold tracking-tight">
                    {tWizard(`steps.${MOCK_STEP}` as never)}
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {tWizard(`subtitles.${MOCK_STEP}` as never)}
                  </p>
                </div>
              </div>
              <div className="relative shrink-0">
                <ProgressRing value={Math.round((MOCK_STEP / 9) * 100)} size={40} strokeWidth={3.5} />
                <span className="text-foreground absolute inset-0 grid place-items-center text-[10px] font-semibold">
                  {MOCK_STEP}
                </span>
              </div>
            </div>

            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium">
                {tXai("charts.importance", { method: "SHAP" })}
              </p>
              <MiniImportanceChart />
            </div>
          </div>
        </div>
      </Card>
      <p className="text-muted-foreground mt-3 text-center text-xs">{t("preview.caption")}</p>
    </div>
  );
}
