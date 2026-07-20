/**
 * Guide IA d'un dataset (CDC §5.4.4) — deux garanties que les tests unitaires ne couvrent pas :
 *   1. l'utilisateur sait ce que le bouton va produire AVANT de le cliquer (bloc GuideIntro) ;
 *   2. le guide généré est rendu en BLOCS RICHES (tuiles, tableau, callout), pas en texte plat.
 *
 * S'exécute contre la stack Docker Compose seedée (`docker compose exec api ibis seed`) :
 * le dataset embarqué « Abalone » sert de support. Le repli déterministe produit les mêmes
 * types de blocs que l'IA — les assertions de structure tiennent donc sans clé LLM.
 */

import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

type Messages = Record<string, never>;

function loadMessages(locale: string): Messages {
  return JSON.parse(
    readFileSync(path.join(__dirname, "..", "messages", `${locale}.json`), "utf8")
  );
}

function t(messages: Messages, key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], messages);
  if (typeof value !== "string") throw new Error(`Clé i18n manquante : ${key}`);
  return value;
}

test("guide IA : intention annoncée avant génération, puis rendu en blocs riches", async ({
  page,
  context,
  baseURL
}) => {
  const m = loadMessages("fr");
  const email = `e2e-guide-${Date.now()}@example.org`;
  const password = "E2e-s3cret-pass";

  await context.addCookies([
    { name: "ibis_locale", value: "fr", url: baseURL ?? "http://localhost:3000" }
  ]);

  // --- Inscription + onboarding (3 questions) ------------------------------------------
  await page.goto("/register");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: t(m, "auth.signUp") }).click();

  await page.waitForURL("**/onboarding");
  await page.getByText(t(m, "onboarding.education.master"), { exact: true }).click();
  await page.getByRole("button", { name: t(m, "common.next"), exact: true }).click();
  await page.locator('input[type="number"]').fill("28");
  await page.getByRole("button", { name: t(m, "common.next"), exact: true }).click();
  await page.getByText(t(m, "onboarding.familiarity.4"), { exact: true }).click();
  await page.getByRole("button", { name: t(m, "onboarding.submit") }).click();
  await page.waitForURL("**/dashboard");

  // --- Fiche du dataset embarqué « Abalone » -------------------------------------------
  await page.goto("/datasets");
  await page.getByRole("link", { name: /Abalone/i }).first().click();
  await page.waitForURL(/\/datasets\/[0-9a-f-]{36}/);

  await page.getByRole("tab", { name: t(m, "datasets.detail.tabGuide") }).click();

  // --- 1. AVANT génération : l'intention est annoncée -----------------------------------
  // Si un guide existe déjà (base non vierge / relance du test), l'explication est repliée :
  // on la déplie, ce qui vérifie du même coup le comportement du mode collapsible.
  const toggle = page.getByRole("button", { name: t(m, "datasets.detail.guideAboutToggle") });
  if (await toggle.isVisible().catch(() => false)) await toggle.click();

  await expect(page.getByText(t(m, "datasets.detail.guideAboutTitle"))).toBeVisible();
  await expect(page.getByText(t(m, "datasets.detail.guideAboutLead"))).toBeVisible();
  // Les 4 sections que le guide produira sont listées nommément.
  for (const key of ["S1", "S2", "S3", "S4"]) {
    await expect(
      page.getByText(t(m, `datasets.detail.guideAbout${key}Title`), { exact: true })
    ).toBeVisible();
  }
  // Le bénéfice concret et l'honnêteté du procédé sont dits avant l'action.
  await expect(page.getByText(t(m, "datasets.detail.guideAboutHelp"))).toBeVisible();
  await expect(page.getByText(t(m, "datasets.detail.guideAboutHonesty"))).toBeVisible();

  // --- 2. Génération --------------------------------------------------------------------
  // « Générer » sur une fiche vierge, « Régénérer » si un guide existe déjà.
  const generate = page.getByRole("button", { name: t(m, "datasets.detail.guideGenerate") });
  const regenerate = page.getByRole("button", { name: t(m, "datasets.detail.guideRegenerate") });
  await ((await generate.isVisible().catch(() => false)) ? generate : regenerate).click();

  // Le guide est prêt quand la date de génération s'affiche (LLM réel ou repli déterministe).
  const generatedOn = page.getByText(/Généré le /);
  await expect(generatedOn).toBeVisible({ timeout: 180_000 });

  // --- 3. Rendu en blocs riches, pas en texte plat --------------------------------------
  // Portée limitée à la carte du guide : les titres de section existent aussi dans le bloc
  // d'explication, qui reste dépliable par l'utilisateur.
  const guideCard = page.locator("div").filter({ has: generatedOn }).last();
  // Tableau (colonnes cibles plausibles / tâches) — le marqueur le plus net de la v2.
  await expect(guideCard.locator("table").first()).toBeVisible();
  // Les 4 titres de section sont rendus comme des blocs heading.
  await expect(guideCard.getByText("À quoi sert ce dataset", { exact: true })).toBeVisible();
  await expect(guideCard.getByText("Précautions", { exact: true })).toBeVisible();

  // --- 4. L'explication se replie d'elle-même une fois le guide affiché ------------------
  // Régression : `collapsible` passe de false à true sans remonter GuideIntro — un état
  // initialisé une seule fois laissait le panneau ouvert et repoussait le guide hors écran.
  await expect(
    page.getByRole("button", { name: t(m, "datasets.detail.guideAboutToggle") })
  ).toBeVisible();
  await expect(page.getByText(t(m, "datasets.detail.guideAboutLead"))).toBeHidden();
});
