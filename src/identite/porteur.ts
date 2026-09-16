/**
 * Extraction et contrôle du jeton porté par une requête.
 *
 * Synthèse des DEUX implémentations existantes, qui avaient divergé. Ce n'est pas un
 * compromis : sur chacun des trois points où elles différaient, l'une avait raison, et
 * c'est la sienne qui est reprise.
 *
 *   1. **La comparaison passe par SHA-256** (forme de `jurisprudence`), non par une boucle
 *      `charCodeAt` (forme de `legislation`). Comparer des empreintes neutralise aussi
 *      l'écart de LONGUEUR, que la seconde laissait fuir — `legislation` le notait
 *      elle-même en commentaire comme une « suite possible ». C'est cette suite.
 *   2. **L'extraction ÉLARGIT, elle ne TRANSFORME pas** (forme de `jurisprudence`,
 *      corrigée le 2026-09-16). On ajoute des candidats — la graphie brute, la graphie
 *      sans barres finales, et leurs formes décodées — sans jamais en remplacer un. Le
 *      motif est décisif : le secret de production n'est pas connu d'ici et ne doit pas
 *      l'être ; il peut lui-même se terminer par « / » ou porter un « % ». Rogner « ce qui
 *      est évidemment de trop » casserait alors une authentification qui fonctionne, sans
 *      qu'aucun test ne le dise. Le pire cas d'un candidat surnuméraire est une empreinte
 *      calculée pour rien ; le pire cas d'un rognage est un connecteur mort.
 *   3. **`queryKey` et `segmentBorne` sont OPTIONNELS**, pour que monter ce fichier
 *      n'élargisse la surface d'aucun des deux dépôts. C'est la seule invention du socle.
 *
 * ÉLARGIR N'EST PAS OUVRIR : toute valeur ainsi admise est une valeur dont la connaissance
 * implique déjà celle du secret. Aucun PRÉFIXE n'est jamais accepté.
 */

/** Ce qu'un dépôt déclare une fois, et que le runtime ET les tests emploient. */
export interface Porte {
  /** Chemin de montage exact, sans barre finale. Par exemple `/mcp`. */
  mount: string;
  /**
   * Nom du paramètre de requête portant le jeton. **Omettre pour n'offrir aucun porteur
   * `?key=`** — `jurisprudence` n'en sert pas. Là où il existe, c'est LA forme employée par
   * le connecteur claude.ai en production : les autres n'ont pas survécu à son formulaire
   * (S7, à re-mesurer avant l'ouverture, jamais à présumer).
   */
  queryKey?: string;
  /** Noms des variables d'environnement portant les secrets admis, dans l'ordre. */
  nomsSecrets: readonly string[];
  /**
   * Borner le porteur de chemin à UN SEUL segment (`/mcp/<jeton>`, rien de plus profond).
   *
   * Nécessaire tant qu'un dépôt REMONTE la requête sur son chemin de montage : une
   * profondeur imprévue y casserait le routage. Inutile — et donc un rétrécissement sans
   * contrepartie — pour un dépôt où le chemin n'est qu'un porteur et où `/mcp*` est capté
   * en entier. `legislation` en a besoin tant qu'il réécrit l'URL ; `jurisprudence` non.
   */
  segmentBorne?: boolean;
}

/**
 * Comparaison À TEMPS CONSTANT, sur les empreintes plutôt que sur les chaînes.
 *
 * Passer par SHA-256 neutralise aussi l'écart de LONGUEUR : `timingSafeEqual` exige deux
 * tampons de même taille et lèverait sur des chaînes de longueurs différentes — ce qui, en
 * soi, divulguerait la longueur du secret.
 */
