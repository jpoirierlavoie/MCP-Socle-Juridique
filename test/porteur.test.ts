import { describe, expect, it } from "vitest";
import {
  apparie,
  bearerOf,
  empreinte,
  frapperJeton,
  LONGUEUR_JETON,
  memeSecret,
  ouvrir,
  type Porte,
  porteursPresentes,
  secretsAdmis,
  trimTrailingSlash,
} from "../src/identite/porteur";

/** `legislation` : trois porteurs, chemin borné à un segment (il réécrit l'URL). */
const PORTE_LEGIS: Porte = {
  mount: "/mcp",
  queryKey: "key",
  nomsSecrets: ["MCP_TOKEN", "MCP_TOKEN_ATHENA"],
  segmentBorne: true,
};
/** `jurisprudence` : deux porteurs, chemin non borné, aucun `?key=`. */
const PORTE_JURIS: Porte = { mount: "/mcp", nomsSecrets: ["MCP_SHARED_SECRET"] };

const JETON = "jeton-de-test-parfaitement-quelconque";
const req = (url: string, h: Record<string, string> = {}) => new Request(url, { headers: h });
const u = (s: string) => new URL(s);
const presentes = (url: string, porte: Porte, h: Record<string, string> = {}) =>
  porteursPresentes(req(url, h), u(url), porte);

describe("trimTrailingSlash", () => {
  it("ôte les barres finales, préserve la racine", () => {
    expect(trimTrailingSlash("/mcp/")).toBe("/mcp");
    expect(trimTrailingSlash("/mcp///")).toBe("/mcp");
    expect(trimTrailingSlash("/")).toBe("/");
  });
});

describe("memeSecret", () => {
  it("apparie l'égal et refuse le reste", async () => {
    expect(await memeSecret("abc", "abc")).toBe(true);
    expect(await memeSecret("abc", "abd")).toBe(false);
  });

  it("ne lève PAS sur des longueurs différentes — c'est tout l'intérêt du condensé", async () => {
    // `timingSafeEqual` exige deux tampons de même taille : comparer les chaînes brutes
    // lèverait, et l'exception elle-même divulguerait la longueur du secret.
    await expect(memeSecret("court", "beaucoup plus long")).resolves.toBe(false);
  });
});

describe("bearerOf", () => {
  it("insensible à la casse, tolérant aux espaces", () => {
    expect(bearerOf(req("https://x/", { Authorization: `Bearer ${JETON}` }))).toBe(JETON);
    expect(bearerOf(req("https://x/", { Authorization: `bearer   ${JETON}` }))).toBe(JETON);
  });

  it("rend null sans en-tête ou sur un schéma étranger", () => {
    expect(bearerOf(req("https://x/"))).toBeNull();
    expect(bearerOf(req("https://x/", { Authorization: `Basic ${JETON}` }))).toBeNull();
  });
});

describe("porteursPresentes — aucun porteur n'en masque un autre", () => {
  it("un Authorization résiduel n'annule pas une URL correcte", () => {
    // Le défaut corrigé : un en-tête périmé masquait définitivement le jeton du chemin, et
    // le refus était indiscernable d'un mauvais secret.
    const p = presentes(`https://x/mcp/${JETON}`, PORTE_LEGIS, { Authorization: "Bearer perime" });
    expect(p).toContain(JETON);
    expect(p).toContain("perime");
  });

  it("lit les trois porteurs quand la porte les sert", () => {
    const p = presentes(`https://x/mcp/${JETON}?key=${JETON}`, PORTE_LEGIS, {
      Authorization: `Bearer ${JETON}`,
    });
    expect(p).toEqual([JETON]); // dédoublonnés : trois porteurs, un seul candidat
  });

  it("N'OUVRE PAS ?key= quand la porte ne le déclare pas", () => {
    expect(presentes(`https://x/mcp?key=${JETON}`, PORTE_JURIS)).toEqual([]);
  });
});

describe("porteursPresentes — élargir, jamais transformer", () => {
  it("la barre finale produit un candidat DE PLUS, pas un remplacement", () => {
    const p = presentes(`https://x/mcp/${JETON}/`, PORTE_LEGIS);
    expect(p).toContain(JETON); // la forme rognée
    expect(p).toContain(`${JETON}/`); // ET la forme brute : le secret peut finir par « / »
  });

  it("la forme BRUTE est conservée — le secret peut contenir un pourcentage", () => {
    const p = presentes("https://x/mcp/a%2Fb", PORTE_LEGIS);
    expect(p).toContain("a%2Fb"); // tel quel
    expect(p).toContain("a/b"); // et décodé
  });

  it("un pourcentage malformé ne lève pas, et ne perd pas la forme brute", () => {
    const p = presentes("https://x/mcp/%zz", PORTE_LEGIS);
    expect(p).toEqual(["%zz"]);
  });

  it("sur un jeton normal, les quatre graphies se réduisent à UNE", () => {
    expect(presentes(`https://x/mcp/${JETON}`, PORTE_LEGIS)).toEqual([JETON]);
  });

  it("aucun PRÉFIXE n'est jamais admis", () => {
    const p = presentes(`https://x/mcp/${JETON}`, PORTE_LEGIS);
    for (const c of p) expect(JETON.startsWith(c) && c !== JETON).toBe(false);
  });
});

