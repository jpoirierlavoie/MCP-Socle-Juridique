# Feuille de route — avancer par phase

Complément opérationnel de `SPEC-SOCLE-COMMUN.md`. La spécification dit **quoi** construire
et **pourquoi** ; ce document dit **dans quel ordre**, **à quelle condition on passe à la
suivante**, et **ce qui n'est pas rattrapable**.

---

## 0. La levée du 2026-09-16, et ce qu'elle ne lève pas

La NOTE §8 subordonnait les phases 2, 3, 4 et 6 aux déterminations de sa §7. Le praticien
les a levées ce jour : assurance en place, implications pour la vie privée évaluées et à
traiter plus tard, CanLII pris en charge par lui.

**Ce que la levée débloque** : la CONSTRUCTION des six phases. Plus rien n'attend un tiers
pour être écrit et éprouvé hors ligne.

**Ce qu'elle ne lève pas**, et qu'il faut garder écrit pour ne pas le redécouvrir :

| Réserve | État | Conséquence de conception |
|---|---|---|
| CanLII, par écrit | pris en charge, non obtenu | Le cache reste **cloisonné par titulaire** pour les fiches, partagé pour le seul répertoire (S17). C'est déjà la conception prudente : elle ne change que si la réponse l'autorise, jamais l'inverse |
| EFVP | évaluée, formalisation reportée | Ne bloque pas le code. Bloque l'**ouverture à des tiers** : c'est un préalable à la communication hors Québec, non un concomitant |
| Les cinq textes publics (§10) | à rédiger | Bloquent la phase 6, pas la phase 2. Les consoles peuvent exister avant que les CGU soient signées ; l'admission d'un premier confrère, non |

**Règle qui remplace l'ancienne** : on construit tout ; on n'**ouvre** à personne avant que
la ligne « EFVP » et la ligne « textes » soient vertes. Le code ne doit pas présumer de leur
état — d'où `MCP_ENABLED` fermé par défaut et l'état `en_attente` comme défaut d'un titulaire.

---

## 0 bis. S5 — la sortie double est RETENUE (décision du 2026-09-17)

Le praticien a tranché : les outils porteront un `outputSchema` publié et un
`structuredContent` validé contre lui, **en connaissance des réserves**. Ce qui suit n'est
donc plus une question ouverte, mais la liste de ce que la marche 4 doit livrer POUR que la
décision tienne.

**Ce que la décision renverse**, et qui doit être réécrit, non contourné :

| Doctrine | Où | Statut |
|---|---|---|
| Invariant 4 — « pas de `structuredContent`, pas d'`outputSchema` » | `jurisprudence/CLAUDE.md`, réexaminé et maintenu le 2026-07-23 | **renversé**, et ses DEUX verrous de test remplacés (`garde.test.ts`, `rpc.test.ts`) |
| « `outputSchema` reste ABSENT à dessein » | `legislation/CLAUDE.md` | **renversé** ; la SPEC ne l'avait pas nommé |

**Le contrôle sans lequel la décision ne tient pas.** Le mode de panne que l'invariant 4
décrivait est réel : un client qui reçoit un objet typé laisse tomber la prose, la réserve
part avec elle, et aucun test ne rougit. La contrepartie n'est pas « ça n'arrivera pas »,
c'est que **`gardes` soit non vide par obligation de COMPILATION** dès qu'une réserve
s'applique — en trois couches (champ requis avec sentinelle greppable, fusion par le
constructeur d'enveloppe et non par le gestionnaire, `minItems: 1` dans chaque
`outputSchema`). Livrer la sortie double sans ces trois couches, c'est prendre le risque
que la doctrine décrivait sans la parade qui le rend acceptable.

**Un gain immédiat, indépendant de S5 :** `legislation` publie DÉJÀ `structuredContent` sur
ses dix outils, sans aucun schéma pour le décrire. Un consommateur peut donc dépendre d'une
forme que rien n'épingle, et qu'on casserait sans qu'un test le dise. Poser l'`outputSchema`
ferme cette brèche même là où rien d'autre ne change.

## 1. Où nous en sommes

| Phase | Contenu | État |
|---|---|---|
| 1 | Socle, `2026-07-28`, `legislation` hors `McpAgent`, sortie double | **en cours** — marche 1 faite, marches 2 à 5 à venir |
| 2 | Identité par titulaire, jetons, coffre CanLII, consoles | débloquée |
| 3 | Gouverne : débit, quotas, score, états, registre | débloquée |
| 4 | Journal en deux plans, purges, gardes | débloquée |
| 5 | Identifiants FRBR, `/id/`, JSON-LD, ressources MCP | débloquée |
| 6 | Ouverture graduée | débloquée, **mais** voir §0 |

Livré à ce jour dans le socle : `protocole/` (rpc, valide, registre, http) et `identite/`
(porteur, refus). 92 tests, hors ligne.

---

## 2. La règle qui gouverne tout l'ordre

> **Ajouter d'abord, servir les deux, retirer ensuite. Jamais l'inverse.**

Et son corollaire, payé cher : **poser l'URL du connecteur AVANT d'armer le contrôle
correspondant.** La forme d'URL retenue doit répondre `200` **avec et sans** le nouveau
contrôle. Tant que les deux régimes répondent `200`, le connecteur ne voit jamais de `404`
pendant la fenêtre de bascule.

---

## 3. Phase par phase

Chaque phase a une **porte d'entrée** (ce qui doit être vrai avant de commencer), une
**porte de sortie** (ce qui doit être vrai pour passer à la suivante), et une liste
explicite de ce qui n'est **pas rattrapable**.