export async function memeSecret(presente: string, attendu: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(presente)),
    crypto.subtle.digest("SHA-256", enc.encode(attendu)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

/**
 * `decodeURIComponent` LÈVE une `URIError` sur un pourcentage malformé (`/mcp/x%FF`).
 *
 * ⚠ L'exception est avalée SANS AUCUNE TRACE, et c'est délibéré : le segment fautif EST le
 *   secret présenté. Ni `console.error`, ni le message de l'`URIError`, ni `request.url`.
 *   Ne pas « ajouter un log pour déboguer » : ce serait publier le secret dans les traces.
 */
export function decodeOrNull(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** Barres obliques finales ôtées, toutes d'un coup. La racine est préservée. */
export function trimTrailingSlash(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/** Jeton porté par l'en-tête `Authorization`, ou `null`. */
export function bearerOf(request: Request): string | null {
  const raw = request.headers.get("Authorization");
  if (!raw) return null;
  // `\s+` et le drapeau `/i` : le nom du schéma est insensible à la casse (RFC 7235 §2.1),
  // et un `startsWith("Bearer ")` refusait « bearer x » comme « Bearer  x ».
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m?.[1] ? m[1].trim() : null;
}

/**
 * Les jetons PRÉSENTÉS par la requête — tous les porteurs, toutes leurs graphies
 * plausibles, sans aucune préséance entre eux, dédoublonnés.
 *
 * ⚠ AUCUN PORTEUR N'EN MASQUE UN AUTRE. Cette fonction rendait autrefois UNE valeur par
 *   retour anticipé, si bien qu'un `Authorization` résiduel — périmé, collé d'un autre
 *   connecteur, posé par un mandataire — rendait inopérante une URL parfaitement correcte,
 *   et son refus était indiscernable d'un mauvais secret.
 *
 * ⚠ LA BARRE FINALE EST LE DÉFAUT QUI A COÛTÉ UN CONNECTEUR. Les clients normalisent l'URL
 *   saisie et y ajoutent « / ». Le refus qui s'ensuivait n'était pas lu comme « mauvais
 *   secret » mais comme « ressource OAuth protégée » : le client enchaîne sur
 *   `.well-known/*`, puis sur `POST /register`, et l'inscription dynamique échoue. Il reste
 *   coincé là, irréversiblement (2026-07-23).
 *
 * Limite connue et assumée : les barres finales sont ôtées toutes d'un coup, non une à une.
 * Un secret finissant par « / » présenté avec une barre surnuméraire reste refusé. Ce cas
 * n'a aucun client.
 */
export function porteursPresentes(request: Request, url: URL, porte: Porte): string[] {
  const candidats: (string | null)[] = [bearerOf(request)];

  const prefixe = `${porte.mount}/`;
  if (url.pathname.startsWith(prefixe)) {
    const brut = url.pathname.slice(prefixe.length);
    const profond = brut.replace(/\/+$/, "").includes("/");
    if (brut.length > 0 && !(porte.segmentBorne === true && profond)) {
      const rogne = brut.replace(/\/+$/, "");
      // `rogne` EN PLUS de `brut`, jamais à sa place.
      for (const forme of rogne === brut ? [brut] : [brut, rogne]) {
        candidats.push(forme); // tel quel : ferme le cas « le secret contient un % »
        candidats.push(decodeOrNull(forme)); // décodé : le cas normal
      }
    }
  }

  if (porte.queryKey !== undefined) candidats.push(url.searchParams.get(porte.queryKey));

  // Dédoublonnage. Sur un jeton base64url sans barre finale — le cas normal — les quatre
  // graphies du chemin se réduisent à UNE. La comparaison n'oppose que des valeurs
  // PRÉSENTÉES entre elles : elle ne touche aucun secret attendu, et n'en divulgue rien.
  return [...new Set(candidats.filter((c): c is string => c !== null && c.length > 0))];
}

/** Les secrets admis, dans l'ordre. Liste vide ⇒ tout est refusé (fermé par défaut). */
export function secretsAdmis(env: Record<string, unknown>, porte: Porte): string[] {
  return porte.nomsSecrets
    .map((nom) => env[nom])
    .map((v) => (typeof v === "string" ? v.trim() : undefined))
    .filter((v): v is string => v !== undefined && v.length > 0);
}

/**
 * L'un des jetons présentés est-il l'un des secrets admis ?
 *
 * ⚠ AUCUN COURT-CIRCUIT. `Promise.all` résout l'INTÉGRALITÉ du produit avant que `some` ne
 *   lise des booléens déjà calculés. Une chaîne de `||` sortirait au premier secret
 *   apparié, et le temps de réponse dirait alors LEQUEL a été présenté — c'est-à-dire QUEL
 *   CLIENT on est, à un tiers qui sonde.
 *
 * ⚠ FERMÉ PAR DÉFAUT, DES DEUX CÔTÉS DU PRODUIT. Liste vide d'un côté OU de l'autre ⇒
 *   produit vide ⇒ `some` rend faux ⇒ tout est refusé. « Aucun porteur présenté » se traite
 *   donc par la MÊME ligne que « aucun secret configuré » : le défaut fermé est structurel,
 *   au lieu de reposer sur une garde `if` qu'un remaniement pourrait laisser tomber.
 */
export async function apparie(
  presentes: readonly string[],
  attendus: readonly string[],
): Promise<boolean> {
  const verdicts = await Promise.all(
    attendus.flatMap((attendu) => presentes.map((presente) => memeSecret(presente, attendu))),
  );
  return verdicts.some(Boolean);
}

/**
 * Autorise (ou non) un appel sous le point de montage.
 *
 * Rend la requête à servir — URL normalisée sur le chemin de montage, jeton retiré du
 * chemin et de la requête — ou `null` si l'appel doit repartir en refus.
 */
export async function ouvrir(
  request: Request,
  url: URL,
  env: Record<string, unknown>,
  porte: Porte,
): Promise<Request | null> {
  const presentes = porteursPresentes(request, url, porte);
  if (!(await apparie(presentes, secretsAdmis(env, porte)))) return null;

  // La normalisation teste `url.pathname`, PAS le chemin rogné : calculée sur le chemin
  // rogné, la condition était satisfaite par un `/mcp/` nu, qui repartait donc SANS
  // normalisation — le transport ne reconnaissait pas le chemin et rendait 404. MESURÉ le
  // 2026-08-27 : `/mcp/` + Bearer donnait 404 là où `/mcp/<jeton>/` donnait 200.
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
 * de requête et un en-tête ; l'alphabet doit traverser les trois sans encodage. Il ferme
 * aussi le cas de la barre finale — l'alphabet base64 STANDARD, lui, produit des « / ».
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
