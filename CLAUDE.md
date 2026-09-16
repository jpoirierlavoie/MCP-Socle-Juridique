# MCP-Socle-Juridique — consignes de travail

Socle commun des trois dépôts. Les contrats sont dans `SPEC-SOCLE-COMMUN.md` ; les
considérations, les arbitrages et les réserves dans `NOTE-OUVERTURE-PUBLIQUE.md` — **la
lire avant l'autre**. Ce fichier ne répète ni l'une ni l'autre : il dit comment travailler
ici.

## ⛔ La règle de frontière, avant toute chose

**Le socle ne connaît pas le droit.** S'il faut y écrire le mot « article », « loi »,
« décision » ou « greffe », c'est qu'on s'est trompé de dépôt.

Ne montent jamais ici : l'analyseur de citations, les tables du Québec, le pipeline EPUB,
les descripteurs d'outils, `INSTRUCTIONS`, `SERVER_INFO`, `callTool`, `catalogue.json`,
les gabarits de rendu du domaine.

Montent ici : le protocole, l'identité, la gouverne, le journal, la sortie structurée, la
page. Voir `src/*/LISEZ-MOI.md` pour le détail par répertoire et par marche.

## Propagation

Le socle a **deux consommateurs**, et il n'existe aucune commande dans ce dépôt qui voie
l'un ou l'autre dériver. Toute modification d'une surface publique oblige à énoncer, dans
le même commit :

1. `MCP-Legislation-Quebec` — touché ? pourquoi ?
2. `MCP-Jurisprudence-Quebec` — touché ? pourquoi ?
3. La version : une rupture de contrat fait progresser l'étiquette, jamais un `git push --force`.

« Non touché » est une réponse valable, mais elle doit être **énoncée**, jamais passée
sous silence. Le coût en jetons de cette vérification est assumé.

Le socle est consommé par **étiquette git**
(`github:jpoirierlavoie/MCP-Socle-Juridique#v0.1.0`), en `devDependencies`, et empaqueté
par esbuild au déploiement. **Jamais une dépendance d'exécution** (S2, D2).

## Invariants

1. **Zéro dépendance d'exécution.** `dependencies` doit rester absent de `package.json`.
   C'est la décision D2, et c'est ce qui rend le socle acceptable pour les deux dépôts.
2. **`queryKey` est optionnel dans `identite/porteur.ts`.** Absent ⇒ pas de porteur
   `?key=`. Le rendre obligatoire donnerait à `jurisprudence` une surface d'accès qu'il
   n'a pas — contraire à « sans rien exposer de nouveau ».
3. **Fermé par défaut, sans exception.** Aucune configuration ne doit ouvrir un point
   d'entrée : ni l'absence de secret, ni une table vide, ni une erreur de lecture.
4. **Les tests tournent dans `workerd`, pas dans Node.** `crypto.subtle.timingSafeEqual`
   n'existe pas dans la WebCrypto de Node : un test vert sous Node ne prouverait rien.
   `test/fumee.test.ts` épingle ce fait — s'il tombe, le harnais a glissé vers Node.
5. **Fins de ligne LF dans la copie de travail** (`.gitattributes`), sinon Biome local
   (CRLF sous Windows) et la CI (Linux) divergent en permanence.
6. **Un test de garde qui échoue se répare en remettant la garantie**, jamais en ajustant
   le test. Si la garantie doit changer, c'est par décision écrite, et le test est
   *remplacé*, pas supprimé.
7. **Windows / Git Bash : les heredocs retirent un niveau de `\`.** Tout correctif
   contenant des barres obliques inverses passe par un fichier script, jamais par heredoc.

## Commandes

```
npm ci
npx tsc --noEmit      # type-check
npx biome check .     # mise en forme et lint
npx vitest run        # tests, sous workerd
```

Dans cet ordre, et tous verts avant de faire progresser une étiquette.

## État au 2026-09-16

- Marche 0.2 faite : dépôt amorcé, outillage vérifié (tsc, biome, vitest sous workerd).
- `src/` ne contient encore que `index.ts` (vide) et les `LISEZ-MOI.md` de répertoire.
  Les marches 1 à 4 les remplissent.
- **Vulnérabilités connues et acceptées** : `npm audit` signale 5 entrées hautes, toutes
  transitives par `miniflare` (`sharp`/libheif, `undici`) et toutes **de développement
  seulement** — le socle n'expédie aucune dépendance d'exécution. Le correctif proposé
  (`npm audit fix --force`) rétrograderait `@cloudflare/vitest-pool-workers` de 0.18.x à
  0.8.30, une rupture. Posture identique à celle d'`osv-scanner.toml` chez
  `jurisprudence` : exception ciblée et motivée, jamais un `continue-on-error`.
  **À reprendre** quand la chaîne de sécurité de ce dépôt sera montée (CodeQL, OSV,
  Scorecard, Trivy, Dependabot — les six workflows du jumeau).
- `.gitignore` a été écrit **avant le premier `git add`**, `cf.token` étant déjà sur le
  disque à côté des deux documents. Ne jamais retirer le motif `*.token`.
