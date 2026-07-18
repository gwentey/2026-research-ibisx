"use client";

import { useTranslations } from "next-intl";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { ProfilesResponse } from "@/lib/api/generated";

export type Weights = Record<string, number>;

interface WeightsPanelProps {
  criteria: string[];
  profiles: ProfilesResponse | null;
  weights: Weights;
  activeProfile: string | null;
  onChange: (weights: Weights, profile: string | null) => void;
}

/** Barre empilée à 100 % : chaque segment = le poids effectif d'un critère actif,
 *  en nuances monochromes (sobre — la couleur de la rampe est réservée à la heatmap). */
function NormalizedTotalBar({ criteria, weights }: { criteria: string[]; weights: Weights }) {
  const active = criteria.filter((criterion) => criterion in weights);
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (active.length === 0 || total <= 0) {
    return <div className="bg-muted h-2 w-full rounded-full" />;
  }
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full">
      {active.map((criterion, index) => {
        const share = (weights[criterion] / total) * 100;
        const intensity = 30 + ((index * 18) % 60);
        return (
          <div
            key={criterion}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${share}%`,
              backgroundColor: `color-mix(in oklch, var(--primary) ${intensity}%, var(--card))`
            }}
          />
        );
      })}
    </div>
  );
}

/** Panneau de pondération (CDC §6.4) — version dense : résumé mis en valeur en tête,
 *  seuls les critères ACTIFS déploient leur slider, les inactifs se rangent en chips
 *  cliquables (un clic → poids 0.5). Profils prédéfinis + réinitialiser conservés. */
export function WeightsPanel({
  criteria,
  profiles,
  weights,
  activeProfile,
  onChange
}: WeightsPanelProps) {
  const t = useTranslations("scoring");

  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  const activeCriteria = criteria.filter((criterion) => criterion in weights);
  const inactiveCriteria = criteria.filter((criterion) => !(criterion in weights));
  const activeCount = activeCriteria.length;

  const setWeight = (criterion: string, value: number) => {
    const next = { ...weights };
    if (value <= 0) delete next[criterion];
    else next[criterion] = Math.round(value * 100) / 100;
    onChange(next, null);
  };

  const applyProfile = (name: string) => {
    const profile = profiles?.profiles.find((p) => p.name === name);
    if (profile) onChange({ ...profile.weights }, name);
  };

  const reset = () => {
    if (profiles) onChange({ ...profiles.default_weights }, null);
  };

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{t("weightsTitle")}</CardTitle>
          <span className="text-muted-foreground text-xs">
            {t("activeCriteria", { count: activeCount })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <span className="text-muted-foreground mr-1 text-xs">{t("profiles")} :</span>
          {(profiles?.profiles ?? []).map((profile) => (
            <Button
              key={profile.name}
              size="sm"
              variant={activeProfile === profile.name ? "secondary" : "outline"}
              onClick={() => applyProfile(profile.name)}>
              {t(`profile.${profile.name}` as never)}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={reset}>
            {t("reset")}
          </Button>
        </div>

        {/* Résumé mis en valeur : part normalisée de chaque critère + total. */}
        <div className="bg-muted/40 space-y-1.5 rounded-lg border p-3">
          <NormalizedTotalBar criteria={criteria} weights={weights} />
          <p className="text-muted-foreground text-xs">
            {t("normalizedTotal", { total: totalWeight.toFixed(2) })}
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 border-t pt-4">
        {/* Critères actifs : sliders déployés. */}
        {activeCriteria.map((criterion) => {
          const weight = weights[criterion] ?? 0;
          const effective = totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0;
          return (
            <div key={criterion} className="border-border/60 space-y-2 rounded-md border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-2 text-sm font-normal">
                  <Switch
                    checked
                    onCheckedChange={(checked) => setWeight(criterion, checked ? 0.5 : 0)}
                  />
                  {t(`criteria.${criterion}` as never)}
                </Label>
                <span className="text-muted-foreground shrink-0 font-mono text-xs">
                  {weight.toFixed(2)} · {effective}% {t("effective")}
                </span>
              </div>
              <Slider
                value={[weight]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={([value]) => setWeight(criterion, value)}
              />
            </div>
          );
        })}

        {/* Critères inactifs : chips compactes, un clic pour activer. */}
        {inactiveCriteria.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs">{t("addCriteria")}</p>
            <div className="flex flex-wrap gap-1.5">
              {inactiveCriteria.map((criterion) => (
                <button
                  key={criterion}
                  type="button"
                  onClick={() => setWeight(criterion, 0.5)}
                  className="border-border text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-muted inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors">
                  <PlusIcon className="size-3" />
                  {t(`criteria.${criterion}` as never)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
