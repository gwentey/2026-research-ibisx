/**
 * Lecture des erreurs de l'API.
 *
 * L'API renvoie ses erreurs métier sous `{ detail: { code, message } }` (`ibis.core.errors`),
 * mais FastAPI renvoie ses propres erreurs de validation — **également en 422** — sous
 * `{ detail: [ { loc, msg, type }, … ] }`. Les deux formes doivent être lues sans planter,
 * et surtout sans produire « [object Object] » à l'écran.
 */

type ErrorDetailObject = { code?: unknown; message?: unknown };
type PydanticIssue = { msg?: unknown; loc?: unknown };

function detailOf(error: unknown): unknown {
  if (typeof error !== "object" || error === null) return undefined;
  return (error as { detail?: unknown }).detail;
}

/** Code métier de l'erreur (`KAGGLE_URL_INVALID`, `NOT_OWNER`…). */
export function apiErrorCode(error: unknown): string {
  const detail = detailOf(error);
  if (Array.isArray(detail)) return "VALIDATION_ERROR";
  if (typeof detail === "object" && detail !== null) {
    const code = (detail as ErrorDetailObject).code;
    if (typeof code === "string" && code.length > 0) return code;
  }
  return "UNKNOWN_ERROR";
}

/**
 * Message lisible par un humain, ou `fallback` si l'API n'en fournit pas d'exploitable.
 *
 * Les messages métier de l'API sont rédigés pour l'utilisateur final (« Ce lien pointe vers
 * « code », pas vers un dataset ») : il faut les afficher tels quels plutôt que les remplacer
 * par un texte générique, sinon on perd l'explication précise du refus.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const detail = detailOf(error);

  if (typeof detail === "string" && detail.trim().length > 0) {
    return detail;
  }

  if (Array.isArray(detail)) {
    // Erreurs de schéma Pydantic : techniques (« field required », chemin `loc`), jamais
    // rédigées pour un utilisateur final -> on préfère le message de repli de l'appelant.
    const first = detail[0] as PydanticIssue | undefined;
    const msg = first?.msg;
    return typeof msg === "string" && msg.length > 0 ? `${fallback} (${msg})` : fallback;
  }

  if (typeof detail === "object" && detail !== null) {
    const message = (detail as ErrorDetailObject).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  return fallback;
}
