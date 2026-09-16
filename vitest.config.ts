import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

/**
 * Les tests du socle s'exécutent dans `workerd`, et non dans Node.
 *
 * Ce n'est pas un alignement de façade sur les deux connecteurs : le socle portera
 * `safeEqual`, qui repose sur `crypto.subtle.timingSafeEqual` — une extension de workerd
 * ABSENTE de la WebCrypto de Node. Un test qui passerait sous Node n'éprouverait donc
 * pas le code réellement déployé. `test/fumee.test.ts` épingle ce fait.
 *
 * À la différence des deux connecteurs, le socle est une BIBLIOTHÈQUE : il n'a pas de
 * `wrangler.jsonc` à désigner par `wrangler.configPath`, ni de D1 à migrer. Les options
 * de miniflare sont donc données en ligne, et tenues alignées À LA MAIN sur la
 * `compatibility_date` des deux consommateurs — une divergence ici se verrait en aval,
 * jamais ici.
 */
export default defineConfig({
  plugins: [
    cloudflareTest(() => ({
      miniflare: {
        compatibilityDate: "2026-07-01",
        compatibilityFlags: ["nodejs_compat"],
      },
    })),
  ],
});
