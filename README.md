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
| `CLAUDE.md` | consignes de travail dans ce dépôt |
| `src/*/LISEZ-MOI.md` | ce que porte chaque répertoire, et à quelle marche |

## État

Phase 1 en cours, marche 0. Le dépôt est amorcé et son outillage vérifié ; `src/` est
encore vide. Voir `CLAUDE.md`, section « État ».
