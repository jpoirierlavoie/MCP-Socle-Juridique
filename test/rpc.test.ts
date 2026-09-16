import { describe, expect, it } from "vitest";
import {
  err,
  errorResponse,
  INVALID_REQUEST,
  isNotification,
  JsonRpcError,
  ok,
  PARSE_ERROR,
  parseMessage,
  resultResponse,
} from "../src/protocole/rpc";

describe("parseMessage — fautes de forme", () => {
  it("refuse un JSON illisible", () => {
    expect(() => parseMessage("{")).toThrowError(JsonRpcError);
    try {
      parseMessage("{");
    } catch (e) {
      expect((e as JsonRpcError).code).toBe(PARSE_ERROR);
    }
  });

  it("refuse les requêtes GROUPÉES — le regroupement a été retiré du protocole", () => {
    try {
      parseMessage('[{"jsonrpc":"2.0","method":"tools/list","id":1}]');
      throw new Error("aurait dû lever");
    } catch (e) {
      expect((e as JsonRpcError).code).toBe(INVALID_REQUEST);
      expect((e as JsonRpcError).message).toContain("groupées");
    }
  });

  it("refuse un jsonrpc absent ou autre que 2.0", () => {
    for (const brut of ['{"method":"x","id":1}', '{"jsonrpc":"1.0","method":"x","id":1}']) {
      expect(() => parseMessage(brut)).toThrowError(JsonRpcError);
    }
  });

  it("refuse une méthode absente ou vide", () => {
    for (const brut of ['{"jsonrpc":"2.0","id":1}', '{"jsonrpc":"2.0","method":"","id":1}']) {
      expect(() => parseMessage(brut)).toThrowError(JsonRpcError);
    }
  });

  it("refuse un id objet, accepte chaîne, nombre et null", () => {
    expect(() => parseMessage('{"jsonrpc":"2.0","method":"x","id":{}}')).toThrowError(JsonRpcError);
    expect(parseMessage('{"jsonrpc":"2.0","method":"x","id":"a"}').id).toBe("a");
    expect(parseMessage('{"jsonrpc":"2.0","method":"x","id":7}').id).toBe(7);
    expect(parseMessage('{"jsonrpc":"2.0","method":"x","id":null}').id).toBeNull();
  });

  it("refuse des params non-objet, et reporte l'id dans l'erreur", () => {
    try {
      parseMessage('{"jsonrpc":"2.0","method":"x","id":3,"params":"non"}');
      throw new Error("aurait dû lever");
    } catch (e) {
      // L'id voyage avec l'erreur : sans lui le client ne peut pas apparier la réponse.
      expect((e as JsonRpcError).requestId).toBe(3);
    }
  });
});

describe("isNotification", () => {
  it("un message sans id, ou d'id nul, est une notification", () => {
    expect(isNotification(parseMessage('{"jsonrpc":"2.0","method":"x"}'))).toBe(true);
    expect(isNotification(parseMessage('{"jsonrpc":"2.0","method":"x","id":null}'))).toBe(true);
  });

  it("un message d'id 0 n'en est PAS une — le piège du zéro falsy", () => {
    expect(isNotification(parseMessage('{"jsonrpc":"2.0","method":"x","id":0}'))).toBe(false);
  });
});

describe("enveloppes de réponse", () => {
  it("resultResponse et errorResponse portent jsonrpc 2.0 et l'id", () => {
    expect(resultResponse(1, { a: 1 })).toEqual({ jsonrpc: "2.0", id: 1, result: { a: 1 } });
    expect(errorResponse(2, -32601, "m")).toEqual({
      jsonrpc: "2.0",
      id: 2,
      error: { code: -32601, message: "m" },
    });
  });

  it("errorResponse n'émet `data` que s'il y en a", () => {
    expect(errorResponse(1, -1, "m").error).not.toHaveProperty("data");
    expect((errorResponse(1, -1, "m", { x: 1 }).error as Record<string, unknown>).data).toEqual({
      x: 1,
    });
  });
});

describe("résultats d'outil", () => {
  it("ok et err ne diffèrent que par isError", () => {
    expect(ok("texte")).toEqual({ content: [{ type: "text", text: "texte" }], isError: false });
    expect(err("raté")).toEqual({ content: [{ type: "text", text: "raté" }], isError: true });
  });

  it("aucun des deux n'émet structuredContent — tant que S5 n'est pas livrée", () => {
    // Épingle l'état ACTUEL, non un idéal : la marche 4 élargira `ToolResult`, et ce test
    // sera alors REMPLACÉ par celui de `gardes` non vide — jamais simplement supprimé.
    expect(Object.keys(ok("t")).sort()).toEqual(["content", "isError"]);
  });
});