describe("porteursPresentes — segmentBorne", () => {
  it("borné : un chemin profond ne présente rien", () => {
    expect(presentes("https://x/mcp/a/b", PORTE_LEGIS)).toEqual([]);
  });

  it("non borné : un chemin profond est un candidat entier", () => {
    // `jurisprudence` ne remonte rien : borner serait un rétrécissement sans contrepartie,
    // et si le secret contenait « / », `/mcp/a/b` l'authentifierait.
    expect(presentes("https://x/mcp/a/b", PORTE_JURIS)).toContain("a/b");
  });

  it("`/mcp` et `/mcp/` ne présentent rien par le chemin", () => {
    expect(presentes("https://x/mcp", PORTE_JURIS)).toEqual([]);
    expect(presentes("https://x/mcp/", PORTE_JURIS)).toEqual([]);
  });
});

describe("secretsAdmis — fermé par défaut", () => {
  it("ignore l'absent, le vide, le blanc, et le nom mal orthographié", () => {
    expect(secretsAdmis({ MCP_TOKEN: "  ", MCP_TOKEN_ATHENA: "" }, PORTE_LEGIS)).toEqual([]);
    expect(secretsAdmis({ MCP_TOKNE: "a" }, PORTE_LEGIS)).toEqual([]);
  });

  it("rogne et conserve l'ordre déclaré", () => {
    expect(secretsAdmis({ MCP_TOKEN: " a ", MCP_TOKEN_ATHENA: "b" }, PORTE_LEGIS)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("apparie — fermé des deux côtés du produit", () => {
  it("aucun secret configuré ⇒ refus, même avec le bon jeton", async () => {
    expect(await apparie([JETON], [])).toBe(false);
  });

  it("aucun porteur présenté ⇒ refus, par la MÊME ligne", async () => {
    expect(await apparie([], [JETON])).toBe(false);
  });

  it("apparie n'importe quel porteur contre n'importe quel secret", async () => {
    expect(await apparie(["b"], ["a", "b"])).toBe(true);
    expect(await apparie(["z"], ["a", "b"])).toBe(false);
  });

  it("retirer un secret laisse l'autre servir — révocation séparée", async () => {
    expect(await apparie(["b"], ["a"])).toBe(false);
    expect(await apparie(["a"], ["a"])).toBe(true);
  });
});

describe("ouvrir", () => {
  const env = { MCP_TOKEN: JETON };

  it("refuse en rendant null", async () => {
    const r = req("https://x/mcp", { Authorization: "Bearer faux" });
    expect(await ouvrir(r, u(r.url), env, PORTE_LEGIS)).toBeNull();
  });

  it("rend la requête ORIGINALE sur le chemin chaud", async () => {
    const r = req("https://x/mcp", { Authorization: `Bearer ${JETON}` });
    expect(await ouvrir(r, u(r.url), env, PORTE_LEGIS)).toBe(r);
  });

  it("normalise `/mcp/` nu — le cas mesuré le 2026-08-27", async () => {
    const r = req("https://x/mcp/", { Authorization: `Bearer ${JETON}` });
    const out = (await ouvrir(r, u(r.url), env, PORTE_LEGIS)) as Request;
    expect(new URL(out.url).pathname).toBe("/mcp");
  });

  it("retire le jeton du chemin et de la requête, garde le reste", async () => {
    const r = req(`https://x/mcp/${JETON}?key=${JETON}&autre=1`);
    const out = (await ouvrir(r, u(r.url), env, PORTE_LEGIS)) as Request;
    const sortie = new URL(out.url);
    expect(sortie.pathname).toBe("/mcp");
    expect(sortie.searchParams.get("key")).toBeNull();
    expect(sortie.searchParams.get("autre")).toBe("1");
  });

  it("aucun secret posé ⇒ refus, quel que soit le porteur", async () => {
    for (const url of [`https://x/mcp/${JETON}`, `https://x/mcp?key=${JETON}`]) {
      expect(await ouvrir(req(url), u(url), {}, PORTE_LEGIS)).toBeNull();
    }
    const r = req("https://x/mcp", { Authorization: `Bearer ${JETON}` });
    expect(await ouvrir(r, u(r.url), {}, PORTE_LEGIS)).toBeNull();
  });

  it("le jeton avec barre finale passe, grâce à l'élargissement", async () => {
    const r = req(`https://x/mcp/${JETON}/`);
    expect(await ouvrir(r, u(r.url), env, PORTE_LEGIS)).not.toBeNull();
  });
});

describe("frapperJeton — correctif A2", () => {
  it("rend 43 caractères base64url sans remplissage", () => {
    const j = frapperJeton();
    expect(j).toHaveLength(LONGUEUR_JETON);
    expect(j).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("traverse les trois porteurs sans encodage, et ne finit jamais par « / »", () => {
    for (let i = 0; i < 64; i++) {
      const j = frapperJeton();
      expect(encodeURIComponent(j)).toBe(j);
      expect(j).not.toContain("/");
    }
  });

  it("ne se répète pas", () => {
    expect(new Set(Array.from({ length: 256 }, frapperJeton)).size).toBe(256);
  });
});

describe("empreinte", () => {
  it("rend 64 hexadécimaux minuscules, et elle est stable", async () => {
    expect(await empreinte("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
