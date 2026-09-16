/**
 * Chaîne intergicielle HTTP : origines, CORS, pré-vol, débit.
 *
 * Repris de `MCP-Jurisprudence-Quebec/src/index.ts`, seul des deux dépôts à en porter une —
 * `legislation` n'a aujourd'hui ni CORS, ni `OPTIONS`, ni contrôle d'`Origin`, ce que la
 * marche 2 vient combler.
 */

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

/**
 * Origines de navigateur admises par défaut.
 *
 * DEUX EXIGENCES DISTINCTES SE REJOIGNENT ICI, et il faut les servir toutes les deux :
 *
 *   1. **CORS.** `claude.ai` est une application de NAVIGATEUR. Sans pré-vol accepté et
 *      sans `Access-Control-Allow-Origin`, le navigateur refuse la requête — et le
 *      connecteur se solde par « impossible de joindre le serveur », alors que le même
 *      point d'entrée répond parfaitement à un client serveur.
 *   2. **Défense contre le RÉ-ATTACHEMENT DNS**, exigée par la spécification MCP : une
 *      origine de navigateur non reconnue est REFUSÉE. Une origine ABSENTE (appel serveur
 *      à serveur) reste admise — un navigateur en pose toujours une.
 */
export const ORIGINES_PAR_DEFAUT = ["https://claude.ai", "https://claude.com"] as const;

/** Origines admises : les défauts, plus celles d'une liste séparée par des virgules. */
export function originesAdmises(supplementaires?: string): string[] {
  const sup = (supplementaires ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
  return [...ORIGINES_PAR_DEFAUT, ...sup];
}

/** Origine à refléter, ou `null` si elle est absente ou refusée. */
export function origineAutorisee(request: Request, admises: readonly string[]): string | null {
  const o = request.headers.get("Origin");
  if (!o) return null; // serveur à serveur : pas de CORS à négocier
  return admises.includes(o) ? o : null;
}

/** Une origine de NAVIGATEUR présente mais non reconnue doit être refusée. */
export function origineRefusee(request: Request, admises: readonly string[]): boolean {
  const o = request.headers.get("Origin");
  return o !== null && !admises.includes(o);
}

/**
 * En-têtes CORS d'une réponse effective.
 *
 * `Vary: Origin` est OBLIGATOIRE : sans lui, un cache intermédiaire pourrait resservir à
 * une origine la réponse calculée pour une autre.
 */
export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    // Le client LIT ces en-têtes ; sans exposition explicite ils lui sont invisibles.
    "Access-Control-Expose-Headers": "WWW-Authenticate, MCP-Protocol-Version",
  };
}

export function jsonResponse(body: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(origin) },
  });
}

/**
 * Réponse au pré-vol CORS.
 *
 * ⚠ LE PRÉ-VOL EST TRAITÉ AVANT TOUTE VÉRIFICATION DU SECRET, et c'est obligatoire : un
 *   navigateur émet `OPTIONS` SANS en-tête d'authentification et sans corps. Exiger le
 *   secret ici ferait échouer le pré-vol, donc la requête réelle, donc le connecteur —
 *   sans que rien n'ait été authentifié pour autant. Le pré-vol ne divulgue rien : il ne
 *   fait qu'annoncer ce que le serveur accepte.
 *
 * ⚠ LE PRÉ-VOL N'EST JAMAIS LIMITÉ EN DÉBIT. Un `429` sur un pré-vol ne remonte au
 *   navigateur que comme un échec CORS opaque : le connecteur casserait sans que le motif
 *   soit lisible nulle part.
 */
export function preflight(origin: string): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Accept",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    },
  });
}

/** Ce qu'un limiteur d'arête Cloudflare expose au socle. */
export interface Limiteur {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/**
 * Le débit est-il acceptable pour cette clé ?
 *
 * ⚠ ÉCHOUE OUVERT, et l'asymétrie avec l'authentification est délibérée. Une liaison
 *   absente ou en panne ne doit pas éteindre le service : le limiteur protège du COÛT
 *   d'une rafale, il ne garde pas une porte. L'authentification, elle, échoue FERMÉ.
 *   Confondre les deux donne soit un service qui s'éteint sur une panne d'infrastructure,
 *   soit une porte qui s'ouvre sur la même panne.
 *
 * Le limiteur d'arête est approximatif et par centre de données : propriété assumée. Il ne
 * sert pas à compter, il sert à ce qu'une boucle ne coûte rien.
 */
export async function debitAcceptable(
  limiteur: Limiteur | undefined,
  cle: string,
): Promise<boolean> {
  if (!limiteur) return true;
  try {
    const { success } = await limiteur.limit({ key: cle });
    return success;
  } catch {
    return true;
  }
}
