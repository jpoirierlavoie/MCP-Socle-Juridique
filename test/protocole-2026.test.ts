import { describe, expect, it } from "vitest";
import { resultatDecouverte } from "../src/protocole/decouverte";
import { decoderSentinelle, HEADER_MISMATCH, validerEntetes } from "../src/protocole/entetes";
import {
  avecCache,
  avecServerInfo,
  CLEF_SERVEUR,
  clientLisible,
  complet,
  estCachable,
  lireMeta,
} from "../src/protocole/meta";
import {
  erreurVersion,
  estModerne,
  negocier,
  PREMIERE_MODERNE,
  UNSUPPORTED_PROTOCOL_VERSION,
  versionAbsenteAdmise,
} from "../src/protocole/versions";

const SERVIES = ["2026-07-28", "2025-11-25", "2025-06-18"];
const h = (o: Record<string, string>) => new Headers(o);

describe("versions", () => {
  it("la frontière du moderne est 2026-07-28, incluse", () => {
    expect(estModerne(PREMIERE_MODERNE)).toBe(true);
    expect(estModerne("2026-11-01")).toBe(true);
    expect(estModerne("2025-11-25")).toBe(false);
    expect(estModerne("2025-03-26")).toBe(false);
  });

  it("négocier rend la version servie, ou une erreur EXPLOITABLE", () => {
    expect(negocier("2025-11-25", SERVIES)).toEqual({ version: "2025-11-25" });
    const r = negocier("1900-01-01", SERVIES) as { erreur: { code: number; data: unknown } };
    expect(r.erreur.code).toBe(UNSUPPORTED_PROTOCOL_VERSION);
    // Sans la liste des versions servies, un client ne peut que renoncer ; avec elle, il
    // en choisit une et réessaie. C'est tout l'intérêt du champ `data`.
    expect(r.erreur.data).toEqual({ supported: SERVIES, requested: "1900-01-01" });
  });

  it("erreurVersion COPIE la liste — un appelant ne doit pas pouvoir la muter", () => {
    const servies = ["2026-07-28"];
    const e = erreurVersion("x", servies);
    e.data.supported.push("faux");
    expect(servies).toEqual(["2026-07-28"]);
  });

  it("`initialize` est TOUJOURS exempté de l'en-tête de version", () => {
    // Sous 2025-06-18 l'en-tête n'est exigé qu'APRÈS l'initialisation : le POST initialize
    // n'en porte légitimement aucun. Le refuser rejetterait la poignée de tout client
    // conforme, connecteur claude.ai compris.
    expect(versionAbsenteAdmise("initialize", false)).toBe(true);
    expect(versionAbsenteAdmise("initialize", true)).toBe(true);
  });

  it("toute AUTRE méthode sans en-tête suit la décision du dépôt", () => {
    expect(versionAbsenteAdmise("tools/list", false)).toBe(false);
    expect(versionAbsenteAdmise("tools/list", true)).toBe(true);
  });
});

describe("sentinelle base64", () => {
  it("laisse passer une valeur ASCII ordinaire", () => {
    expect(decoderSentinelle("legislation_get_article")).toBe("legislation_get_article");
  });

  it("décode l'UTF-8, et pas seulement les octets", () => {
    // `atob` rend une chaîne d'octets : sans relecture UTF-8, « é » revient en deux
    // caractères et la comparaison échoue sur un nom pourtant correct.
    const encode = `=?base64?${btoa(String.fromCharCode(...new TextEncoder().encode("café à Montréal")))}?=`;
    expect(decoderSentinelle(encode)).toBe("café à Montréal");
  });

  it("rend null sur une charge illisible — un refus vaut mieux qu'un demi-décodage", () => {
    expect(decoderSentinelle("=?base64?!!!pas du base64!!!?=")).toBeNull();
  });

  it("n'est pas déclenchée par une valeur qui y ressemble de loin", () => {
    expect(decoderSentinelle("=?base64?sans fin")).toBe("=?base64?sans fin");
  });
});

