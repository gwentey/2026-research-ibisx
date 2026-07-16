import type { CreateClientConfig } from "./generated/client.gen";

// Configuration runtime du client API généré (ADR-007) :
// - navigateur : même origine ("" → /api/* est réécrit vers le backend) ;
// - serveur (RSC/route handlers) : URL interne du conteneur api.
export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl:
    typeof window === "undefined" ? (process.env.INTERNAL_API_URL ?? "http://localhost:8000") : ""
});
