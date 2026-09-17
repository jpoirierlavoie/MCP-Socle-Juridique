/**
 * L'enveloppe de sortie structurée, et l'obligation de compilation qui la rend tenable.
 *
 * ⚠ DIVERGENCE DÉCLARÉE AVEC LA SPÉCIFICATION (§2 et §8.4). Elle place « le registre des
 *   codes de mise en garde » dans `sortie/gardes.ts`, donc ICI. Or ce registre contient
 *   `COUVERTURE_CANLII`, `ADRESSE_PERISSABLE`, `TEXTE_A_VERIFIER` — c'est-à-dire des
 *   décisions, des greffes et du texte officiel. La règle de frontière, énoncée en tête du
 *   `CLAUDE.md` de ce dépôt et donnée comme première de toutes, l'interdit.
 *
 *   Le partage retenu : le socle porte le MÉCANISME — le type d'une garde, sa sévérité,
 *   l'enveloppe, et surtout la contrainte de non-vacuité. Chaque connecteur porte SES
 *   codes. Ce n'est pas un contournement : les quatorze codes de la §8.4 sont d'ailleurs
 *   presque disjoints entre les deux dépôts, si bien qu'un registre commun aurait surtout
 *   servi à faire connaître à chacun les réserves de l'autre.
 *
 * POURQUOI CETTE ENVELOPPE EXISTE. S5 renverse deux doctrines écrites, et le mode de panne
 * qu'elles décrivaient est réel : un client qui reçoit un objet typé laisse tomber la prose,
 * la réserve part avec elle, et aucun test ne rougit. La contrepartie n'est pas « ça
 * n'arrivera pas » — c'est que `gardes` soit non vide PAR CONSTRUCTION dès qu'une réserve
 * s'applique.
 */

export type Severite = "information" | "reserve" | "avertissement";

/** Une mise en garde, lisible par une machine autant que par un praticien. */
export interface Garde {
  code: string;
  severite: Severite;
  texte: string;
}

/** D'où vient la donnée servie. Sans cela, une sortie n'est pas citable. */
export interface Provenance {
  source: string;
  /** L'autorité qui fait foi — « Éditeur officiel du Québec », « CanLII », « MJQ ». */
  autorite: string;
  /** L'EXPRESSION au sens FRBR : « 2026-04-01 ». */
  corpus_version?: string;
  /** Pour une table compilée à la main : la date du relevé. */
  releve_le?: string;
  cache: "aucun" | "local" | "arete";
  cache_pose_le?: string;
}

export interface Enveloppe<T> {
  "@context": string;
  "@type": string;
  "@id"?: string;
  donnees: T;
  provenance: Provenance;
  /** JAMAIS vide quand une réserve s'applique — voir `AUCUNE_RESERVE`. */
  gardes: Garde[];
  pagination?: { offset: number; limite: number; total?: number };
}

/**
 * Le refus EXPLICITE de toute réserve, pour un outil qui n'en porte aucune.
 *
 * ⚠ C'EST UN JETON, PAS UNE ABSENCE, et c'est tout le point. Rendre le champ facultatif
 *   aurait laissé passer le vrai mode de panne — l'OUBLI — sans que rien ne le signale.
 *   Ici, ne rien déclarer ne compile pas ; renoncer se lit, se grep et se relit en revue.
 */
export const AUCUNE_RESERVE = "AUCUNE_RESERVE" as const;
export type SansReserve = typeof AUCUNE_RESERVE;

/**
 * Les gardes qu'un outil porte TOUJOURS.
 *
 * Le n-uplet non vide `readonly [C, ...C[]]` est ce qui rend l'oubli impossible : un
 * tableau vide, un `C[]` élargi ou un simple étalement ne s'y assignent pas.
 */
export type GardesObligatoires<C extends string> = readonly [C, ...C[]] | SansReserve;

/** Le registre des codes d'un dépôt : chaque code, sa sévérité, son texte. */
export type RegistreGardes<C extends string> = Readonly<Record<C, Garde>>;

export interface OptionsEnveloppe<T, C extends string> {
  contexte: string;
  type: string;
  id?: string;
  donnees: T;
  provenance: Provenance;
  registre: RegistreGardes<C>;
  /** Ce que l'outil porte toujours — ou le refus explicite. */
  obligatoires: GardesObligatoires<C>;
  /** Ce que CET appel ajoute : cache servi, repli lexical, résultat partiel… */
  supplementaires?: readonly C[];
  pagination?: { offset: number; limite: number; total?: number };
}

/**
 * Construit une enveloppe.
 *
 * ⚠ LE GESTIONNAIRE NE COMPOSE PAS `gardes` LUI-MÊME, et c'est la deuxième couche de la
 *   contrainte. Le laisser faire ramènerait le problème : `reserve ? [G] : []` se type
 *   `Garde[]`, et aucun compilateur ne peut prouver qu'il est non vide sur toutes les
 *   branches. Ici la non-vacuité découle de la CONSTRUCTION — les obligatoires sont
 *   fusionnées par cette fonction, jamais fournies par l'appelant.
 */
export function enveloppe<T, C extends string>(o: OptionsEnveloppe<T, C>): Enveloppe<T> {
  const codes: C[] = o.obligatoires === AUCUNE_RESERVE ? [] : [...(o.obligatoires as readonly C[])];

  for (const c of o.supplementaires ?? []) {
    if (!codes.includes(c)) codes.push(c);
  }

  const gardes = codes.map((c) => {
    const g = o.registre[c];
    if (!g) throw new Error(`Code de garde inconnu du registre : ${String(c)}.`);
    return g;
  });

  // Filet d'exécution : la couche de types couvre déjà le cas, mais un `as` mal placé la
  // contourne, et une enveloppe sans réserve là où il en fallait une est précisément ce
  // que S5 rendrait catastrophique.
  if (o.obligatoires !== AUCUNE_RESERVE && gardes.length === 0) {
    throw new Error("Enveloppe sans garde alors qu'une réserve s'applique.");
  }

  const env: Enveloppe<T> = {
    "@context": o.contexte,
    "@type": o.type,
    donnees: o.donnees,
    provenance: o.provenance,
    gardes,
  };
  if (o.id !== undefined) env["@id"] = o.id;
  if (o.pagination !== undefined) env.pagination = o.pagination;
  return env;
}

/** La sévérité la plus forte présente, ou `null`. Sert au rendu, jamais à la décision. */
export function severiteMax(gardes: readonly Garde[]): Severite | null {
  const ordre: Severite[] = ["information", "reserve", "avertissement"];
  let max: Severite | null = null;
  for (const g of gardes) {
    if (max === null || ordre.indexOf(g.severite) > ordre.indexOf(max)) max = g.severite;
  }
  return max;
}
