import { MinusIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ⚠️ Contrat e2e : reste l'UNIQUE `input[type="number"]` de la page. Les boutons −/+ sont de
// simples `<button>` qui appellent `onChange` — aucun second input natif n'est introduit ici.

export function AgeStepper({
  id,
  value,
  onChange,
  min,
  max,
  invalid,
  decrementLabel,
  incrementLabel
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  invalid?: boolean;
  decrementLabel: string;
  incrementLabel: string;
}) {
  const current = Number(value);
  const hasValue = value !== "" && Number.isInteger(current);

  const step = (delta: number) => {
    const base = hasValue ? current : delta > 0 ? min - 1 : max + 1;
    const next = Math.min(max, Math.max(min, base + delta));
    onChange(String(next));
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={decrementLabel}
        disabled={hasValue && current <= min}
        onClick={() => step(-1)}>
        <MinusIcon />
      </Button>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={invalid}
        className="w-24 text-center text-lg font-semibold tabular-nums"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={incrementLabel}
        disabled={hasValue && current >= max}
        onClick={() => step(1)}>
        <PlusIcon />
      </Button>
    </div>
  );
}
