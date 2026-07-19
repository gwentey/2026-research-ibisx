// Miroir front de `xai_text.humanize_feature` / `format_share` (apps/api) : mêmes règles,
// mêmes arrondis — le texte du LLM, les replis et les graphiques citent les mêmes nombres.

/** `cat__Sex_female` → « Sex = female », `num_median_0__Pclass` → « Pclass ». */
export function humanizeFeature(name: string): string {
  const sep = name.indexOf("__");
  if (sep === -1) return name;
  const transformer = name.slice(0, sep);
  const rest = name.slice(sep + 2);
  if (!rest) return name;
  if (transformer === "cat" && rest.includes("_")) {
    const cut = rest.lastIndexOf("_");
    return `${rest.slice(0, cut).replace(/_/g, " ")} = ${rest.slice(cut + 1)}`;
  }
  return rest.replace(/_/g, " ");
}

/** « 24 % », « <1 % » sous 0,5 % — demi-parts vers le haut, comme le back. */
export function formatShare(value: number, total: number): string {
  if (total <= 0) return "0 %";
  const pct = (Math.abs(value) / total) * 100;
  return pct < 0.5 ? "<1 %" : `${Math.round(pct)} %`;
}

/** Arrondi lisible 3 décimales max ; les non-nombres passent tels quels. */
export function roundLabel(value: unknown): string {
  if (value === null || value === undefined) return "";
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || (typeof value === "string" && value.trim() === "")) {
    return String(value);
  }
  return String(Math.round(num * 1000) / 1000);
}
