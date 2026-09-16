/**
 * Extraction et contrôle du jeton porté par une requête.
 *
 * Repris de `MCP-Legislation-Quebec/src/auth.ts` — seul des deux dépôts à servir les TROIS
 * porteurs de S7. Chaque commentaire de ce fichier consigne une mesure de production, pas
 * une préférence : les retirer, c'est rouvrir l'incident qui les a fait écrire.
 *
 * DEUX ÉCARTS ASSUMÉS AVEC L'ORIGINAL :
 *
 *   1. **`queryKey` est OPTIONNEL.** Absent, il n'y a pas de porteur `?key=`. Sans cette
 *      précaution, monter ce fichier donnerait à `jurisprudence` — qui ne sert aujourd'hui
 *      que le segment et l'en-tête — une surface d'accès qu'il n'a pas, en contradiction
 *      avec « la phase 1 n'expose rien de nouveau ».
 *   2. **Les secrets sont nommés par la `Porte`**, et non lus d'un `EnvWithSecrets` codé
 *      en dur. Ce reste une LISTE LITTÉRALE déclarée par le dépôt, non une convention de
 *      nom balayée sur `env` : un nom mal orthographié se pose alors sans erreur et
 *      n'ouvre rien — le mode de panne est inchangé. Le gain est qu'un test peut importer
 *      la même `Porte` que le runtime, au lieu d'analyser le code source pour la deviner.
 */

/** Ce qu'un dépôt déclare une fois, et que le runtime ET les tests emploient. */
export interface Porte {
  /** Chemin de montage exact, sans slash final. Par exemple `/mcp`. */
  mount: string;
  /**
   * Nom du paramètre de requête portant le jeton. **Omettre pour n'offrir aucun porteur
   * `?key=`.** Là où il existe, c'est LA forme employée par le connecteur claude.ai en
   * production — les autres n'ont pas survécu à son formulaire (S7, à re-mesurer avant
   * l'ouverture, jamais à présumer).
   */
  queryKey?: string;
  /** Noms des variables d'environnement portant les secrets admis, dans l'ordre. */
  nomsSecrets: readonly string[];
}

/**
 * Slash final purement cosmétique : les clients en ajoutent (le connecteur claude.ai
 * normalise l'URL saisie). `/mcp/` et `/mcp/<jeton>/` DOIVENT se comporter comme leurs
 * formes sans slash — sinon le refus 404 pousse le client vers la découverte OAuth, qui
 * échoue ensuite sur l'enregistrement dynamique (constaté en production, 2026-07-23).
 */