### Phase 1 — le socle et le protocole

- **Entrée** : faite.
- **Reste** : marche 2 (`legislation` hors `McpAgent`, relocalisation des défauts,
  conversion Zod → JSON Schema, CORS/`OPTIONS`/`Origin`, `/health`, `MCP_ENABLED`),
  marche 3 (`2026-07-28` + `2025-11-25`, pont d'abord), marche 4 (sortie double),
  marche 5 (retrait du Durable Object, **seule dans son déploiement**).
- **Sortie** : G1–G6, G19, G22–G24, G27–G29. Une même session d'évaluation passe sous les
  trois versions, `tools/list` rend le même ensemble dans le même ordre.
- **Irrattrapable** : le retrait du Durable Object interdit tout retour en deçà
  (`wrangler rollback` refuse de franchir un changement de cycle de vie). D'où sa marche
  autonome, et la nouvelle ancre à consigner juste après.

### Phase 2 — identité, jetons, coffre, consoles

- **Entrée** : phase 1 terminée. Les jetons par titulaire s'ajoutent **en plus** des secrets
  partagés, jamais à leur place.
- **Contenu** : tables `titulaire` et `jeton` ; `identite/titulaire.ts` (résolution à temps
  constant) ; coffre à enveloppe (HKDF-SHA256 + AES-256-GCM, AAD liée au titulaire) ; les
  trois consoles `/demande`, `/moi`, `/exploitant`.
- **Sortie** : G7 (jeton inconnu, expiré, révoqué et titulaire suspendu rendent la **même**
  réponse, le **même** code et le **même** délai), G8 (`CLEF_ABSENTE` alors que
  `CANLII_API_KEY` est encore posée), G9, G10, G21, G33.
- **Irrattrapable** : retirer les secrets partagés avant d'avoir vérifié G21 par une mesure
  réelle. Ordre imposé : livrer le défaut fermé, le vérifier, **puis** retirer.
- **Vôtre** : les cinq textes de la §10, et le processus d'admission tel qu'il sera
  réellement tenu — la revue humaine est la seule vérification qui existe.

### Phase 3 — gouverne

- **Entrée** : phase 2. Sans titulaire, il n'y a personne à distinguer.
- **Contenu** : quatre espaces de débit (**A1** — l'anonyme est clé sur `CF-Connecting-IP`,
  jamais sur l'empreinte du jeton), quotas journaliers par classe, score nocturne, machine
  d'états, registre en ajout seul.
- **Sortie** : G11, G12, G26, G32, G34.
- **En observation d'abord** : les seuils calculent et écrivent au registre **sans
  appliquer**, deux semaines, sur votre seul trafic. Puis calibrer, puis armer.
- **Vôtre** : arrêter les valeurs de franchissement (`SEUILS_GOUVERNE`, jamais versionnées)
  et la voie de rétablissement.

### Phase 4 — journal en deux plans

- **Entrée** : phase 2 (le plan technique est clé sur le titulaire).
- **Contenu** : `evenement_technique` (titulaire, aucun contenu) et `forme_requete` (forme,
  aucun titulaire) ; `expurgerForme()` ; purges ; test de garde sur le schéma.
- **Sortie** : G13–G16, G25.
- **Irrattrapable** : la décision sur les **deux `search_log` existantes**. Elles portent
  aujourd'hui vos requêtes en clair, horodatées à la seconde. Purge ou conservation comme
  plan privé — mais décidé, et non réglé par défaut.

### Phase 5 — données structurées et identifiants

- **Entrée** : phase 1 (marche 4 livrée). Indépendante des phases 2 à 4.
- **Contenu** : `sortie/frbr.ts`, routes `/id/…` publiques et non authentifiées, contexte
  JSON-LD, paquet de schémas, surface `resources/`, fixtures publiques rejouables.
- **Sortie** : G5, G17, G18, G20.
- **Vôtre** : valider les identifiants FRBR et la citation normalisée avant qu'ils ne soient
  frappés — un identifiant publié puis changé est un lien mort chez un tiers.

### Phase 6 — ouverture graduée

- **Entrée** : phases 0 à 5, **plus** les deux lignes non levées du §0 (EFVP formalisée,
  cinq textes publiés).
- **Contenu** : cinq confrères, trente jours d'observation, puis la file d'admission.

---

## 4. Ce qui n'est jamais rattrapable, tous phases confondues

1. **Une fenêtre de `404` sur un connecteur en service.** Elle en a détruit un
   irréversiblement le 2026-07-25, et le remède d'alors ne fonctionne plus.
2. **Un secret commis.** Il reste dans l'historique, les forks et les caches d'indexation
   après suppression. Les trois dépôts sont publics.
3. **Un identifiant `/id/` publié puis changé.**
4. **Le retrait d'un Durable Object**, qui coupe la voie de retour en deçà.
5. **Un contenu de requête écrit dans une table qui porte un titulaire.** Aucune purge ne
   défait la corrélation déjà possible entre deux tables pendant leur coexistence.

---

## 5. Avant chaque déploiement, sans exception

```
npx wrangler types → npx tsc --noEmit → npx biome check . → npm test
→ npx wrangler deploy --dry-run
```

Puis : énoncer les **cinq surfaces** (outils, descriptions, schéma, README, page publique),
« non touchée » étant une réponse valable mais jamais tacite ; confronter `tools/list` au
README et à la page ; rejouer `npm run evals` ; et appeler un outil réel depuis claude.ai.

`scripts/check-consolidation.mjs` tourne **chaque mois contre la production** : les marches
3 et 4 le cassent toutes deux. Le corriger dans le même commit, pas après.
