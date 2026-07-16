"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { ProfilesResponse } from "@/lib/api/generated";
import { cn } from "@/lib/utils";

export type Weights = Record<string, number>;

interface WeightsPanelProps {
  criteria: string[];
  profiles: ProfilesResponse | null;
  weights: Weights;
  activeProfile: string | null;
  onChange: (weights: Weights, profile: string | null) => void;
}

/** Panneau de pondération (CDC §6.4) : slider 0→1 pas 0.05 par critère activé,
 *  % effectif normalisé, profils en un clic, réinitialiser. */
export function WeightsPanel({
  criteria,
  profiles,
  weights,
  activeProfile,
  onChange
}: WeightsPanelProps) {
  const t = useTranslations("scoring");

  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);

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
        <CardTitle className="text-base">{t("weightsTitle")}</CardTitle>
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
      </CardHeader>
      <CardContent className="space-y-3">
        {criteria.map((criterion) => {
          const active = criterion in weights;
          const weight = weights[criterion] ?? 0;
          const effective = totalWeight > 0 ? Math.round((weight / totalWeight) * 100) : 0;
          return (
            <div key={criterion} className={cn("space-y-1", !active && "opacity-60")}>
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-2 text-sm font-normal">
                  <Switch
                    checked={active}
                    onCheckedChange={(checked) => setWeight(criterion, checked ? 0.5 : 0)}
                  />
                  {t(`criteria.${criterion}` as never)}
                </Label>
                {active ? (
                  <span className="text-muted-foreground font-mono text-xs">
                    {weight.toFixed(2)} · {effective}% {t("effective")}
                  </span>
                ) : null}
              </div>
              {active ? (
                <Slider
                  value={[weight]}
                  min={0}
                  max={1}
                  step={0.05}
                  onValueChange={([value]) => setWeight(criterion, value)}
                />
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
