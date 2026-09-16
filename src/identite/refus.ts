/**
 * La forme d'un refus.
 *
 * ⚠ CETTE DÉCISION EST ARBITRÉE PAR LE PRATICIEN, PAS PAR LE CODE. S8 retient le `404`
 *   pour UN seul motif tenable : ne pas servir d'oracle sur l'existence d'un compte. Le
 *   motif souvent invoqué — « le 401 déclenche une découverte OAuth qui se coince » —
 *   **n'est pas mesuré**, et l'inverse l'est : les deux incidents enregistrés (2026-07-23,
 *   2026-07-25) sont des **404** qui ont poussé le connecteur dans cette découverte, la
 *   seconde fois irréversiblement. Un client MCP lit un `404` comme « ce serveur exige une
 *   authentification », pas comme « rien ici ». Le `404` n'immunise donc de rien.
 *
 *   C'est un écart assumé et consigné à la spécification MCP, qui exige les métadonnées de
 *   ressource protégée et un `401`. D'où le drapeau : la bascule doit être une ligne de
 *   configuration, pas une réécriture, le jour où une mesure réelle tranchera.
 */

import { corsHeaders } from "../protocole/http";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

export type FormeRefus = "404" | "401";

/**
 * Refus d'authentification.
 *
 * ⚠ TOUS LES ÉCHECS RENDENT LA MÊME RÉPONSE. Jeton inconnu, expiré, révoqué, titulaire
 *   suspendu : même statut, même corps, et — c'est la partie que le code ne peut pas
 *   garantir seul — le même DÉLAI. Un écart de temps entre « jeton inconnu » et « jeton
 *   connu mais titulaire suspendu » rouvre l'énumération que le statut ferme.
 */
export function refuser(forme: FormeRefus, origin: string | null = null): Response {
  if (forme === "401") {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...JSON_HEADERS, "WWW-Authenticate": "Bearer", ...corsHeaders(origin) },
    });
  }
  // Corps VIDE, et aucun en-tête qui annonce un point d'entrée MCP.
  return new Response(null, { status: 404, headers: corsHeaders(origin) });
}

/**
 * Origine de navigateur non reconnue : `403`, AVANT toute authentification.
 *
 * Sans en-têtes CORS : la réponse ne doit pas être lisible par la page qui l'a provoquée,
 * sans quoi le refus lui-même deviendrait un oracle.
 */
export function origineInterdite(): Response {
  return new Response(JSON.stringify({ error: "forbidden_origin" }), {
    status: 403,
    headers: JSON_HEADERS,
  });
}

/** Débit dépassé. `Retry-After` en secondes. */
export function tropDeRequetes(retryAfter: number, origin: string | null = null): Response {
  return new Response(JSON.stringify({ error: "rate_limited" }), {
    status: 429,
    headers: {
      ...JSON_HEADERS,
      "Retry-After": String(retryAfter),
      ...corsHeaders(origin),
    },
  });
}

/**
 * Méthode non permise.
 *
 * ⚠ À NE SERVIR QU'APRÈS L'IDENTITÉ. `2026-07-28` recommande `405` sur `GET` et `DELETE`,
 *   mais un `405` servi AVANT l'authentification apprend à un anonyme que le point d'entrée
 *   existe : c'est exactement l'oracle que S8 refuse. Le connecteur claude.ai émet des
 *   `GET /mcp` sans aucun porteur ; ils doivent rester en refus d'authentification.
 *   Deuxième écart assumé, à côté de S8, avec son test.
 */
export function methodeNonPermise(origin: string | null = null): Response {
  return new Response(null, {
    status: 405,
    headers: { Allow: "POST, OPTIONS", ...corsHeaders(origin) },
  });
}
