/**
 * Parcours « Apprendre » (l'Académie IA — docs/formation/CAHIER-DES-CHARGES.md).
 * Surface FRONT pure (catalogue statique + store) : accueil → cursus → leçon → quiz réussi →
 * progression → pont « mise en pratique » vers un vrai Défi. En FR puis EN.
 *
 * Le clic sur la bonne réponse se fait par INDEX (depuis le catalogue), pour rester robuste à la
 * traduction. Le franchissement du pont vers le VRAI pipeline est déjà couvert par challenge.spec.
 */

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

type Messages = Record<string, never>;

function loadMessages(locale: string): Messages {
  return JSON.parse(readFileSync(path.join(__dirname, "..", "messages", `${locale}.json`), "utf8"));
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
  const email = `e2e-formation-${locale}-${Date.now()}@example.org`;
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
  test(`parcours Académie — accueil, leçon, quiz, progression, pont (${locale})`, async ({
    page,
    context,
    baseURL
  }) => {
    const m = loadMessages(locale);
    await registerAndOnboard(page, context, baseURL, locale, m);

    // --- 1. Accueil de l'Académie ------------------------------------------------------
    await page.goto("/formation");
    await expect(page.getByRole("heading", { name: t(m, "formation.home.title") })).toBeVisible();
    // Le grade de départ est « Curieux ».
    await expect(page.getByText(t(m, "formation.grades.curieux"), { exact: true })).toBeVisible();
    // Les deux cursus de la Vague 1.
    await expect(page.getByText(t(m, "formation.cursus.eveil.title"), { exact: true })).toBeVisible();
    await expect(
      page.getByText(t(m, "formation.cursus.fondations.title"), { exact: true })
    ).toBeVisible();

    // --- 2. Ouvrir le cursus Éveil puis la 1re leçon -----------------------------------
    await page.goto("/formation/eveil");
    await expect(
      page.getByRole("heading", { name: t(m, "formation.modules.ia-pas-que-chatgpt.title") })
    ).toBeVisible();
    await page.goto("/formation/eveil/le-grand-malentendu");
    await expect(
      page.getByRole("heading", { name: t(m, "formation.lessons.le-grand-malentendu.title") })
    ).toBeVisible();
    // Le bloc « Idée reçue » ouvre la leçon.
    await expect(page.getByText(t(m, "formation.blocks.mythLabel"), { exact: true })).toBeVisible();

    // --- 3. Répondre au quiz : bonne réponse à l'INDEX 1 (catalogue) -------------------
    const finish = page.getByRole("button", { name: t(m, "formation.blocks.finishLesson") });
    await expect(finish).toBeDisabled();
    await page.getByRole("radio").nth(1).click();
    await expect(page.getByText(t(m, "formation.blocks.quizCorrect"))).toBeVisible();
    await expect(finish).toBeEnabled();

    // --- 4. Valider la leçon → on avance vers la leçon suivante -------------------------
    await finish.click();
    await page.waitForURL("**/formation/eveil/chatgpt-demystifie");
    await expect(
      page.getByRole("heading", { name: t(m, "formation.lessons.chatgpt-demystifie.title") })
    ).toBeVisible();

    // --- 5. Le pont « mise en pratique » de Fondations pointe vers un vrai Défi ---------
    await page.goto("/formation/fondations/ta-premiere-enquete");
    await expect(
      page.getByText(t(m, "formation.blocks.practiceLabel"), { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: t(m, "formation.blocks.practiceCta") })
    ).toBeVisible();

    // --- 6. Cursus Praticien : un bac à sable interactif (matrice de confusion) ---------
    await page.goto("/formation/praticien/la-matrice-de-confusion");
    await expect(
      page.getByText(t(m, "formation.playgrounds.confusion.title"), { exact: true })
    ).toBeVisible();
    await expect(page.getByRole("slider").first()).toBeVisible(); // seuil manipulable

    // --- 7. Glossaire vivant : recherche + entrées reliées aux leçons -------------------
    await page.goto("/formation/glossaire");
    await expect(page.getByRole("heading", { name: t(m, "formation.glossary.title") })).toBeVisible();
    await expect(
      page.getByPlaceholder(t(m, "formation.glossary.searchPlaceholder"))
    ).toBeVisible();
    // au moins un terme connu du glossaire (« arbre de décision »)
    await expect(
      page.getByText(t(m, "formation.notions.arbre-decision.term"), { exact: true }).first()
    ).toBeVisible();

    // --- 8. Cursus Analyste : une étude de cas réelle (« anatomie d'un fiasco ») ---------
    await page.goto("/formation/analyste/anatomie-dun-fiasco");
    await expect(
      page.getByText(t(m, "formation.blocks.caseLabel"), { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText(t(m, "formation.lessons.anatomie-dun-fiasco.case.title"), { exact: true })
    ).toBeVisible();

    // --- 9. Passeport IA : certificat + badges de compétence ---------------------------
    await page.goto("/formation/passeport");
    await expect(page.getByText(t(m, "formation.passport.certLabel"), { exact: true })).toBeVisible();
    await expect(
      page.getByText(t(m, "formation.badges.premier-modele.title"), { exact: true })
    ).toBeVisible();
  });
}
