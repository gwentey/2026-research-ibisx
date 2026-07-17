import { defineConfig } from "@playwright/test";

// E2E parcours mission (CDC §12.4) — s'exécute contre la stack Docker Compose déjà démarrée :
//   docker compose up -d && ibis seed (datasets embarqués) puis `pnpm e2e`.
// En CI : job nightly (voir .github/workflows/e2e.yml).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  }
});
