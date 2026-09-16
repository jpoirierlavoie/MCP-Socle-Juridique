import { describe, expect, it } from "vitest";
import {
  methodeNonPermise,
  origineInterdite,
  refuser,
  tropDeRequetes,
} from "../src/identite/refus";
import {
  corsHeaders,
  debitAcceptable,
  jsonResponse,
  ORIGINES_PAR_DEFAUT,
  origineAutorisee,
  origineRefusee,
  originesAdmises,
  preflight,
} from "../src/protocole/http";

const req = (h: Record<string, string> = {}) => new Request("https://x/mcp", { headers: h });
const ADMISES = originesAdmises();

describe("origines", () => {
  it("claude.ai et claude.com sont admises par défaut", () => {
    expect([...ORIGINES_PAR_DEFAUT]).toEqual(["https://claude.ai", "https://claude.com"]);
  });

  it("la liste supplémentaire AJOUTE, elle ne remplace pas", () => {
    const a = originesAdmises("https://exemple.test , https://autre.test");
    expect(a).toContain("https://claude.ai");
    expect(a).toContain("https://exemple.test");
    expect(a).toContain("https://autre.test");
  });

  it("une liste vide ou pleine de blancs n'ajoute rien", () => {
    expect(originesAdmises("")).toEqual([...ORIGINES_PAR_DEFAUT]);
    expect(originesAdmises(" , , ")).toEqual([...ORIGINES_PAR_DEFAUT]);
  });

  it("une origine ABSENTE est admise — serveur à serveur", () => {
    expect(origineAutorisee(req(), ADMISES)).toBeNull();
    expect(origineRefusee(req(), ADMISES)).toBe(false);
  });

  it("une origine de navigateur INCONNUE est refusée — ré-attachement DNS", () => {
    const r = req({ Origin: "https://mechant.test" });
    expect(origineAutorisee(r, ADMISES)).toBeNull();
    expect(origineRefusee(r, ADMISES)).toBe(true);
  });

  it("une origine connue est reflétée", () => {
    expect(origineAutorisee(req({ Origin: "https://claude.ai" }), ADMISES)).toBe(
      "https://claude.ai",
    );
  });
});

describe("corsHeaders", () => {
  it("sans origine, aucun en-tête — une réponse serveur à serveur n'en porte pas", () => {
    expect(corsHeaders(null)).toEqual({});
  });

  it("porte TOUJOURS Vary: Origin", () => {
    // Sans lui, un cache intermédiaire resservirait à une origine la réponse d'une autre.
    expect(corsHeaders("https://claude.ai").Vary).toBe("Origin");
  });

  it("expose les en-têtes que le client doit pouvoir LIRE", () => {
    const h = corsHeaders("https://claude.ai")["Access-Control-Expose-Headers"];
    expect(h).toContain("WWW-Authenticate");
    expect(h).toContain("MCP-Protocol-Version");
  });
});

describe("preflight", () => {
  it("rend 204 sans corps", async () => {
    const r = preflight("https://claude.ai");
    expect(r.status).toBe(204);
    expect(await r.text()).toBe("");
  });

  it("autorise les en-têtes que 2026-07-28 exige du client", () => {
    const h = preflight("https://claude.ai").headers.get("Access-Control-Allow-Headers") ?? "";
    for (const attendu of ["Authorization", "MCP-Protocol-Version", "Mcp-Method", "Mcp-Name"]) {
      expect(h).toContain(attendu);
    }
  });
});

describe("debitAcceptable", () => {
  it("sans liaison, laisse passer — ÉCHOUE OUVERT", () => {
    return expect(debitAcceptable(undefined, "k")).resolves.toBe(true);
  });

  it("une liaison qui LÈVE laisse passer aussi", async () => {
    const casse = {
      limit: () => {
        throw new Error("panne");
      },
    };
    expect(await debitAcceptable(casse, "k")).toBe(true);
  });

  it("respecte le verdict quand la liaison répond", async () => {
    expect(await debitAcceptable({ limit: async () => ({ success: false }) }, "k")).toBe(false);
    expect(await debitAcceptable({ limit: async () => ({ success: true }) }, "k")).toBe(true);
  });

  it("transmet la clé telle quelle", async () => {
    let vue = "";
    await debitAcceptable(
      {
        limit: async ({ key }) => {
          vue = key;
          return { success: true };
        },
      },
      "titulaire-42",
    );
    expect(vue).toBe("titulaire-42");
  });
});

describe("refus", () => {
  it("404 : corps VIDE, et aucun en-tête annonçant un point d'entrée MCP", async () => {
    const r = refuser("404");
    expect(r.status).toBe(404);
    expect(await r.text()).toBe("");
    expect(r.headers.get("WWW-Authenticate")).toBeNull();
  });

  it("401 : porte WWW-Authenticate — la bascule derrière drapeau", () => {
    const r = refuser("401");
    expect(r.status).toBe(401);
    expect(r.headers.get("WWW-Authenticate")).toBe("Bearer");
  });

  it("les deux formes portent les en-têtes CORS, pour que le navigateur les LISE", () => {
    for (const forme of ["404", "401"] as const) {
      expect(refuser(forme, "https://claude.ai").headers.get("Access-Control-Allow-Origin")).toBe(
        "https://claude.ai",
      );
    }
  });

  it("origine interdite : 403 SANS en-tête CORS — sinon le refus est un oracle", () => {
    const r = origineInterdite();
    expect(r.status).toBe(403);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("429 porte Retry-After en secondes", () => {
    expect(tropDeRequetes(300).headers.get("Retry-After")).toBe("300");
  });

  it("405 annonce Allow, et ne se sert qu'APRÈS l'identité", () => {
    expect(methodeNonPermise().headers.get("Allow")).toBe("POST, OPTIONS");
  });
});

describe("jsonResponse", () => {
  it("sérialise, pose le type et la charge", async () => {
    const r = jsonResponse({ a: 1 }, 200);
    expect(r.headers.get("Content-Type")).toContain("application/json");
    expect(await r.json()).toEqual({ a: 1 });
  });
});
