import { describe, expect, it } from "vitest";
import { validateArgs } from "../src/protocole/valide";
import {
  AUCUNE_RESERVE,
  enveloppe,
  type Garde,
  type GardesObligatoires,
  type Provenance,
  severiteMax,
} from "../src/sortie/enveloppe";
import { declarerRegistre, SCHEMA_GARDE, schemaEnveloppe } from "../src/sortie/gardes";

/** Registre FACTICE : le socle ne connaît aucun code réel, et c'est la frontière. */
type Code = "PROVISOIRE" | "CACHE" | "PARTIEL";

const REGISTRE = declarerRegistre<Code>({
  PROVISOIRE: { code: "PROVISOIRE", severite: "reserve", texte: "Résultat à vérifier." },
  CACHE: { code: "CACHE", severite: "information", texte: "Réponse servie du cache." },
  PARTIEL: { code: "PARTIEL", severite: "avertissement", texte: "Résultat incomplet." },
});

const PROV: Provenance = { source: "essai", autorite: "Essai", cache: "aucun" };

const base = {
  contexte: "https://exemple.test/ns/v1",
  type: "Chose",
  donnees: { n: 1 },
  provenance: PROV,
  registre: REGISTRE,
};

describe("declarerRegistre", () => {
  it("refuse une entrée dont le `code` ne correspond pas à sa clef", () => {
    // Le défaut que ça ferme : une entrée copiée-collée dont on change la clef sans
    // changer le code — la sortie annonce alors un code et en publie un autre.
    expect(() =>
      declarerRegistre({ A: { code: "B", severite: "reserve", texte: "x" } } as never),
    ).toThrow(/code/);
  });

  it("refuse un texte vide — une réserve muette ne réserve rien", () => {
    expect(() =>
      declarerRegistre({ A: { code: "A", severite: "reserve", texte: "   " } } as never),
    ).toThrow(/vide/);
  });
});

describe("enveloppe — la non-vacuité par CONSTRUCTION", () => {
  it("les gardes obligatoires sont posées par le constructeur, pas par l'appelant", () => {
    const e = enveloppe({ ...base, obligatoires: ["PROVISOIRE"] });
    expect(e.gardes).toHaveLength(1);
    expect(e.gardes[0]?.code).toBe("PROVISOIRE");
  });

  it("les supplémentaires s'ajoutent, sans doublon", () => {
    const e = enveloppe({
      ...base,
      obligatoires: ["PROVISOIRE"],
      supplementaires: ["CACHE", "PROVISOIRE"],
    });
    expect(e.gardes.map((g) => g.code)).toEqual(["PROVISOIRE", "CACHE"]);
  });

  it("AUCUNE_RESERVE permet une enveloppe sans garde — mais il faut l'ÉCRIRE", () => {
    const e = enveloppe({ ...base, obligatoires: AUCUNE_RESERVE });
    expect(e.gardes).toEqual([]);
  });

  it("un code hors registre est une erreur, pas une garde silencieusement omise", () => {
    expect(() =>
      enveloppe({ ...base, obligatoires: ["INCONNU"] as unknown as GardesObligatoires<Code> }),
    ).toThrow(/inconnu/i);
  });

  it("le filet d'exécution attrape un `as` qui aurait contourné les types", () => {
    // La couche de types couvre déjà le cas ; celle-ci existe parce qu'un `as` mal placé la
    // contourne, et qu'une enveloppe sans réserve est ce que S5 rend catastrophique.
    expect(() =>
      enveloppe({ ...base, obligatoires: [] as unknown as GardesObligatoires<Code> }),
    ).toThrow(/sans garde/);
  });

  it("porte @context, @type, donnees et provenance ; @id seulement s'il existe", () => {
    const e = enveloppe({ ...base, obligatoires: AUCUNE_RESERVE });
    expect(e["@context"]).toBe("https://exemple.test/ns/v1");
    expect(e["@type"]).toBe("Chose");
    expect(e.donnees).toEqual({ n: 1 });
    expect(e.provenance).toEqual(PROV);
    expect("@id" in e).toBe(false);
    expect("pagination" in e).toBe(false);
  });

  it("porte @id et pagination quand on les fournit", () => {
    const e = enveloppe({
      ...base,
      obligatoires: AUCUNE_RESERVE,
      id: "https://exemple.test/id/1",
      pagination: { offset: 0, limite: 10, total: 42 },
    });
    expect(e["@id"]).toBe("https://exemple.test/id/1");
    expect(e.pagination).toEqual({ offset: 0, limite: 10, total: 42 });
  });
});

describe("severiteMax", () => {
  it("rend la plus forte présente, et null sur une liste vide", () => {
    const g = (s: Garde["severite"]): Garde => ({ code: "X", severite: s, texte: "t" });
    expect(severiteMax([])).toBeNull();
    expect(severiteMax([g("information"), g("avertissement"), g("reserve")])).toBe("avertissement");
    expect(severiteMax([g("information")])).toBe("information");
  });
});

describe("schemaEnveloppe — la contrainte SUR LE FIL", () => {
  const schema = schemaEnveloppe({ type: "object" });

  it("pose minItems 1 sur gardes — la seule couche qui survit à JSON.stringify", () => {
    const g = schema.properties?.gardes;
    expect(g?.minItems).toBe(1);
  });

  it("une enveloppe SANS garde est refusée par le schéma publié", () => {
    // C'est ce qui fait que la porte G5 attrape le cas, sans test supplémentaire à écrire.
    const sansGarde = {
      "@context": "c",
      "@type": "t",
      donnees: {},
      provenance: PROV,
      gardes: [],
    };
    expect(validateArgs(schema, sansGarde)).toHaveLength(1);
  });

  it("une enveloppe AVEC garde passe", () => {
    const avec = {
      "@context": "c",
      "@type": "t",
      donnees: {},
      provenance: PROV,
      gardes: [REGISTRE.PROVISOIRE],
    };
    expect(validateArgs(schema, avec)).toEqual([]);
  });

  it("sans réserve déclarée, le plancher disparaît — et seulement là", () => {
    const libre = schemaEnveloppe({ type: "object" }, false);
    expect(libre.properties?.gardes?.minItems).toBeUndefined();
    const sansGarde = {
      "@context": "c",
      "@type": "t",
      donnees: {},
      provenance: PROV,
      gardes: [],
    };
    expect(validateArgs(libre, sansGarde)).toEqual([]);
  });

  it("une garde mal formée est refusée par son schéma", () => {
    expect(validateArgs(SCHEMA_GARDE, { code: "X", severite: "urgent", texte: "t" })).toHaveLength(
      1,
    );
  });

  it("provenance sans autorité est refusée — sans elle, rien n'est citable", () => {
    const sansAutorite = {
      "@context": "c",
      "@type": "t",
      donnees: {},
      provenance: { source: "x", cache: "aucun" },
      gardes: [REGISTRE.CACHE],
    };
    expect(validateArgs(schema, sansAutorite).join(" ")).toMatch(/autorite/);
  });
});
