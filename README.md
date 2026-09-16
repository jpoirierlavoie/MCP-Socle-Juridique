# Socle commun des connecteurs juridiques

Code partagé par les deux connecteurs MCP de Poirier Lavoie avocat :

- [`MCP-Legislation-Quebec`](https://github.com/jpoirierlavoie/MCP-Legislation-Quebec) — Législation du Québec
- [`MCP-Jurisprudence-Quebec`](https://github.com/jpoirierlavoie/MCP-Jurisprudence-Quebec) — Jurisprudence canadienne et greffes du Québec

Le socle porte le **protocole** (MCP `2026-07-28`, sans état), l'**identité**, la
**gouverne**, le **journal** et la **sortie structurée**. Il ne porte aucune connaissance
du droit : celle-ci reste dans les connecteurs.

## Comment il est consommé

En **dépendance de développement**, par étiquette git, et empaqueté par esbuild au
déploiement :

```jsonc
"devDependencies": {
  "@poirierlavoie/socle-juridique": "github:jpoirierlavoie/MCP-Socle-Juridique#v0.1.0"
}
```

Jamais une dépendance d'exécution : les deux connecteurs conservent ainsi zéro dépendance
à l'exécution, et le code partagé reste du code versionné et signé plutôt qu'une surface
de mise à jour automatique.

## Documents

| Fichier | Contenu |
|---|---|
| `NOTE-OUVERTURE-PUBLIQUE.md` | considérations, arbitrages et réserves — **à lire en premier** |
| `SPEC-SOCLE-COMMUN.md` | les contrats : décisions, schémas, portes de validation |
| `FEUILLE-DE-ROUTE.md` | l'ordre des phases, leurs portes d'entrée et de sortie, et ce qui n'est pas rattrapable |
| `PROCEDURES-MANUELLES.md` | les gestes qui exigent une clef, une interface ou une décision de production |
| `CLAUDE.md` | consignes de travail dans ce dépôt |
| `src/*/LISEZ-MOI.md` | ce que porte chaque répertoire, et à quelle marche |

## État

**Phase 1, marche 1 faite.** Le socle porte `protocole/` (enveloppe JSON-RPC, validateur de
schémas, registre d'outils, chaîne intergicielle HTTP) et `identite/` (les trois porteurs,
la forme des refus, la fabrique de jetons). 92 tests, entièrement hors ligne.

Reste en phase 1 : `legislation` hors `McpAgent`, le protocole `2026-07-28`, la sortie
double, puis le retrait du Durable Object. Voir `FEUILLE-DE-ROUTE.md`.
