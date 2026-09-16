/**
 * Registre d'outils : le TYPE d'un descripteur, et la mécanique de listage.
 *
 * Ce que ce fichier porte est générique. Ce qu'il ne porte pas, et ne portera jamais : les
 * descripteurs eux-mêmes, `INSTRUCTIONS`, `SERVER_INFO`, et `callTool`. La §11 marche 1 de
 * la spécification les laisse expressément dans chaque dépôt — ce sont douze lignes de
 * répartition, et les monter ici ferait entrer la connaissance du domaine par la porte du
 * type de contexte.
 *
 * Repris de `MCP-Jurisprudence-Quebec/src/mcp/registry.ts`, généralisé sur DEUX points et
 * pas un de plus :
 *
 *   1. **Le contexte est un paramètre de type.** Là-bas, `ToolContext` porte `client:
 *      CanliiClient` — un type du domaine. Ici, `TCtx` est ce que le dépôt consommateur
 *      décide. Aucune signature de gestionnaire ne change de forme pour autant.
 *   2. **`annotations` devient un champ REQUIS du descripteur.** Là-bas, `listToolDescriptors`
 *      estampillait une constante `READONLY` de portée module, la même pour les treize
 *      outils. Les deux connecteurs n'ont pas les mêmes indices — `legislation` déclare
 *      `idempotentHint` et `openWorldHint: false`, `jurisprudence` non — donc le socle ne
 *      peut pas posséder cette valeur. La rendre explicite par outil a un effet secondaire
 *      utile : elle fait apparaître que `jurisprudence` estampille aujourd'hui
 *      `openWorldHint: true` sur ses trois outils hors ligne, ce qu'aucune relecture
 *      n'avait relevé.
 */

import type { ToolResult } from "./rpc";
import type { JsonSchema } from "./valide";

/**
 * Indices de comportement (MCP « tool annotations »).
 *
 * ⚠ Un client DOIT les tenir pour non fiables s'ils viennent d'un serveur non approuvé :
 *   ce sont des déclarations du serveur sur lui-même, que rien ne vérifie. Ils servent à
 *   l'interface, jamais à une décision de sécurité.
 */
export interface Annotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export type ToolHandler<TCtx> = (args: Record<string, unknown>, ctx: TCtx) => Promise<ToolResult>;

export interface ToolDescriptor<TCtx> {
  /**
   * Libellé lisible, distinct de `name`.
   *
   * C'est ce que le praticien lit dans l'invite d'AUTORISATION, au moment précis où il
   * décide de laisser l'outil s'exécuter. Une réserve portée par le titre se lit AVANT
   * l'appel plutôt qu'après. Un client qui ignore ce champ retombe sur `name` : rien ne
   * casse.
   */
  title: string;
  description: string;
  inputSchema: JsonSchema;
  /** Requis, et propre à chaque dépôt : le socle n'a pas d'avis sur ces indices. */
  annotations: Annotations;
  handler: ToolHandler<TCtx>;
}

export type Registre<TCtx> = Record<string, ToolDescriptor<TCtx>>;

/**
 * Descripteurs rendus à `tools/list`.
 *
 * ⚠ L'ORDRE DES CLEFS DE L'OBJET ÉMIS EST UN CONTRAT. `JSON.stringify` conserve l'ordre
 *   d'insertion, et la marche 1 exige un `tools/list` identique OCTET POUR OCTET à celui
 *   d'avant l'extraction. `name, title, description, inputSchema, annotations` — ne pas
 *   réordonner, ne pas ajouter de champ ici sans le vouloir.
 *
 * ⚠ L'ORDRE DES OUTILS est celui d'insertion dans le registre, comme auparavant. La
 *   spécification `2026-07-28` recommande un ordre DÉTERMINISTE, ce que l'ordre
 *   d'insertion est déjà ; elle n'exige pas l'ordre alphabétique. Le tri explicite arrive
 *   à la marche 3, sur un champ `ordre`, pour ne pas rétrograder l'outil pivot que les
 *   `INSTRUCTIONS` désignent comme point de départ.
 */
export function listToolDescriptors<TCtx>(tools: Registre<TCtx>): Array<Record<string, unknown>> {
  return Object.entries(tools).map(([name, t]) => ({
    name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: { ...t.annotations },
  }));
}
