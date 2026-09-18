import { describe, expect, it } from "vitest";
import { type JsonSchema, TYPES_CONNUS, validateArgs } from "../src/protocole/valide";

const objet = (props: Record<string, JsonSchema>, required?: string[]): JsonSchema => ({
  type: "object",
  properties: props,
  required,
  additionalProperties: false,
});

describe("types", () => {
  it("accepte ce qui correspond, refuse le reste, en français", () => {
    const s = objet({ n: { type: "integer" } });
    expect(validateArgs(s, { n: 3 })).toEqual([]);
    expect(validateArgs(s, { n: "3" })).toEqual(["« n » doit être un entier."]);
  });

  it("un entier n'est pas un flottant", () => {
    expect(validateArgs(objet({ n: { type: "integer" } }), { n: 1.5 })).toHaveLength(1);
    expect(validateArgs(objet({ n: { type: "number" } }), { n: 1.5 })).toEqual([]);
  });

  it("NaN et Infinity ne sont pas des nombres valides", () => {
    const s = objet({ n: { type: "number" } });
    expect(validateArgs(s, { n: Number.NaN })).toHaveLength(1);
    expect(validateArgs(s, { n: Number.POSITIVE_INFINITY })).toHaveLength(1);
  });

  it("un tableau n'est pas un objet", () => {
    expect(validateArgs({ type: "object" }, [])).toHaveLength(1);
  });

  it("un entier borné rend un message qui donne les DEUX bornes", () => {
    const s = objet({ n: { type: "integer", minimum: 1, maximum: 50 } });
    expect(validateArgs(s, { n: "x" })).toEqual([
      "« n » doit être un entier compris entre 1 et 50.",
    ]);
  });
});

describe("le piège du type inconnu", () => {
  it("un `type` hors de TYPES_CONNUS DÉSARME la validation, en silence", () => {
    // Comportement réel, documenté pour qu'il ne soit pas redécouvert : une coquille dans
    // un schéma ne fait pas échouer la validation — elle la supprime pour ce champ.
    const s = objet({ n: { type: "integar" } });
    expect(validateArgs(s, { n: "manifestement pas un entier" })).toEqual([]);
  });

  it("TYPES_CONNUS énumère exactement ce que le validateur sait contrôler", () => {
    // Cette liste a grandi une fois, par décision écrite : `null` y est entré avec l'union
    // de types. C'est le rôle de cette garde — l'ensemble ne bouge pas en passant.
    expect([...TYPES_CONNUS]).toEqual([
      "object",
      "string",
      "integer",
      "number",
      "boolean",
      "array",
      "null",
    ]);
  });
});

describe("l'union de types", () => {
  // POURQUOI ELLE EXISTE. Une colonne D1 nullable rend `null`. Trois issues se présentaient :
  // taire les nulls dans la charge (mensonge par omission, et à répéter dix fois), publier le
  // champ sans `type` (contrat perdu), ou apprendre l'union au validateur. La troisième est
  // du draft-07 standard, et c'est la seule qui DISE la nullabilité au client.

  it("accepte chacun des membres", () => {
    const s = objet({ d: { type: ["string", "null"] } });
    expect(validateArgs(s, { d: "texte" })).toEqual([]);
    expect(validateArgs(s, { d: null })).toEqual([]);
  });

  it("refuse ce qui n'est d'aucun membre, et le dit en toutes lettres", () => {
    const s = objet({ d: { type: ["string", "null"] } });
    const e = validateArgs(s, { d: 42 });
    expect(e).toHaveLength(1);
    expect(e[0]).toContain("une chaîne de caractères ou nul");
  });

  it("`null` seul reste un type à part entière", () => {
    const s = objet({ d: { type: "null" } });
    expect(validateArgs(s, { d: null })).toEqual([]);
    expect(validateArgs(s, { d: "x" })).toHaveLength(1);
  });

  it("un `null` admis n'entraîne pas les contrôles de chaîne", () => {
    // `typeof null === "object"` : sans la garde `value !== null`, la branche objet
    // s'exécuterait sur un null et réclamerait ses `required`.
    const s = objet({
      d: { type: ["object", "null"], properties: { x: { type: "string" } }, required: ["x"] },
    });
    expect(validateArgs(s, { d: null })).toEqual([]);
    expect(validateArgs(s, { d: {} })).toHaveLength(1);
  });

  it("une union vide ne contraint rien plutôt que de tout refuser", () => {
    const s = objet({ d: { type: [] } });
    expect(validateArgs(s, { d: 1 })).toEqual([]);
  });
});

