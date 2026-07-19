"use client";

import { ConfusionPlayground } from "@/components/ibis/formation/blocks/confusion-playground";
import { OverfittingPlayground } from "@/components/ibis/formation/blocks/overfitting-playground";
import type { PlaygroundKind } from "@/lib/formation/types";

// B3 — Bac à sable. Aiguille vers le composant interactif selon la variante déclarée au catalogue.
export function PlaygroundBlock({ kind }: { kind: PlaygroundKind }) {
  switch (kind) {
    case "confusion-threshold":
      return <ConfusionPlayground />;
    case "overfitting-depth":
      return <OverfittingPlayground />;
    default:
      return null;
  }
}