export function trimTrailingSlash(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/**
 * Comparaison à temps constant. `===` sur des chaînes sort au premier octet différent, ce
 * qui laisse fuir le préfixe correct octet par octet. La longueur, elle, fuit — compromis
 * habituel, sans portée sur des jetons de longueur fixe (A2 : 43 caractères, toujours).
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Jeton porté par l'en-tête `Authorization`, ou `null`. */
export function bearerOf(request: Request): string | null {
  const raw = request.headers.get("Authorization");
  if (!raw) return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m ? (m[1]?.trim() ?? null) : null;
}

/**
 * `decodeURIComponent` LÈVE sur un pourcentage malformé (`/mcp/%zz`). Tant que la
 * comparaison court-circuitait, l'exception n'était atteinte que par intermittence et
 * remontait non rattrapée, donc en 500. Un refus doit rester un 404 — le seul statut dont
 * on ait mesuré l'effet sur un client MCP.
 */
export function decodeOrNull(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * Les porteurs effectivement présentés, dans l'ordre : en-tête, segment de chemin,
 * paramètre de requête. Un emplacement vide rend `null` — la LONGUEUR du tableau ne
 * dépend donc que de la configuration, jamais du contenu de la requête.
 */
export function porteursPresentes(request: Request, url: URL, porte: Porte): (string | null)[] {
  const prefixe = `${porte.mount}/`;
  const path = trimTrailingSlash(url.pathname);
  // Un SEUL segment après le point de montage : /mcp/<jeton>, rien de plus profond.
  const segment =
    path.startsWith(prefixe) && !path.slice(prefixe.length).includes("/")
      ? path.slice(prefixe.length)
      : null;

  return [
    bearerOf(request),
    segment === null ? null : decodeOrNull(segment),
    porte.queryKey === undefined ? null : url.searchParams.get(porte.queryKey),
  ];
}

/** Les secrets admis, dans l'ordre. Liste vide ⇒ tout est refusé (fermé par défaut). */
export function secretsAdmis(env: Record<string, unknown>, porte: Porte): string[] {
  return porte.nomsSecrets
    .map((nom) => env[nom])
    .map((v) => (typeof v === "string" ? v.trim() : undefined))
    .filter((v): v is string => v !== undefined && v.length > 0);
}

/**
 * Le jeton présenté apparie-t-il l'un des secrets admis ?
 *
 * AUCUN COURT-CIRCUIT, c'est l'exigence centrale : la double boucle parcourt TOUS les
 * secrets et TOUS les porteurs même après un appariement. Un `.some()` ou une chaîne de
 * `||` sortirait au premier secret qui apparie, et le TEMPS DE RÉPONSE dirait alors LEQUEL
 * a été présenté — c'est-à-dire QUEL CLIENT ON EST, à un tiers qui sonde. La branche porte
 * sur la FORME de la requête (ce porteur est-il présent ?), jamais sur le secret : elle ne
 * révèle rien de plus que ce que l'appelant a lui-même envoyé.
 *
 * FERMÉ PAR DÉFAUT, sans exception : `attendus` vide ⇒ la boucle ne trouve rien ⇒ refus.
 */
export function apparie(
  presentes: readonly (string | null)[],
  attendus: readonly string[],
): boolean {
  let autorise = false;
  for (const attendu of attendus) {
    for (const presente of presentes) {
      if (presente !== null && safeEqual(presente, attendu)) autorise = true;
    }
  }
  return autorise;
}

/**
 * Autorise (ou non) un appel sous le point de montage.
 *
 * Rend la requête à servir — URL normalisée sur le chemin de montage, segment-jeton retiré,
 * chaîne de requête préservée — ou `null` si l'appel doit repartir en refus.
 */
export function ouvrir(
  request: Request,
  url: URL,
  env: Record<string, unknown>,
  porte: Porte,
): Request | null {
  const presentes = porteursPresentes(request, url, porte);
  if (!apparie(presentes, secretsAdmis(env, porte))) return null;

  // Normalisation. Elle teste `url.pathname`, PAS le chemin rogné : calculée sur le chemin
  // rogné, la condition était satisfaite par un `/mcp/` nu, qui repartait donc SANS
  // normalisation — le transport ne reconnaissait pas le chemin et rendait 404. MESURÉ le
  // 2026-08-27 : `/mcp/` + Bearer donnait 404 là où `/mcp/<jeton>/` donnait 200. Le slash
  // final DOIT être toléré PARTOUT : son 404 a déjà poussé un connecteur en découverte
  // OAuth, où il est resté coincé irréversiblement (2026-07-23).
  //
  // La ligne suivante rend la requête ORIGINALE sur le chemin chaud. Ne pas la
  // « nettoyer » : reconstruire un Request autour d'un flux de corps pour rien est un
  // changement de comportement sur le trajet de TOUS les clients.
  const query = porte.queryKey === undefined ? null : url.searchParams.get(porte.queryKey);
  if (url.pathname === porte.mount && query === null) return request;

  const normalise = new URL(url);
  normalise.pathname = porte.mount;
  if (porte.queryKey !== undefined) normalise.searchParams.delete(porte.queryKey);
  return new Request(normalise.toString(), request);
}

// ── Fabrique de jetons (correctif A2) ───────────────────────────────────────────────────

/** Longueur d'un jeton frappé : 32 octets en base64url, sans remplissage. */
export const LONGUEUR_JETON = 43;

/**
 * LA seule fabrique de jetons du dispositif (correctif A2 de la spécification).
 *
 * 256 bits. Le jeton voyage en clair dans une URL là où `queryKey` est servi, il ne
 * bénéficie d'aucun secret d'appoint, et il constitue à lui seul le facteur
 * d'authentification. À cette taille, la recherche exhaustive cesse d'être une hypothèse à
 * défendre — ce qui est le but, l'étage de débit anonyme (A1) n'étant qu'un filet.
 *
 * `base64url` sans remplissage : les trois porteurs sont un segment de chemin, un paramètre
 * de requête et un en-tête ; l'alphabet doit traverser les trois sans encodage, sinon
 * `decodeURIComponent` et la comparaison divergent selon le porteur employé.
 *
 * Aucune structure interne, aucun préfixe parlant : un jeton qui se lit renseigne celui qui
 * l'intercepte, et invite à décider sur son contenu plutôt que sur la table.
 */
export function frapperJeton(): string {
  const octets = new Uint8Array(32);
  crypto.getRandomValues(octets);
  let binaire = "";
  for (const o of octets) binaire += String.fromCharCode(o);
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Empreinte d'un jeton : SHA-256, en hexadécimal minuscule.
 *
 * C'est ce que la table `jeton` conserve ; le jeton en clair n'existe nulle part après son
 * émission. La comparaison se fait alors par l'INDEX, sur un condensé — aucune fuite de
 * préfixe n'est possible, contrairement à un `===` sur le jeton lui-même.
 */
export async function empreinte(jeton: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(jeton));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
