/**
 * Enveloppe JSON-RPC 2.0 du point d'entrée MCP.
 *
 * Transport Streamable HTTP SANS ÉTAT : un message JSON-RPC par POST, une réponse par
 * requête. Aucun `Mcp-Session-Id`, aucun message initié par le serveur. Ce qui fut le pari
 * D3 du connecteur « Jurisprudence » est devenu la norme avec la révision `2026-07-28`.
 *
 * Les lots (tableaux) sont refusés : le regroupement a été retiré de la révision
 * `2025-06-18`, et aucun client connu n'en émet.
 *
 * Repris de `MCP-Jurisprudence-Quebec/src/mcp/rpc.ts`, à comportement identique.
 */

export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
/**
 * ⚠ EXPORTÉ ET DÉLIBÉRÉMENT INEMPLOYÉ. Un échec de validation d'arguments n'est PAS une
 * erreur de protocole ici : c'est un résultat d'outil `isError: true` (voir `err()`).
 * La constante reste pour que l'écart avec les implémentations qui lèvent `INVALID_PARAMS`
 * demeure visible plutôt que d'être redécouvert.
 */
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;

export type RequestId = string | number | null;

export interface JsonRpcMessage {
  jsonrpc: "2.0";
  method: string;
  id?: RequestId;
  params?: Record<string, unknown>;
}

/** Erreur de PROTOCOLE. Réservée aux fautes de forme — voir la note sur `err()`. */
export class JsonRpcError extends Error {
  readonly code: number;
  readonly requestId: RequestId;

  constructor(code: number, message: string, requestId: RequestId = null) {
    super(message);
    this.name = "JsonRpcError";
    this.code = code;
    this.requestId = requestId;
  }
}

export function resultResponse(id: RequestId, result: unknown): Record<string, unknown> {
  return { jsonrpc: "2.0", id, result };
}

export function errorResponse(
  id: RequestId,
  code: number,
  message: string,
  data?: unknown,
): Record<string, unknown> {
  const error: Record<string, unknown> = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id, error };
}

/**
 * Analyse et valide structurellement UN message JSON-RPC 2.0.
 *
 * Ne fait que valider la forme : la détection des notifications (absence d'`id`) revient à
 * l'appelant.
 */
export function parseMessage(raw: string): JsonRpcMessage {
  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    throw new JsonRpcError(PARSE_ERROR, "Erreur d'analyse syntaxique (JSON invalide).");
  }

  if (Array.isArray(message)) {
    throw new JsonRpcError(INVALID_REQUEST, "Les requêtes groupées ne sont pas prises en charge.");
  }
  if (message === null || typeof message !== "object") {
    throw new JsonRpcError(INVALID_REQUEST, "Requête invalide.");
  }

  const m = message as Record<string, unknown>;
  if (m.jsonrpc !== "2.0") {
    throw new JsonRpcError(INVALID_REQUEST, 'Requête invalide : « jsonrpc » doit valoir "2.0".');
  }
  if (typeof m.method !== "string" || m.method.length === 0) {
    throw new JsonRpcError(
      INVALID_REQUEST,
      "Requête invalide : « method » doit être une chaîne non vide.",
    );
  }
  if ("id" in m && m.id !== null && typeof m.id !== "string" && typeof m.id !== "number") {
    throw new JsonRpcError(
      INVALID_REQUEST,
      "Requête invalide : « id » doit être une chaîne ou un nombre.",
    );
  }
  if (m.params !== undefined && m.params !== null && typeof m.params !== "object") {
    throw new JsonRpcError(
      INVALID_REQUEST,
      "Requête invalide : « params » doit être un objet.",
      (m.id ?? null) as RequestId,
    );
  }

  return {
    jsonrpc: "2.0",
    method: m.method,
    id: ("id" in m ? m.id : undefined) as RequestId | undefined,
    params: (m.params ?? undefined) as Record<string, unknown> | undefined,
  };
}

/** Un message sans `id` (ou avec un `id` nul) est une notification. */
export function isNotification(m: JsonRpcMessage): boolean {
  return m.id === undefined || m.id === null;
}

// ── Enveloppe des résultats d'outils ────────────────────────────────────────────────────

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError: boolean;
  /**
   * Charge utile typée, validée contre l'`outputSchema` publié de l'outil.
   *
   * ⚠ OPTIONNEL, ET CE N'EST PAS UN DÉTAIL. Le champ existe parce que `legislation` émet
   *   une charge structurée sur ses dix outils depuis toujours, et que la marche 2 exige
   *   qu'il continue à l'émettre À L'IDENTIQUE. Il n'est PAS l'arrivée de S5 : la sortie
   *   double impose en plus un `outputSchema` publié et une enveloppe dont le champ
   *   `gardes` est non vide par obligation de compilation. Tant que `sortie/` n'est pas
   *   livré, ce champ ne porte que ce que l'outil y met, sans contrat.
   *
   *   Conséquence immédiate : `jurisprudence` ne doit RIEN y mettre. Son invariant 4
   *   tient jusqu'à la marche 4, et deux de ses tests l'épinglent sur les sorties réelles.
   *   Élargir le TYPE ne renverse aucune doctrine — seul le ferait un outil qui s'en sert.
   */
  structuredContent?: Record<string, unknown>;
}

/**
 * Sortie normale d'un outil : de la PROSE, dans la langue du destinataire.
 *
 * ⚠ LA CHARGE STRUCTURÉE EST ACCEPTÉE, LA SORTIE DOUBLE N'EST PAS LIVRÉE. Le second
 *   argument existe pour que `legislation` continue d'émettre ce qu'il émet déjà ; il
 *   n'est pas l'arrivée de S5, qui exige en outre un `outputSchema` publié par outil et
 *   une enveloppe dont `gardes` est non vide par obligation de compilation (marche 4).
 *   Le renversement de doctrine porte sur des décisions écrites et réexaminées dans les
 *   deux connecteurs : il se fera par décision, jamais par glissement.
 *
 *   L'argument POUR la prose seule n'est pas faible, et il vit là où il a été formulé :
 *   invariant 4 de `MCP-Jurisprudence-Quebec/CLAUDE.md`. Le lire avant d'y toucher. Le
 *   socle n'en porte pas la copie — il ne connaît ni verdicts, ni réserves, ni mises en
 *   garde juridiques ; ce serait la frontière de la §2 franchie par le commentaire.
 *
 *   Ce que le socle porte, en revanche, est le CONTRÔLE qui rend le renversement tenable :
 *   `gardes` non vide par obligation de compilation dès qu'une réserve s'applique
 *   (`sortie/gardes.ts`, marche 4).
 */
export function ok(text: string, structured?: Record<string, unknown>): ToolResult {
  // La clef n'apparaît QUE si une charge est fournie : sans elle, la sortie reste
  // exactement `{ content, isError }`, ce qu'un test du socle épingle.
  return {
    content: [{ type: "text", text }],
    isError: false,
    ...(structured ? { structuredContent: structured } : {}),
  };
}

/**
 * Erreur d'EXÉCUTION d'un outil.
 *
 * ⚠ TOUTE erreur d'exécution — validation des arguments comprise — est un RÉSULTAT d'outil
 *   `isError: true`, jamais une erreur JSON-RPC. Les erreurs JSON-RPC restent réservées aux
 *   fautes de protocole : méthode inconnue, JSON illisible, lot. C'est ce que prescrit la
 *   spécification MCP, et le motif est opérationnel : le modèle doit pouvoir LIRE l'erreur
 *   et se corriger, ce qu'une erreur de transport ne lui permet pas.
 */
export function err(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}
