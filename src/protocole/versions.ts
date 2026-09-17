/**
 * Négociation de version, et pont vers les révisions à poignée.
 *
 * ⚠ TOUT LE PONT VIT ICI, ET DANS CE SEUL FICHIER. Le disperser, c'est se condamner à
 *   chercher dans dix endroits le jour où l'on retire une version.
 *
 * L'ORDRE DE BASCULE EST IMPÉRATIF : déployer le pont AVANT de retirer quoi que ce soit.
 * L'ordre inverse a déjà détruit un connecteur (2026-07-25).
 */

/** Erreur JSON-RPC de la spécification : version non prise en charge. */
export const UNSUPPORTED_PROTOCOL_VERSION = -32022;

/**
 * Les révisions « MODERNES » portent leur version, leur identité et leurs capacités dans le
 * `_meta` de CHAQUE requête. Les « héritées » les négocient par une poignée `initialize`.
 *
 * La frontière est `2026-07-28` : c'est elle qui a supprimé les sessions, l'en-tête
 * `Mcp-Session-Id` et la poignée elle-même.
 */
export const PREMIERE_MODERNE = "2026-07-28";

/** Une révision est moderne si elle est postérieure ou égale à la frontière. */
export function estModerne(version: string): boolean {
  // Comparaison lexicographique : le format `AAAA-MM-JJ` la rend valide, et elle survit à
  // l'ajout de révisions futures sans table à tenir.
  return version >= PREMIERE_MODERNE;
}

/**
 * Corps d'erreur pour une version non servie.
 *
 * Le champ `data` est CE QUI REND L'ERREUR EXPLOITABLE : sans la liste des versions
 * servies, un client ne peut que renoncer. Avec elle, il en choisit une et réessaie.
 */
export function erreurVersion(
  demandee: string,
  servies: readonly string[],
): { code: number; message: string; data: { supported: string[]; requested: string } } {
  return {
    code: UNSUPPORTED_PROTOCOL_VERSION,
    message: "Unsupported protocol version",
    data: { supported: [...servies], requested: demandee },
  };
}

/**
 * Quelle version servir à une requête ?
 *
 * Rend `{ version }` si elle est servie, `{ erreur }` sinon. Le cas « absente » est traité
 * par l'appelant, car il dépend d'une décision que le socle n'a pas à prendre — voir
 * `versionAbsenteAdmise`.
 */
export function negocier(
  demandee: string,
  servies: readonly string[],
): { version: string } | { erreur: ReturnType<typeof erreurVersion> } {
  if (servies.includes(demandee)) return { version: demandee };
  return { erreur: erreurVersion(demandee, servies) };
}

/**
 * Une requête SANS en-tête `MCP-Protocol-Version` doit-elle être admise ?
 *
 * La spécification n'ouvre que DEUX branches, et il faut en choisir une :
 *
 *   · la traiter comme `2025-03-26` — permis SEULEMENT si l'on prend en charge les clients
 *     antérieurs à `2025-06-18`, qui ne connaissaient pas l'en-tête ;
 *   · la refuser, en `400` + `-32020`.
 *
 * Ne JAMAIS la promouvoir silencieusement en `2025-06-18` : ce serait inventer une
 * troisième branche que personne n'implémente en face.
 *
 * ⚠ `initialize` EST TOUJOURS EXEMPTÉ, quelle que soit la décision. Sous `2025-06-18`,
 *   l'en-tête n'est exigé que sur les requêtes POSTÉRIEURES à l'initialisation : le POST
 *   `initialize` n'en porte légitimement aucun. Le refuser rejetterait la poignée de tout
 *   client conforme — y compris celle du connecteur claude.ai.
 */
export function versionAbsenteAdmise(methode: string, sertAvant2025_06_18: boolean): boolean {
  if (methode === "initialize") return true;
  return sertAvant2025_06_18;
}

/** Version présumée d'une requête sans en-tête, quand on admet les clients anciens. */
export const VERSION_SANS_ENTETE = "2025-03-26";
