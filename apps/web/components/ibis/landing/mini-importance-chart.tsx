"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";

import { ChartContainer } from "@/components/ui/chart";

// Aperçu produit (hero landing, docs/refonte/01-landing.md) : reconstitution du mini
// graphe d'importance de `explanation-view.tsx` (mêmes primitives Recharts/ChartContainer,
// même token chart-1), avec des valeurs ILLUSTRATIVES — aucun entraînement n'a eu lieu
// pour un visiteur non connecté. Le badge "Exemple" (rendu par le parent, hero-preview.tsx)
// et la légende sous la carte portent l'honnêteté de ce composant (règle P0 §3).
// Seul sous-bloc client de la landing : isolé ici pour garder hero-preview.tsx en Server
// Component et limiter le JS envoyé à un visiteur public non authentifié.
const EXAMPLE_DATA = [
  { feature: "petal_length", value: 0.44 },
  { feature: "petal_width", value: 0.29 },
  { feature: "sepal_length", value: 0.18 },
  { feature: "sepal_width", value: 0.09 }
];

const chartConfig = { value: { label: "", color: "var(--chart-1)" } };

export function MiniImportanceChart() {
  return (
    <ChartContainer config={chartConfig} className="w-full" style={{ height: 132 }}>
      <BarChart data={EXAMPLE_DATA} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          dataKey="feature"
          type="category"
          width={82}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10 }}
        />
        <Bar dataKey="value" fill="var(--chart-1)" radius={3} barSize={12} />
      </BarChart>
    </ChartContainer>
  );
}