describe("le piège des valeurs par défaut", () => {
  it("`default` n'est JAMAIS appliqué — il est publié, pas exécuté", () => {
    // Le défaut vit dans le schéma publié par `tools/list` ; la valeur, elle, doit
    // descendre dans le gestionnaire. Un schéma qui porte `default` ne fait rien arriver.
    const s = objet({ lang: { type: "string", enum: ["fr", "en"], default: "fr" } });
    const args: Record<string, unknown> = {};
    expect(validateArgs(s, args)).toEqual([]);
    expect(args.lang).toBeUndefined();
  });
});

describe("contraintes", () => {
  it("enum", () => {
    const s = objet({ l: { type: "string", enum: ["fr", "en"] } });
    expect(validateArgs(s, { l: "fr" })).toEqual([]);
    expect(validateArgs(s, { l: "de" })[0]).toContain('"fr", "en"');
  });

  it("minLength compte les caractères NON BLANCS", () => {
    const s = objet({ q: { type: "string", minLength: 2 } });
    expect(validateArgs(s, { q: "   " })).toHaveLength(1);
    expect(validateArgs(s, { q: " ab " })).toEqual([]);
  });

  it("maxLength compte les caractères bruts, blancs compris", () => {
    expect(
      validateArgs(objet({ q: { type: "string", maxLength: 3 } }), { q: "   a" }),
    ).toHaveLength(1);
  });

  it("un booléen échappe aux bornes et aux longueurs", () => {
    const s = objet({ b: { type: "boolean", minimum: 5, minLength: 99 } });
    expect(validateArgs(s, { b: false })).toEqual([]);
  });

  it("minItems, maxItems, et items sur UN niveau", () => {
    const s = objet({
      xs: { type: "array", items: { type: "integer" }, minItems: 1, maxItems: 2 },
    });
    expect(validateArgs(s, { xs: [1] })).toEqual([]);
    expect(validateArgs(s, { xs: [] })).toHaveLength(1);
    expect(validateArgs(s, { xs: [1, 2, 3] })).toHaveLength(1);
    expect(validateArgs(s, { xs: [1, "x"] })).toEqual(["« xs[1] » doit être un entier."]);
  });
});

describe("objets", () => {
  it("required signale chaque manquant", () => {
    const s = objet({ a: { type: "string" }, b: { type: "string" } }, ["a", "b"]);
    expect(validateArgs(s, {})).toEqual(["« a » est obligatoire.", "« b » est obligatoire."]);
  });

  it("additionalProperties false refuse l'inconnu", () => {
    expect(validateArgs(objet({ a: { type: "string" } }), { z: 1 })).toEqual([
      "« z » n'est pas un argument reconnu.",
    ]);
  });

  it("sans additionalProperties false, l'inconnu passe", () => {
    const s: JsonSchema = { type: "object", properties: { a: { type: "string" } } };
    expect(validateArgs(s, { z: 1 })).toEqual([]);
  });

  it("les erreurs s'accumulent au lieu de s'arrêter à la première", () => {
    const s = objet({ a: { type: "integer" }, b: { type: "string" } }, ["c"]);
    expect(validateArgs(s, { a: "x", b: 2 })).toHaveLength(3);
  });
});

describe("$schema", () => {
  it("est accepté par le type, et IGNORÉ par la validation", () => {
    // Publié pour le client — `2026-07-28` lit l'absence de ce champ comme « 2020-12 » —
    // mais le validateur n'implémente qu'un sous-ensemble commun aux dialectes : il n'a
    // pas à trancher, et ne doit surtout pas refuser un schéma parce qu'il le porte.
    const s: JsonSchema = {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: { n: { type: "integer" } },
      additionalProperties: false,
    };
    expect(validateArgs(s, { n: 1 })).toEqual([]);
    expect(validateArgs(s, { n: "x" })).toHaveLength(1);
  });
});