describe("validation en-tête contre corps", () => {
  const ok = { method: "tools/list", versionMeta: "2026-07-28" };
  const entetesOk = { "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "tools/list" };

  it("laisse passer ce qui concorde", () => {
    expect(validerEntetes(h(entetesOk), ok)).toBeNull();
  });

  it("le code de refus est bien -32020", () => {
    expect(HEADER_MISMATCH).toBe(-32020);
  });

  it("un en-tête de version MANQUANT est un refus, pas un défaut silencieux", () => {
    expect(validerEntetes(h({ "Mcp-Method": "tools/list" }), ok)).toMatch(/MCP-Protocol-Version/);
  });

  it("une version d'en-tête qui contredit le corps est refusée", () => {
    const r = validerEntetes(
      h({ "MCP-Protocol-Version": "2025-11-25", "Mcp-Method": "tools/list" }),
      ok,
    );
    expect(r).toMatch(/ne correspond pas/);
  });

  it("`Mcp-Method` manquant ou divergent est refusé", () => {
    expect(validerEntetes(h({ "MCP-Protocol-Version": "2026-07-28" }), ok)).toMatch(/Mcp-Method/);
    expect(validerEntetes(h({ ...entetesOk, "Mcp-Method": "tools/call" }), ok)).toMatch(
      /ne correspond pas/,
    );
  });

  it("`Mcp-Name` n'est exigé que pour les trois méthodes qui en ont un", () => {
    // `tools/list` n'a pas de nom : en réclamer un refuserait un client conforme.
    expect(validerEntetes(h(entetesOk), ok)).toBeNull();
  });

  it("`tools/call` exige un `Mcp-Name` qui reflète `params.name`", () => {
    const corps = {
      method: "tools/call",
      params: { name: "outil_x" },
      versionMeta: "2026-07-28",
    };
    const base = { "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "tools/call" };
    expect(validerEntetes(h({ ...base, "Mcp-Name": "outil_x" }), corps)).toBeNull();
    expect(validerEntetes(h({ ...base, "Mcp-Name": "autre" }), corps)).toMatch(/ne correspond pas/);
    expect(validerEntetes(h(base), corps)).toMatch(/Mcp-Name/);
  });

  it("`resources/read` compare à `params.uri`, non à `params.name`", () => {
    const corps = {
      method: "resources/read",
      params: { uri: "https://x/id/1" },
      versionMeta: "2026-07-28",
    };
    const base = { "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "resources/read" };
    expect(validerEntetes(h({ ...base, "Mcp-Name": "https://x/id/1" }), corps)).toBeNull();
  });

  it("l'en-tête est DÉCODÉ avant comparaison — sinon tout nom accentué serait refusé", () => {
    const nom = "outil_café";
    const corps = { method: "tools/call", params: { name: nom }, versionMeta: "2026-07-28" };
    const encode = `=?base64?${btoa(String.fromCharCode(...new TextEncoder().encode(nom)))}?=`;
    expect(
      validerEntetes(
        h({
          "MCP-Protocol-Version": "2026-07-28",
          "Mcp-Method": "tools/call",
          "Mcp-Name": encode,
        }),
        corps,
      ),
    ).toBeNull();
  });
});

describe("_meta", () => {
  it("lit version, client et capacités sous leurs clefs préfixées", () => {
    const m = lireMeta({
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": { name: "ExempleClient", version: "1.0.0" },
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    });
    expect(m.protocolVersion).toBe("2026-07-28");
    expect(m.clientInfo?.name).toBe("ExempleClient");
  });

  it("un `_meta` absent ne lève pas", () => {
    expect(lireMeta(undefined)).toEqual({});
    expect(lireMeta({})).toEqual({});
  });

  it("clientLisible ne garde QUE le nom et la version", () => {
    // `clientInfo` est un objet ouvert : un client peut y mettre n'importe quoi, et rien
    // d'autre que ces deux champs ne doit pouvoir entrer dans un journal.
    expect(clientLisible({ name: "Claude", version: "2.1" })).toBe("Claude/2.1");
    expect(clientLisible({ name: "Claude" })).toBe("Claude");
    expect(clientLisible(undefined)).toBeUndefined();
  });

  it("serverInfo va dans `_meta`, PAS à la racine du résultat", () => {
    const r = avecServerInfo({ a: 1 }, { name: "S", version: "1" });
    // Le cast est nécessaire : le TYPE dit déjà qu'il n'y a pas de `serverInfo` à la
    // racine. On vérifie ici le FAIT à l'exécution, pour que la garantie survive à un
    // changement de signature qui l'y remettrait.
    expect((r as Record<string, unknown>).serverInfo).toBeUndefined();
    expect((r._meta as Record<string, unknown>)[CLEF_SERVEUR]).toEqual({ name: "S", version: "1" });
  });

  it("avecServerInfo préserve un `_meta` déjà présent", () => {
    const r = avecServerInfo({ _meta: { autre: 1 } }, { name: "S", version: "1" });
    expect((r._meta as Record<string, unknown>).autre).toBe(1);
  });
});

describe("indices de cache", () => {
  it("`server/discover` EST cachable — le tableau de la §3.2 l'oubliait", () => {
    expect(estCachable("server/discover")).toBe(true);
    for (const m of ["tools/list", "resources/read", "resources/templates/list"]) {
      expect(estCachable(m)).toBe(true);
    }
    expect(estCachable("tools/call")).toBe(false);
  });

  it("refuse un ttlMs négatif ou fractionnaire", () => {
    expect(() => avecCache({}, -1, "public")).toThrow();
    expect(() => avecCache({}, 1.5, "public")).toThrow();
    expect(avecCache({}, 0, "private").ttlMs).toBe(0);
  });

  it("complet() pose resultType, et rien d'autre", () => {
    expect(complet({ a: 1 })).toEqual({ a: 1, resultType: "complete" });
  });
});

describe("server/discover", () => {
  const base = {
    supportedVersions: SERVIES,
    capabilities: { tools: {} },
    serverInfo: { name: "Serveur", version: "0.2.0" },
    instructions: "Orientation.",
  };

  it("porte versions, capacités, instructions, resultType ET les indices de cache", () => {
    const r = resultatDecouverte(base);
    expect(r.supportedVersions).toEqual(SERVIES);
    expect(r.capabilities).toEqual({ tools: {} });
    expect(r.instructions).toBe("Orientation.");
    expect(r.resultType).toBe("complete");
    expect(r.ttlMs).toBe(3_600_000);
    expect(r.cacheScope).toBe("public");
  });

  it("met serverInfo dans `_meta` — l'erreur facile, puisque initialize le mettait ailleurs", () => {
    const r = resultatDecouverte(base);
    expect(r.serverInfo).toBeUndefined();
    expect((r._meta as Record<string, unknown>)[CLEF_SERVEUR]).toEqual(base.serverInfo);
  });

  it("omet `instructions` quand il n'y en a pas, au lieu d'en mettre une vide", () => {
    const { instructions, ...sans } = base;
    expect(resultatDecouverte(sans)).not.toHaveProperty("instructions");
  });
});
