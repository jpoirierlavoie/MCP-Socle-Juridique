# `protocole/`

Enveloppe JSON-RPC, transport Streamable HTTP **sans état**, en-têtes, `_meta`,
négociation de versions, `server/discover`, validation de schémas, registre d'outils.

| Fichier | Marche | Contenu |
|---|---|---|
| `rpc.ts` | 1 | enveloppe JSON-RPC 2.0 — repris tel quel de `jurisprudence/src/mcp/rpc.ts` |
| `valide.ts` | 1 | JSON Schema en sous-ensemble — repris de `jurisprudence/src/mcp/validate.ts` |
| `registre.ts` | 1 | `ToolDescriptor<TCtx>`, `listToolDescriptors(tools)`. **Pas `callTool`** : la §11 marche 1 le laisse dans chaque dépôt |
| `versions.ts` | 3 | négociation, `-32022`, pont vers `initialize` (imitation, sans état) |
| `entetes.ts` | 3 | `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name`, `Mcp-Param-*`, sentinelle `=?base64?…?=`, validation en-tête ↔ corps (`-32020`) |
| `meta.ts` | 3 | `_meta` : `protocolVersion`, `clientInfo`, `clientCapabilities` en entrée ; `serverInfo` en sortie — **dans `_meta`**, non à la racine |
| `decouverte.ts` | 3 | `server/discover` (**MUST** sous `2026-07-28`), avec `ttlMs` et `cacheScope` |
| `transport.ts` | 3 | POST unique, JSON ou SSE par requête |
