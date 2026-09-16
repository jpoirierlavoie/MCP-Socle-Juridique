import { describe, expect, it } from "vitest";
import {
  apparie,
  bearerOf,
  empreinte,
  frapperJeton,
  LONGUEUR_JETON,
  ouvrir,
  type Porte,
  porteursPresentes,
  safeEqual,
  secretsAdmis,
  trimTrailingSlash,
} from "../src/identite/porteur";

const PORTE_TROIS: Porte = {
  mount: "/mcp",
  queryKey: "key",
  nomsSecrets: ["MCP_TOKEN", "MCP_TOKEN_ATHENA"],
};
const PORTE_DEUX: Porte = { mount: "/mcp", nomsSecrets: ["MCP_SHARED_SECRET"] };

const JETON = "jeton-de-test-parfaitement-quelconque";
const req = (url: string, h: Record<string, string> = {}) => new Request(url, { headers: h });
const u = (s: string) => new URL(s);

describe("trimTrailingSlash", () => {
  it("tolère le slash final partout, mais préserve la racine", () => {
    expect(trimTrailingSlash("/mcp/")).toBe("/mcp");
    expect(trimTrailingSlash("/mcp///")).toBe("/mcp");
    expect(trimTrailingSlash("/")).toBe("/");
  });
});

describe("safeEqual", () => {
  it("apparie l'égal, refuse le différent et l'inégal en longueur", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("bearerOf", () => {
  it("lit le porteur, insensible à la casse, et rogne", () => {
    expect(bearerOf(req("https://x/", { Authorization: `Bearer ${JETON}` }))).toBe(JETON);
    expect(bearerOf(req("https://x/", { Authorization: `bearer   ${JETON}  ` }))).toBe(JETON);
  });

  it("rend null sans en-tête, ou sur un schéma étranger", () => {
    expect(bearerOf(req("https://x/"))).toBeNull();
    expect(bearerOf(req("https://x/", { Authorization: `Basic ${JETON}` }))).toBeNull();
  });
});

describe("porteursPresentes", () => {
  it("lit les trois porteurs quand la porte les sert", () => {
    const r = req(`https://x/mcp/${JETON}?key=${JETON}`, { Authorization: `Bearer ${JETON}` });
    expect(porteursPresentes(r, u(r.url), PORTE_TROIS)).toEqual([JETON, JETON, JETON]);
  });

  it("N'OUVRE PAS le porteur ?key= quand la porte ne le déclare pas", () => {
    // C'est l'écart qui protège `jurisprudence` : monter ce fichier ne doit lui donner
    // aucune surface d'accès qu'il n'a pas aujourd'hui.
    const r = req(`https://x/mcp?key=${JETON}`);
    expect(porteursPresentes(r, u(r.url), PORTE_DEUX)).toEqual([null, null, null]);
  });

  it("refuse un segment de chemin trop profond", () => {
    const r = req(`https://x/mcp/${JETON}/encore`);
    expect(porteursPresentes(r, u(r.url), PORTE_TROIS)[1]).toBeNull();
  });

  it("tolère le slash final sur le segment", () => {
    const r = req(`https://x/mcp/${JETON}/`);
    expect(porteursPresentes(r, u(r.url), PORTE_TROIS)[1]).toBe(JETON);
  });

  it("un pourcentage malformé rend null, jamais une exception", () => {
    const r = req("https://x/mcp/%zz");
    expect(() => porteursPresentes(r, u(r.url), PORTE_TROIS)).not.toThrow();
    expect(porteursPresentes(r, u(r.url), PORTE_TROIS)[1]).toBeNull();
  });

  it("rend TOUJOURS trois emplacements — la longueur ne dit rien de la requête", () => {
    expect(porteursPresentes(req("https://x/mcp"), u("https://x/mcp"), PORTE_TROIS)).toHaveLength(
      3,
    );
  });
});

describe("secretsAdmis — fermé par défaut", () => {
  it("ignore l'absent, le vide et le blanc", () => {
    const env = { MCP_TOKEN: "  ", MCP_TOKEN_ATHENA: "" };
    expect(secretsAdmis(env, PORTE_TROIS)).toEqual([]);
  });

  it("rogne, et conserve l'ordre déclaré", () => {
    const env = { MCP_TOKEN: " a ", MCP_TOKEN_ATHENA: "b" };
    expect(secretsAdmis(env, PORTE_TROIS)).toEqual(["a", "b"]);
  });

  it("un nom de secret mal orthographié n'ouvre rien", () => {
    expect(secretsAdmis({ MCP_TOKNE: "a" }, PORTE_TROIS)).toEqual([]);
  });
});

describe("apparie", () => {
  it("AUCUN secret configuré ⇒ tout est refusé, même le bon jeton", () => {
    expect(apparie([JETON, null, null], [])).toBe(false);
  });

  it("apparie n'importe lequel des porteurs contre n'importe lequel des secrets", () => {
    expect(apparie([null, "b", null], ["a", "b"])).toBe(true);
    expect(apparie(["a", null, null], ["a", "b"])).toBe(true);
    expect(apparie(["z", null, null], ["a", "b"])).toBe(false);
  });

  it("retirer un secret laisse l'autre servir — révocation séparée", () => {
    expect(apparie(["b", null, null], ["a"])).toBe(false);
    expect(apparie(["a", null, null], ["a"])).toBe(true);
  });
});

describe("ouvrir", () => {
  const env = { MCP_TOKEN: JETON };

  it("refuse en rendant null", () => {
    const r = req("https://x/mcp", { Authorization: "Bearer faux" });
    expect(ouvrir(r, u(r.url), env, PORTE_TROIS)).toBeNull();
  });

  it("rend la requête ORIGINALE sur le chemin chaud", () => {
    const r = req("https://x/mcp", { Authorization: `Bearer ${JETON}` });
    expect(ouvrir(r, u(r.url), env, PORTE_TROIS)).toBe(r);
  });

  it("normalise `/mcp/` nu — le cas mesuré le 2026-08-27", () => {
    // Testé sur `url.pathname`, non sur le chemin rogné : sinon `/mcp/` repartait sans
    // normalisation et le transport rendait 404.
    const r = req("https://x/mcp/", { Authorization: `Bearer ${JETON}` });
    const out = ouvrir(r, u(r.url), env, PORTE_TROIS);
    expect(new URL((out as Request).url).pathname).toBe("/mcp");
  });

  it("retire le segment-jeton et le paramètre, garde le reste de la requête", () => {
    const r = req(`https://x/mcp/${JETON}?key=${JETON}&autre=1`);
    const out = ouvrir(r, u(r.url), env, PORTE_TROIS) as Request;
    const sortie = new URL(out.url);
    expect(sortie.pathname).toBe("/mcp");
    expect(sortie.searchParams.get("key")).toBeNull();
    expect(sortie.searchParams.get("autre")).toBe("1");
  });

  it("aucun secret posé ⇒ refus, quel que soit le porteur", () => {
    for (const r of [
      req("https://x/mcp", { Authorization: `Bearer ${JETON}` }),
      req(`https://x/mcp/${JETON}`),
      req(`https://x/mcp?key=${JETON}`),
    ]) {
      expect(ouvrir(r, u(r.url), {}, PORTE_TROIS)).toBeNull();
    }
  });
});

describe("frapperJeton — correctif A2", () => {
  it("rend 43 caractères base64url, sans remplissage", () => {
    const j = frapperJeton();
    expect(j).toHaveLength(LONGUEUR_JETON);
    expect(j).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("traverse les trois porteurs sans encodage", () => {
    // Si l'alphabet exigeait un encodage, la comparaison divergerait selon le porteur :
    // le segment de chemin passe par decodeURIComponent, l'en-tête non.
    const j = frapperJeton();
    expect(encodeURIComponent(j)).toBe(j);
  });

  it("ne se répète pas", () => {
    const vus = new Set(Array.from({ length: 256 }, () => frapperJeton()));
    expect(vus.size).toBe(256);
  });
});

describe("empreinte", () => {
  it("rend 64 caractères hexadécimaux minuscules, et elle est stable", async () => {
    const e = await empreinte("abc");
    expect(e).toMatch(/^[0-9a-f]{64}$/);
    expect(e).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("deux jetons distincts donnent deux empreintes distinctes", async () => {
    expect(await empreinte(frapperJeton())).not.toBe(await empreinte(frapperJeton()));
  });
});
