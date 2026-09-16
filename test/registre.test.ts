import { describe, expect, it } from "vitest";
import {
  type Annotations,
  listToolDescriptors,
  type Registre,
  type ToolDescriptor,
} from "../src/protocole/registre";
import { ok } from "../src/protocole/rpc";

/** Contexte factice : le socle ne sait pas ce qu'un dépôt y met, et c'est le point. */
interface CtxFactice {
  db: string;
  client: { appeler: () => void };
}

const outil = (
  title: string,
  annotations: Annotations = { readOnlyHint: true },
): ToolDescriptor<CtxFactice> => ({
  title,
  description: `description de ${title}`,
  inputSchema: { type: "object", additionalProperties: false },
  annotations,
  handler: async () => ok("fait"),
});

const registre: Registre<CtxFactice> = {
  zebre: outil("Zèbre"),
  alpha: outil("Alpha"),
};

describe("listToolDescriptors", () => {
  it("émet les cinq champs, et RIEN d'autre", () => {
    const [premier] = listToolDescriptors(registre);
    expect(Object.keys(premier ?? {})).toEqual([
      "name",
      "title",
      "description",
      "inputSchema",
      "annotations",
    ]);
  });

  it("l'ORDRE DES CLEFS est un contrat — tools/list doit rester octet pour octet", () => {
    // `JSON.stringify` suit l'ordre d'insertion. Réordonner ces cinq champs changerait la
    // charge utile sans changer sa valeur, ce qui invaliderait le critère de la marche 1
    // et le cache d'invite des clients.
    const json = JSON.stringify(listToolDescriptors(registre)[0]);
    expect(json.indexOf('"name"')).toBeLessThan(json.indexOf('"title"'));
    expect(json.indexOf('"title"')).toBeLessThan(json.indexOf('"description"'));
    expect(json.indexOf('"description"')).toBeLessThan(json.indexOf('"inputSchema"'));
    expect(json.indexOf('"inputSchema"')).toBeLessThan(json.indexOf('"annotations"'));
  });

  it("conserve l'ordre d'INSERTION, et ne trie pas par nom", () => {
    // Le tri alphabétique arrive à la marche 3, sur un champ `ordre` : trier ici
    // rétrograderait l'outil pivot que les INSTRUCTIONS désignent comme point de départ.
    expect(listToolDescriptors(registre).map((d) => d.name)).toEqual(["zebre", "alpha"]);
  });

  it("n'expose JAMAIS le gestionnaire", () => {
    for (const d of listToolDescriptors(registre)) expect(d).not.toHaveProperty("handler");
  });

  it("copie les annotations au lieu de partager la référence", () => {
    const partagees = { readOnlyHint: true };
    const r: Registre<CtxFactice> = { a: outil("A", partagees) };
    const [d] = listToolDescriptors(r);
    (d?.annotations as Record<string, unknown>).readOnlyHint = false;
    expect(partagees.readOnlyHint).toBe(true);
  });

  it("chaque outil porte SES annotations — le socle n'en impose aucune", () => {
    const r: Registre<CtxFactice> = {
      sortant: outil("Sortant", { readOnlyHint: true, openWorldHint: true }),
      local: outil("Local", { readOnlyHint: true, openWorldHint: false, idempotentHint: true }),
    };
    const [a, b] = listToolDescriptors(r);
    expect(a?.annotations).toEqual({ readOnlyHint: true, openWorldHint: true });
    expect(b?.annotations).toEqual({
      readOnlyHint: true,
      openWorldHint: false,
      idempotentHint: true,
    });
  });

  it("un registre vide rend un tableau vide", () => {
    expect(listToolDescriptors({} as Registre<CtxFactice>)).toEqual([]);
  });
});
