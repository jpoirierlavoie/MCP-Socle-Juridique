import { describe, expect, it } from "vitest";

// Test de fumée du harnais, non du socle. Il éprouve la seule chose qui ne va pas de
// soi : que les tests tournent bien dans `workerd` et non dans Node. Le témoin est
// `crypto.subtle.timingSafeEqual`, extension de workerd absente de la WebCrypto de Node
// — et dont dépendra `identite/porteur.ts` à la marche 1.
describe("harnais", () => {
  it("s'exécute dans workerd, pas dans Node", () => {
    expect(typeof crypto.subtle.timingSafeEqual).toBe("function");
  });

  it("timingSafeEqual compare bien à longueur égale", () => {
    const a = new TextEncoder().encode("aaaa");
    const b = new TextEncoder().encode("aaaa");
    const c = new TextEncoder().encode("aaab");
    expect(crypto.subtle.timingSafeEqual(a, b)).toBe(true);
    expect(crypto.subtle.timingSafeEqual(a, c)).toBe(false);
  });
});
