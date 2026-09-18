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
les gabarits de rendu du domaine, **la sortie structurée et les mises en garde**.

Montent ici : **l'identité, et le transport MCP qui la porte** — rien d'autre. Deux
répertoires, `identite/` et `protocole/`. Voir leurs `LISEZ-MOI.md`.

⚠ LA PORTÉE A ÉTÉ RESSERRÉE LE 2026-09-17, et le motif vaut d'être retenu. Le socle avait
  six responsabilités déclarées et quatre répertoires vides tenant lieu d'intentions. La
  sortie structurée en est sortie sur MESURE : ~7 700 jetons par session pour un contrat
  que personne ne lisait (S5, abandonnée). Le besoin d'origine était un intergiciel
  d'authentification. Une responsabilité ne monte ici qu'une fois qu'un besoin MESURÉ
  l'exige — pas parce qu'une spécification l'a écrite.

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
(`github:jpoirierlavoie/MCP-Socle-Juridique#v0.5.0`), en `devDependencies`, et empaqueté
par esbuild au déploiement. **Jamais une dépendance d'exécution** (S2, D2).

## Invariants

1. **Zéro dépendance d'exécution.** `dependencies` doit rester absent de `package.json`.
   C'est la décision D2, et c'est ce qui rend le socle acceptable pour les deux dépôts.
2. **`queryKey` est optionnel dans `identite/porteur.ts`.** Absent ⇒ pas de porteur
   `?key=`. L'invariant tient ; son MOTIF, lui, a été corrigé le 2026-09-18. Il disait
   « le rendre obligatoire donnerait à `jurisprudence` une surface d'accès qu'il n'a pas ».
   **`jurisprudence` SERT `?key=` depuis le 2026-09-17** (`src/index.ts`, `PORTE`), parce
   que c'est la seule forme qui survive au formulaire de connecteur de claude.ai (S7). Le
   champ reste optionnel pour une raison plus durable : un connecteur ne doit pas hériter
   d'une surface d'accès par le seul fait de consommer le socle. L'ouvrir doit être un geste
   ÉCRIT dans le dépôt qui l'ouvre.
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

## État au 2026-09-18

⚠ CETTE SECTION EST UN RELEVÉ DATÉ, non une intention. Si elle n'a pas de date récente,
  ne pas s'y fier : la précédente annonçait un `src/` vide alors qu'il portait dix modules.

- `src/identite/` : `porteur.ts` (trois porteurs, comparaison SHA-256 + `timingSafeEqual`,
  fermé par défaut), `refus.ts`. **C'est le cœur du socle et la raison de son existence.**
- `src/protocole/` : `rpc.ts`, `valide.ts`, `registre.ts`, `versions.ts`, `entetes.ts`,
  `meta.ts`, `decouverte.ts`, `http.ts`. Le transport que l'identité emprunte.
- **Rien d'autre.** `sortie/`, `coffre/`, `gouverne/`, `journal/` et `page/` ont été
  SUPPRIMÉS le 2026-09-17 : le premier sur mesure (S5 abandonnée), les quatre autres parce
  qu'ils ne contenaient qu'un `LISEZ-MOI` tenant lieu d'intention.
- Étiquette **v0.5.0**, consommée par les deux connecteurs.
- **Ce qui est écrit mais n'a AUCUN appelant** : `frapperJeton`, `LONGUEUR_JETON` et
  `empreinte` (`porteur.ts`). Bon code, éprouvé, mais prématuré — il attend la table
  `jeton` qui lui donnerait un sens. À garder à l'œil : c'est exactement ce que la règle
  de frontière ci-dessus interdit désormais de faire entrer.
- **Ce que le socle N'AUTHENTIFIE PAS**, et qu'il faut savoir avant d'y compter : aucun
  usager. Il compare une chaîne présentée à des secrets d'exploitation posés par
  `wrangler secret put`. Deux appelants porteurs du même secret sont indiscernables, et
  retirer un accès retire celui de tous les porteurs de ce secret. L'identité PAR TITULAIRE
  (S6, `identite/titulaire.ts`) n'existe pas.
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
