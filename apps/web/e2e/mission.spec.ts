/**
 * Parcours mission complet (CDC §1.6, §12.4) — LE test d'acceptation final :
 * inscription → onboarding → projet → recommandations → wizard 9 étapes →
 * entraînement réel → résultats → explication SHAP → chat XAI.
 *
 * Exécuté en FR puis EN (cookie `ibis_locale`), piloté par les fichiers de
 * traduction — un libellé cassé dans une langue fait échouer le test.
 * [NE PAS REPRODUIRE] S9 : la v1 n'a jamais eu de e2e.
 */

import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

type Messages = Record<string, never>;

function loadMessages(locale: string): Messages {
  const file = path.join(__dirname, "..", "messages", `${locale}.json`);
  return JSON.parse(readFileSync(file, "utf8"));
}

/** Accès `a.b.c` dans le JSON de traduction (les clés existent — test i18n de parité). */
function t(messages: Messages, key: string): string {
  const value = key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], messages);
  if (typeof value !== "string") throw new Error(`Clé i18n manquante : ${key}`);
  return value;
}

async function clickWizardNext(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: label, exact: true }).click();
}

for (const locale of ["fr", "en"] as const) {
  test(`parcours mission complet (${locale})`, async ({ page, context, baseURL }) => {
    const m = loadMessages(locale);
    const email = `e2e-${locale}-${Date.now()}@example.org`;
    const password = "E2e-s3cret-pass";

    await context.addCookies([
      { name: "ibis_locale", value: locale, url: baseURL ?? "http://localhost:3000" }
    ]);

    // --- 1. Inscription -----------------------------------------------------------------
    await page.goto("/register");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: t(m, "auth.signUp") }).click();

    // --- 2. Onboarding (3 questions) ----------------------------------------------------
    await page.waitForURL("**/onboarding");
    await expect(page.getByText(t(m, "onboarding.title"))).toBeVisible();
    await page.getByText(t(m, "onboarding.education.master"), { exact: true }).click();
    await page.getByRole("button", { name: t(m, "common.next"), exact: true }).click();
    await page.locator('input[type="number"]').fill("28");
    await page.getByRole("button", { name: t(m, "common.next"), exact: true }).click();
    await page.getByText(t(m, "onboarding.familiarity.4"), { exact: true }).click();
    await page.getByRole("button", { name: t(m, "onboarding.submit") }).click();
    await page.waitForURL("**/dashboard");

    // --- 3. Création de projet ----------------------------------------------------------
    await page.goto("/projects/new");
    await page.getByPlaceholder(t(m, "projects.form.namePlaceholder")).fill(
      locale === "fr" ? "Mission e2e — décrochage" : "E2e mission — dropout"
    );
    await page.getByRole("button", { name: "→", exact: true }).click(); // critères (défauts)
    await page.getByRole("button", { name: "→", exact: true }).click(); // pondérations (défauts)
    await page.getByRole("button", { name: t(m, "projects.form.create") }).click();
    await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);

    // --- 4. Recommandations → wizard sur Iris (déterministe : 0 nettoyage) --------------
    const irisCard = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText("Iris", { exact: true }) });
    await irisCard.getByRole("link", { name: t(m, "scoring.train") }).click();
    await page.waitForURL("**/wizard**");

    // --- 5. Wizard : 9 étapes canoniques (CDC §8.1) -------------------------------------
    // Étape 1 — aperçu du dataset
    await expect(page.getByText(t(m, "wizard.steps.1")).first()).toBeVisible();
    await page.getByRole("button", { name: t(m, "wizard.step1.confirm") }).click();

    // Étape 2 — cible + tâche (suggestion species/classification)
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /species/ }).click();
    await page.getByText(t(m, "wizard.step2.classification"), { exact: true }).click();
    await clickWizardNext(page, t(m, "wizard.next"));

    // Étape 3 — nettoyage (Iris : aucune colonne à nettoyer)
    await expect(page.getByText(t(m, "wizard.step3.cleanTitle"))).toBeVisible();
    await clickWizardNext(page, t(m, "wizard.next"));

    // Étape 4 — division train/test (défaut 20 %)
    await clickWizardNext(page, t(m, "wizard.next"));

    // Étape 5 — préparation (standard + ordinal par défaut)
    await clickWizardNext(page, t(m, "wizard.next"));

    // Étape 6 — algorithme : arbre de décision (explicabilité maximale)
    await page.getByText(t(m, "wizard.step6.names.decision_tree"), { exact: true }).click();
    await clickWizardNext(page, t(m, "wizard.next"));

    // Étape 7 — hyperparamètres : preset équilibré par défaut
    await clickWizardNext(page, t(m, "wizard.next"));

    // Étape 8 — récapitulatif → confirmation → lancement → console SSE
    await expect(page.getByText(t(m, "wizard.step8.recap"))).toBeVisible();
    await page.getByText(t(m, "wizard.step8.confirm")).click();
    await page.getByRole("button", { name: t(m, "wizard.step8.launch") }).click();

    // Étape 9 — l'entraînement RÉEL aboutit (worker Celery) puis redirection automatique
    // vers les résultats (le bouton « Voir les résultats » n'est qu'un secours humain).
    await page.waitForURL(/\/experiments\/[0-9a-f-]{36}/, { timeout: 150_000 });

    // --- 6. Résultats -------------------------------------------------------------------
    await expect(page.getByText(t(m, "experiments.resultsTitle"))).toBeVisible();
    await expect(page.getByText(t(m, "experiments.metrics.accuracy")).first()).toBeVisible();

    // --- 6b. « Voir en tant que » : le niveau effectif pilote la lecture (adaptatif §3–§4) ---
    // L'utilisateur est Expert (familiarité 4) → par défaut tout est visible, sans avertissement.
    await expect(page.getByText(t(m, "audience.viewAs"))).toBeVisible();
    // Bascule en Novice → cadrage « on montre l'essentiel » (main tenue), puis retour à son niveau.
    await page.getByRole("button", { name: t(m, "audience.short.novice") }).click();
    await expect(page.getByText(t(m, "audience.noviceFraming"))).toBeVisible();
    const backToMine = t(m, "audience.backToMine").replace(
      "{level}",
      t(m, "audience.short.expert")
    );
    await page.getByRole("button", { name: backToMine }).click();
    await expect(page.getByText(t(m, "audience.noviceFraming"))).toBeHidden();

    // --- 7. Explicabilité : génération SHAP + KPI de fiabilité --------------------------
    await page.getByRole("tab", { name: t(m, "experiments.tabXai") }).click();
    await page.getByRole("button", { name: t(m, "xai.request.launch") }).click();
    await expect(page.getByText(t(m, "xai.kpis.title"))).toBeVisible({ timeout: 150_000 });
    const importanceTitle = t(m, "xai.charts.importance").split(" (")[0];
    await expect(page.getByText(new RegExp(importanceTitle)).first()).toBeVisible();

    // --- 8. Copilote d'explication (dock bas ; repli déterministe marqué si aucune clé LLM — P2) --
    await page.getByRole("button", { name: t(m, "xai.copilot.open") }).click();
    const question = locale === "fr" ? "Quelle variable compte le plus ?" : "Which feature matters most?";
    await page.getByPlaceholder(t(m, "xai.copilot.placeholder")).fill(question);
    await page.getByRole("button", { name: t(m, "xai.chat.send"), exact: true }).click();
    await expect(page.getByText(question)).toBeVisible();
    await expect(page.getByText(t(m, "xai.chat.waiting"))).toBeHidden({ timeout: 150_000 });
  });
}
