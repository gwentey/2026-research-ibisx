/**
 * Parcours « Défis » (docs/parcours/CAHIER-DES-CHARGES.md) — mécanique d'orchestration :
 * bibliothèque → briefing → lancement dans le VRAI produit → traceur de quête actif.
 *
 * Le pipeline complet (entraînement réel + XAI + débrief) est déjà couvert de bout en bout
 * par mission.spec.ts ; ce test verrouille la surface propre aux Défis, en FR puis EN.
 */

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

type Messages = Record<string, never>;

function loadMessages(locale: string): Messages {
  const file = path.join(__dirname, "..", "messages", `${locale}.json`);
  return JSON.parse(readFileSync(file, "utf8"));
}

function t(messages: Messages, key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], messages);
  if (typeof value !== "string") throw new Error(`Clé i18n manquante : ${key}`);
  return value;
}

async function registerAndOnboard(
  page: Page,
  context: BrowserContext,
  baseURL: string | undefined,
  locale: "fr" | "en",
  m: Messages
): Promise<void> {
  const email = `e2e-challenge-${locale}-${Date.now()}@example.org`;
  const password = "E2e-s3cret-pass";

  await context.addCookies([
    { name: "ibis_locale", value: locale, url: baseURL ?? "http://localhost:3000" }
  ]);

  await page.goto("/register");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: t(m, "auth.signUp") }).click();

  await page.waitForURL("**/onboarding");
  await page.getByText(t(m, "onboarding.education.master"), { exact: true }).click();
  await page.getByRole("button", { name: t(m, "common.next"), exact: true }).click();
  await page.locator('input[type="number"]').fill("28");
  await page.getByRole("button", { name: t(m, "common.next"), exact: true }).click();
  await page.getByText(t(m, "onboarding.familiarity.2"), { exact: true }).click();
  await page.getByRole("button", { name: t(m, "onboarding.submit") }).click();
  await page.waitForURL("**/dashboard");
}

for (const locale of ["fr", "en"] as const) {
  test(`parcours Défis — bibliothèque, briefing, lancement, traceur (${locale})`, async ({
    page,
    context,
    baseURL
  }) => {
    const m = loadMessages(locale);
    await registerAndOnboard(page, context, baseURL, locale, m);

    // --- 1. Bibliothèque : 3 niveaux + 6 enquêtes -------------------------------------
    await page.goto("/challenges");
    await expect(page.getByRole("heading", { name: t(m, "challenges.title") })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: t(m, "challenges.levels.novice"), exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: t(m, "challenges.levels.confirme"), exact: true })
    ).toBeVisible();

    const titanicTitle = t(m, "challenges.items.titanic-1912.title");
    await expect(page.getByText(titanicTitle, { exact: true })).toBeVisible();

    // --- 2. Briefing ------------------------------------------------------------------
    await page.getByRole("link").filter({ hasText: titanicTitle }).click();
    await page.waitForURL("**/challenges/titanic-1912");
    await expect(
      page.getByRole("heading", { name: t(m, "challenges.briefingTitle") })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: t(m, "challenges.start"), exact: true })
    ).toBeVisible();

    // --- 3. Lancement : dépose sur la vraie fiche dataset, défi actif dans l'URL -------
    await page.getByRole("button", { name: t(m, "challenges.start"), exact: true }).click();
    await page.waitForURL(/\/datasets\/[0-9a-f-]{36}\?challenge=titanic-1912/, {
      timeout: 30_000
    });

    // --- 4. Traceur de quête présent, défi actif --------------------------------------
    await expect(page.getByText(titanicTitle).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: t(m, "challenges.quit") })
    ).toBeVisible();
  });
}
