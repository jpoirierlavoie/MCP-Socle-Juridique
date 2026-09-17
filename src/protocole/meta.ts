/**
 * Le `_meta` par requête de `2026-07-28`, et les indices de cache des résultats.
 *
 * C'est ce qui remplace la poignée `initialize` : chaque requête porte sa version, son
 * identité de client et ses capacités ; chaque résultat porte l'identité du serveur.
 */

const PREFIXE = "io.modelcontextprotocol/";

export const CLEF_VERSION = `${PREFIXE}protocolVersion`;
export const CLEF_CLIENT = `${PREFIXE}clientInfo`;
export const CLEF_CAPACITES = `${PREFIXE}clientCapabilities`;
export const CLEF_SERVEUR = `${PREFIXE}serverInfo`;

export interface InfoClient {
  name?: string;
  version?: string;
}

export interface MetaRequete {
  protocolVersion?: string;
  clientInfo?: InfoClient;
  clientCapabilities?: Record<string, unknown>;
}

/**
 * Lit le `_meta` d'une requête.
 *
 * ⚠ `clientInfo` EST UN SIGNAL DE GOUVERNE DE PREMIER ORDRE, pas une curiosité : le nombre
 *   de `clientInfo` DISTINCTS vus sur un même jeton en une journée est ce qui trahit un
 *   jeton partagé entre plusieurs postes ou plusieurs personnes. C'est aussi la seule
 *   mesure qui dira un jour si une révision ancienne peut être retirée. Le conserver dans
 *   le plan technique (phase 4), jamais ailleurs.
 */
export function lireMeta(params?: Record<string, unknown>): MetaRequete {
  const meta = params?._meta as Record<string, unknown> | undefined;
  if (!meta) return {};
  const client = meta[CLEF_CLIENT] as InfoClient | undefined;
  return {
    protocolVersion:
      typeof meta[CLEF_VERSION] === "string" ? (meta[CLEF_VERSION] as string) : undefined,
    clientInfo: client && typeof client === "object" ? client : undefined,
    clientCapabilities: meta[CLEF_CAPACITES] as Record<string, unknown> | undefined,
  };
}

/**
 * Le nom et la version d'un client, réduits à ce qui peut être conservé.
 *
 * Rien d'autre que ces deux champs ne doit jamais entrer dans un journal : `clientInfo` est
 * un objet ouvert, et un client peut y mettre ce qu'il veut.
 */
export function clientLisible(info?: InfoClient): string | undefined {
  if (!info?.name) return undefined;
  return info.version ? `${info.name}/${info.version}` : info.name;
}

/** Ajoute `serverInfo` au `_meta` d'un résultat — à la racine du `_meta`, non du résultat. */
export function avecServerInfo<T extends Record<string, unknown>>(
  resultat: T,
  serverInfo: { name: string; version: string },
): T & { _meta: Record<string, unknown> } {
  const meta = (resultat._meta ?? {}) as Record<string, unknown>;
  return { ...resultat, _meta: { ...meta, [CLEF_SERVEUR]: serverInfo } };
}

// ── Indices de cache ─────────────────────────────────────────────────────────────────────

export type PorteeCache = "public" | "private";

/**
 * Les résultats qui DOIVENT porter `ttlMs` et `cacheScope`.
 *
 * ⚠ `server/discover` EN FAIT PARTIE, et le tableau de la §3.2 de la spécification du socle
 *   l'oublie — vérifié contre la page « Caching » de la révision. Écart consigné là-bas.
 */
export const RESULTATS_CACHABLES = [
  "server/discover",
  "tools/list",
  "prompts/list",
  "resources/list",
  "resources/templates/list",
  "resources/read",
] as const;

export function estCachable(methode: string): boolean {
  return (RESULTATS_CACHABLES as readonly string[]).includes(methode);
}

/**
 * Pose les indices de cache sur un résultat.
 *
 * ⚠ `"public"` ENGAGE PLUS QU'IL N'Y PARAÎT : « any client, shared gateway, or caching proxy
 *   MAY store and serve the cached response to ANY user ». Il n'est donc tenable que si le
 *   résultat est RIGOUREUSEMENT identique pour tous les porteurs. Un registre qui varierait
 *   selon le titulaire — parce qu'un drapeau par titulaire altère un descripteur, par
 *   exemple — fuirait d'un titulaire à l'autre. La parade est de ne jamais faire varier le
 *   registre : ce qui dépend du titulaire se dit dans la SORTIE de l'outil, pas dans sa
 *   description.
 */
export function avecCache<T extends Record<string, unknown>>(
  resultat: T,
  ttlMs: number,
  cacheScope: PorteeCache,
): T & { ttlMs: number; cacheScope: PorteeCache } {
  if (!Number.isInteger(ttlMs) || ttlMs < 0) {
    throw new Error(`ttlMs doit être un entier >= 0 (reçu : ${ttlMs}).`);
  }
  return { ...resultat, ttlMs, cacheScope };
}

/** Tout résultat complet le déclare. Le patron MRTR (`input_required`) n'est pas servi. */
export function complet<T extends Record<string, unknown>>(
  resultat: T,
): T & { resultType: "complete" } {
  return { ...resultat, resultType: "complete" };
}
