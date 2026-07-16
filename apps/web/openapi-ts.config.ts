import { defineConfig } from "@hey-api/openapi-ts";

// Client TypeScript GÉNÉRÉ depuis l'OpenAPI du backend (ADR-007).
// Régénérer : pnpm generate:api (après export du schéma — voir README).
// La CI échoue si lib/api/generated n'est pas à jour avec lib/api/openapi.json.
export default defineConfig({
  input: "lib/api/openapi.json",
  output: "lib/api/generated",
  plugins: [{ name: "@hey-api/client-fetch", runtimeConfigPath: "./lib/api/runtime.ts" }]
});
