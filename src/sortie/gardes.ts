/**
 * Ce qu'il faut pour DÉCLARER un registre de gardes, et pour le publier dans un
 * `outputSchema`.
 *
 * Le socle ne connaît aucun code : il ne connaît que leur forme. Les codes eux-mêmes
 * vivent dans chaque connecteur, avec leur texte — voir la divergence déclarée en tête de
 * `enveloppe.ts`.
 */

import type { JsonSchema } from "../protocole/valide";
import type { Garde, RegistreGardes, Severite } from "./enveloppe";

/**
 * Déclare un registre, en vérifiant que chaque entrée porte bien son propre code.
 *
 * Le contrôle paraît trivial ; il ferme un défaut qui ne se voit pas à la relecture — une
 * entrée copiée-collée dont on a changé la clef sans changer le `code`, de sorte que la
 * sortie annonce un code et en publie un autre.
 */
export function declarerRegistre<C extends string>(
  entrees: Readonly<Record<C, Garde>>,
): RegistreGardes<C> {
  for (const [clef, g] of Object.entries(entrees) as Array<[C, Garde]>) {
    if (g.code !== clef) {
      throw new Error(`Garde « ${clef} » : le champ \`code\` vaut « ${g.code} ».`);
    }
    if (g.texte.trim().length === 0) {
      throw new Error(`Garde « ${clef} » : texte vide. Une réserve muette ne réserve rien.`);
    }
  }
  return entrees;
}

/** Le schéma d'UNE garde, tel qu'il est publié. */
export const SCHEMA_GARDE: JsonSchema = {
  type: "object",
  properties: {
    code: { type: "string", description: "Code du registre des mises en garde." },
    severite: {
      type: "string",
      enum: ["information", "reserve", "avertissement"],
      description: "Gravité de la réserve.",
    },
    texte: { type: "string", description: "La réserve, en toutes lettres." },
  },
  required: ["code", "severite", "texte"],
  additionalProperties: false,
};

/** Le schéma de la provenance. Sans elle, une sortie n'est pas citable. */
export const SCHEMA_PROVENANCE: JsonSchema = {
  type: "object",
  properties: {
    source: { type: "string" },
    autorite: { type: "string", description: "L'autorité qui fait foi." },
    corpus_version: { type: "string", description: "L'expression FRBR, ex. « 2026-04-01 »." },
    releve_le: { type: "string", description: "Date du relevé, pour une table compilée." },
    cache: { type: "string", enum: ["aucun", "local", "arete"] },
    cache_pose_le: { type: "string" },
  },
  required: ["source", "autorite", "cache"],
  additionalProperties: false,
};

/**
 * Construit l'`outputSchema` d'un outil : l'enveloppe, autour du schéma de ses données.
 *
 * ⚠ `minItems: 1` SUR `gardes` EST LA TROISIÈME COUCHE de la contrainte, et la seule qui
 *   voyage SUR LE FIL. Les deux premières — n-uplet non vide, fusion par le constructeur —
 *   vivent dans les types, et aucun type ne survit à `JSON.stringify`. Avec celle-ci, la
 *   porte G5 (« tout `structuredContent` valide contre son `outputSchema` sur TOUTES les
 *   fixtures ») attrape une enveloppe sans réserve sans qu'on ait à écrire un test de plus.
 *
 * `avecReserve: false` publie un schéma sans ce plancher — à n'employer que là où le
 *   descripteur déclare `AUCUNE_RESERVE`, faute de quoi les deux se contrediraient.
 */
export function schemaEnveloppe(donnees: JsonSchema, avecReserve = true): JsonSchema {
  return {
    type: "object",
    properties: {
      "@context": { type: "string" },
      "@type": { type: "string" },
      "@id": { type: "string", description: "Identifiant déréférençable, s'il en existe un." },
      donnees,
      provenance: SCHEMA_PROVENANCE,
      gardes: {
        type: "array",
        items: SCHEMA_GARDE,
        ...(avecReserve ? { minItems: 1 } : {}),
        description: avecReserve
          ? "Mises en garde applicables. JAMAIS vide pour cet outil."
          : "Mises en garde applicables. Cet outil n'en porte aucune d'office.",
      },
      pagination: {
        type: "object",
        properties: {
          offset: { type: "integer", minimum: 0 },
          limite: { type: "integer", minimum: 1 },
          total: { type: "integer", minimum: 0 },
        },
        required: ["offset", "limite"],
        additionalProperties: false,
      },
    },
    required: ["@context", "@type", "donnees", "provenance", "gardes"],
    additionalProperties: false,
  };
}

/** Les sévérités, pour un rendu ou une page publique qui les énumère. */
export const SEVERITES: readonly Severite[] = ["information", "reserve", "avertissement"];
