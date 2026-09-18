# SPEC — Socle commun des connecteurs juridiques, et ouverture à la confraternité

> **Destinataire : Claude Code.** Document d'implémentation. Il vaut pour les trois dépôts —
> `MCP-Socle-Juridique` (à créer), `MCP-Legislation-Quebec`, `MCP-Jurisprudence-Quebec`.
> Les considérations, les arbitrages et les réserves sont dans `NOTE-OUVERTURE-PUBLIQUE.md` :
> **la lire avant celle-ci.** Ici, ce sont les contrats.
>
> **Paramètres arrêtés.** Service gratuit. Admission par demande + revue humaine de l'exploitant.
> Aucune facturation, aucune intégration de paiement.
>
> **Portes bloquantes.** La règle est énoncée une seule fois, au dernier paragraphe de la §8
> de la note : les phases 1 et 5 sont livrables sans les déterminations préalables ; les
> phases 2, 3, 4 et 6 en dépendent. Ne pas la reformuler ici.

---

## 0. État des lieux, en un tableau

Ce que les deux dépôts font aujourd'hui. Toute divergence non listée ici est à traiter comme
une découverte, pas comme un oubli du présent document.

| | `legislation` (qclaw) | `jurisprudence` (canlii) |
|---|---|---|
| Cadriciel | `@modelcontextprotocol/sdk` + `agents` (`McpAgent`) | aucun — routeur `fetch` écrit à la main (D2) |
| Transport | Streamable HTTP **avec** sessions (Durable Object) | Streamable HTTP, **JSON sans état** (D3) |
| Versions servies | celles du SDK | `2025-06-18`, `2025-03-26` |
| Authentification | `MCP_TOKEN` unique — 3 porteurs : `?key=`, `Bearer`, segment de chemin | `MCP_SHARED_SECRET` (+ `_ATHENA`) — 2 porteurs : segment, `Bearer` |
| Défaut sans secret | **OUVERT** : `if (!secret) return onMount ? request : null` — c'est le rollback documenté (R8) | **FERMÉ** : liste vide ⇒ tout refusé, épinglé par un test |
| Refus | **404**, jamais 401 — motif **raisonné, non mesuré** (voir S8) | 401 |
| Base | D1 `qclaw` (+ Vectorize, Workers AI si `HYBRID_SEARCH`) | D1 `canlii` (index **et** cache, D5/D6) |
| Sortie | prose **+ `structuredContent`** sur certains outils | prose seule — **D4 et invariant 4**, réexaminé et maintenu le 2026-07-23 |
| Journal | `search_log(ts, tool, query, …)` — `query` en clair, horodaté **à la seconde**, à chaque appel de `search_text` et `find_relevant` | `search_log` (chaînes de citation soumises), `api_usage` |
| Limitation de débit | aucune | `RATE_LIMITER` (§9.3), clé = **`CF-Connecting-IP`**, 60/min, plafond dans `wrangler.jsonc` |
| Page publique | `GET /`, cache d'arête à clé fixe | `GET /`, dérivée du registre (invariant 19) |
| Clef tierce | aucune | `CANLII_API_KEY` de l'exploitant |
| WAF de zone | bloque les rafales de POST non-navigateur sur le domaine personnalisé (invariant 9) | à vérifier |

---

## 1. Décisions d'architecture

Le format est celui de `SPEC_CANLII_MCP.md` : la décision, puis le motif. Un motif absent est
un motif à retrouver, jamais un motif à inventer.

| # | Décision | Motif |
|---|---|---|
| S1 | Un troisième dépôt, **`MCP-Socle-Juridique`**, source unique de l'**identité** et du **transport MCP qui la porte**. | Deux implémentations du même protocole ne restent pas uniformes par discipline. **AMENDÉE le 2026-09-17** : la liste disait « le protocole, l'identité, la gouverne, le journal et la sortie structurée ». La sortie structurée en sort (S5 abandonnée, voir ci-dessous) ; la gouverne, le journal et le coffre restent des PHASES à venir et ne doivent pas figurer comme des responsabilités déjà tenues — leurs quatre répertoires vides ont été retirés. Le besoin d'origine était un intergiciel d'authentification ; le socle s'y tient. |
| S2 | Le socle est une **dépendance de développement**, empaquetée par esbuild au déploiement. Jamais une dépendance d'exécution. | Préserve D2 au sens qui compte : du code à soi, versionné et signé, pas une surface Dependabot. |
| S3 | Les deux Workers servent **`2026-07-28` en tête**, puis `2025-11-25` et `2025-06-18` en compatibilité. `2025-03-26` est retiré. | `2026-07-28` supprime les sessions, l'en-tête `Mcp-Session-Id` et la poignée `initialize` : le protocole est devenu sans état. D3 est devenu la norme. |
| S4 | `legislation` **abandonne** `McpAgent`, `@modelcontextprotocol/sdk` et `agents`. | Corollaire de S3. Supprime aussi le coût d'écriture par session au Durable Object, qui a déjà épuisé un quota journalier au harnais d'évaluation. |
| S5 | ~~**Sortie double** partout~~ — **ABANDONNÉE le 2026-09-17, sur mesure.** `legislation` l'a servie en production une journée : `tools/list` passait de 12 279 à 43 145 octets (~3 070 → ~10 786 jetons **par session**), dont 78 % n'étaient pas de la prose utile mais le squelette d'enveloppe répété dans les dix schémas ; et l'enveloppe pesait 27 % de la réponse de `get_article`, soit 72 % de la taille des données qu'elle entourait. Le tout pour publier un contrat à l'intention d'un lecteur de schémas qui n'existe pas : le lecteur réel est un modèle, qui lit la prose française, et le destinataire est un praticien qui connaît déjà les réserves. L'**invariant 4 de `jurisprudence` n'est donc PAS renversé** — il est confirmé, et sa condition (1), « un consommateur identifié, qui existe et LE DEMANDE », reste le bon critère parce qu'elle est falsifiable, ce que « partout » n'était pas. Le module `sortie/` est retiré du socle. Texte d'origine conservé ci-dessous pour mémoire. ~~Sortie double : prose française dans `content`, plus `structuredContent` validé contre un `outputSchema` publié. | D4 est **amendée** ; l'**invariant 4 de `jurisprudence` est RENVERSÉ** — et il faut le dire, parce qu'il a été réexaminé et maintenu le 2026-07-23. Son mode de panne est réel : un client qui reçoit un objet typé laisse tomber la prose, la réserve part avec elle, et `test/garde.test.ts` reste vert. La réponse n'est pas « ça n'arrivera pas », c'est le champ `gardes` de la §8.1, **non vide par obligation de compilation** quand une réserve s'applique. La solution de rechange que l'invariant prescrivait — un paramètre `format` dont la charge utile porterait `avertissement` — est écartée : elle laisse le modèle choisir de ne pas recevoir la réserve, et un tiers ne peut pas construire sur un schéma optionnel. **Écart assumé** au surplus : `2026-07-28` recommande (SHOULD) de renvoyer aussi le JSON sérialisé dans un bloc `TextContent` ; on ne le fait pas, parce que le bloc textuel est réservé à la prose qui porte la réserve. À consigner, comme S8. |
| S6 | Identité **par titulaire**. Un enregistrement `titulaire` par avocat admis ; un ou plusieurs `jeton` par titulaire, révocables séparément. | Sans identité par titulaire, l'exigence 3 est inexécutable : on ne limite pas ce qu'on ne distingue pas. |
| S7 | Le jeton voyage par `Authorization: Bearer`, `?key=` **et** segment de chemin — les trois, jusqu'à mesure contraire. | Fait de production : `?key=` est la seule forme qui a survécu au formulaire du connecteur claude.ai (juillet 2026). À re-mesurer, jamais à présumer. |
| S8 | Un refus d'authentification répond **404**, sans `WWW-Authenticate`. | Posture existante de `legislation`, conservée pour **un seul** motif tenable : ne pas servir d'oracle sur l'existence d'un compte. Le motif souvent invoqué — « le 401 déclenche une découverte OAuth qui se coince » — **n'est pas mesuré** : les deux incidents enregistrés (2026-07-23, 2026-07-25) sont des **404** qui ont poussé le connecteur dans cette découverte, la seconde fois irréversiblement, un client MCP lisant un 404 comme « ce serveur exige une authentification ». Le 404 n'immunise donc de rien. Écart **assumé et consigné** à la spécification, qui exige les métadonnées de ressource protégée et un 401 ; à réexaminer sur mesure réelle, et non sur cette inférence. |
| S9 | OAuth 2.1 est une **phase ultérieure conditionnée à une mesure**, pas un préalable. | L'enregistrement dynamique de clients vient d'être déprécié au profit des *Client ID Metadata Documents* : bâtir dessus aujourd'hui serait bâtir sur du sortant. |
| S10 | La clef CanLII du titulaire vit dans un **coffre** chiffré par enveloppe, posé par une console web authentifiée. **Jamais** par un outil MCP, **jamais** en paramètre d'outil. | Un paramètre d'outil est rempli par le modèle et figure dans le contexte, l'historique et les journaux du client. `x-mcp-header` miroite un paramètre d'outil : à écarter pour un secret. |
| S11 | En-tête `X-Clef-CanLII` accepté en **variante zéro-connaissance** pour les clients maîtrisés. | Un confrère maximaliste doit pouvoir ne rien déposer. Prime sur le coffre quand les deux sont présents. |
| S12 | **Aucune retombée** sur la clef de l'exploitant. Sans clef, les outils `canlii_*` rendent `CLEF_ABSENTE`. L'exploitant est un titulaire comme les autres. | L'uniformité au sens fort, et la seule protection sûre du quota personnel. |
| S13 | **Deux plans de journal, structurellement séparés.** `evenement_technique` porte le titulaire et aucun contenu. `forme_requete` porte une forme et aucun titulaire. Aucune table ne porte les deux. | Seule façon de servir ensemble l'exigence 1 et l'exigence 3. Invariant porté par les **types** et par un test de garde sur le schéma, jamais par la vigilance. |
| S14 | Le plan de contenu ne conserve qu'une **forme expurgée** — citation normalisée, noms de parties remplacés par `[NOM]` — agrégée au jour et comptée. | Suffit au réglage de l'analyseur ; ne permet pas de reconstituer l'intérêt de recherche d'un confrère. |
| S15 | Limitation en trois étages : débit à l'arête par titulaire, quotas journaliers par classe d'outil, score de comportement nocturne. **Le trafic AUTHENTIFIÉ n'est jamais limité par adresse IP** ; le trafic dont l'authentification a ÉCHOUÉ l'est, et ne peut l'être autrement. | Deux problèmes distincts, longtemps confondus ici. Pour un titulaire connu, le client est claude.ai : l'adresse source est celle d'Anthropic, donc limiter par IP punirait tout le monde et n'attribuerait rien. Mais celui qui **devine** un jeton n'est pas encore un titulaire, et il appelle depuis SA propre adresse : c'est la seule chose stable qu'il présente. Voir §6.1, correctif A1. |
| S16 | La dégradation vers `limite` est **automatique** ; `suspendu` et `revoque` sont **humaines**, motivées, notifiées, avec voie de rétablissement. | Ce sont des avocats. Une coupure opaque en cours de mandat n'est ni tenable ni défendable. |
| S17 | Cache CanLII : **partagé** pour le répertoire des bases ; **cloisonné par titulaire et à durée bornée** pour les fiches de décision, jusqu'à détermination écrite de CanLII. | Le répertoire est de la donnée de référence qu'aucune clef ne possède ; une fiche est tirée de la collection sous la clef d'un licencié. |
| S18 | Identifiants **frappés sous le domaine du cabinet et déréférençables**, sur le patron FRBR d'Akoma Ntoso. Aucun identifiant frappé sur la donnée d'autrui. | Aucune autorité canadienne n'a enregistré d'espace `urn:lex` ; ELI est européen. Pour la jurisprudence, les identifiants de CanLII font autorité : les reprendre tels quels. |
| S19 | La recherche hybride (Workers AI, Vectorize) est **désarmable par titulaire**, et déclarée dans la fiche de conformité. | Elle envoie le texte de la requête à un tiers. C'est la fuite la moins visible du dispositif. |
| S20 | Toute documentation de gouverne — quotas, durées de conservation, codes de mise en garde, **liste** des signaux de comportement — **dérive du code**, comme la page dérive du registre (invariant 19). **Exception unique et nommée** : les valeurs de franchissement des signaux (§6.3) vivent dans un secret, ne sont ni versionnées ni publiées, et ne sont donc dérivées de rien. | Une valeur recopiée devient fausse sans que rien n'échoue : c'est le mode de panne que ces dépôts combattent partout ailleurs. Mais les trois dépôts sont **publics**, et un seuil de détection versionné est un seuil publié — donc un seuil contournable. La dérivation s'arrête là, et l'exception est écrite ici pour qu'on ne la découvre pas. |

---

## 2. Arborescence du socle

```
MCP-Socle-Juridique/
├── src/
│   ├── protocole/
│   │   ├── rpc.ts            enveloppe JSON-RPC 2.0 (repris de jurisprudence/src/mcp/rpc.ts)
│   │   ├── transport.ts      Streamable HTTP sans état : POST unique, JSON ou SSE par requête
│   │   ├── entetes.ts        MCP-Protocol-Version, Mcp-Method, Mcp-Name, Mcp-Param-*,
│   │   │                     décodage du sentinelle =?base64?…?=, validation en-tête<->corps
│   │   ├── meta.ts           _meta : protocolVersion, clientInfo, clientCapabilities, serverInfo
│   │   ├── decouverte.ts     server/discover
│   │   ├── versions.ts       négociation, UnsupportedProtocolVersionError, pont vers initialize
│   │   ├── valide.ts         JSON Schema en sous-ensemble (repris de jurisprudence)
│   │   └── registre.ts       ToolDescriptor : + outputSchema, + classe, + ordre déterministe
│   ├── identite/
│   │   ├── porteur.ts        extraction du jeton : Bearer | ?key= | segment de chemin
│   │   ├── titulaire.ts      résolution jeton -> Titulaire, à temps constant
│   │   └── refus.ts          404 sans oracle (S8) ; bascule 401+PRM derrière un drapeau
│   ├── coffre/
│   │   ├── enveloppe.ts      HKDF-SHA256 + AES-256-GCM, AAD liée au titulaire
│   │   └── canlii.ts         ouvrirClientCanlii(titulaire) -> CanliiClient  (JAMAIS -> string)
│   ├── gouverne/
│   │   ├── debit.ts          limiteur d'arête, clé = titulaire_id
│   │   ├── quota.ts          compteurs journaliers par classe
│   │   ├── score.ts          signaux de comportement (§6.3), calculés sans contenu
│   │   ├── etats.ts          machine d'états du titulaire + registre en ajout seul
│   │   └── coupe.ts          coupe-circuits : global, par outil, par titulaire
│   ├── journal/
│   │   ├── technique.ts      type sans champ libre — l'invariant S13 est dans le type
│   │   ├── forme.ts          expurgerForme() + écriture agrégée
│   │   └── purge.ts          rétention, appelée par le cron
│   ├── sortie/
│   │   ├── enveloppe.ts      Enveloppe<T> : @context, @type, @id, donnees, provenance, gardes
│   │   ├── gardes.ts         registre des codes de mise en garde (§8.4)
│   │   ├── frbr.ts           frappe et analyse des identifiants (§8.2)
│   │   └── jsonld.ts         contexte servi, cadrage
│   ├── page/
│   │   ├── rendu.ts          page publique dérivée du registre
│   │   └── wellknown.ts      /.well-known/, contexte JSON-LD, paquet de schémas
│   └── index.ts              rien d'exécutable : uniquement des exports
├── test/                     tests du socle, sans réseau ni clef
└── package.json              "type": "module", zéro dépendance d'exécution
```

**Ce que le socle ne porte jamais.** L'analyseur de citations, les tables du Québec, le
pipeline EPUB, les descripteurs d'outils, les gabarits de rendu du domaine. Le socle ne connaît
pas le droit. S'il faut y écrire le mot « article », c'est qu'on s'est trompé de dépôt.

---

## 3. Protocole `2026-07-28`, sans état

### 3.1 Ce qui disparaît

Retirer, des deux Workers : la poignée `initialize` et `notifications/initialized` comme
préalable, l'en-tête `Mcp-Session-Id` (ignoré, jamais frappé ni renvoyé), la route `GET` sur le
point d'entrée MCP (`405`), la route `DELETE` (`405`), `Last-Event-ID` (ignoré), `ping`,
`logging/setLevel`, `notifications/roots/list_changed`. `legislation` perd du même coup sa
classe `QclawMCP extends McpAgent` et son Durable Object.

### 3.2 Ce qui apparaît

**`server/discover` est obligatoire.** Rend les versions servies, les capacités et l'identité du
serveur. C'est aussi la sonde de compatibilité : un client peut l'appeler avant tout le reste.

**`_meta` par requête.** Chaque requête porte `io.modelcontextprotocol/protocolVersion`,
`io.modelcontextprotocol/clientInfo` et `io.modelcontextprotocol/clientCapabilities`. Chaque
résultat porte `io.modelcontextprotocol/serverInfo`. Le `clientInfo` est **un signal de gouverne
de premier ordre** (§6.3) : le conserver dans `evenement_technique.client`.

**Validation en-tête contre corps.** `MCP-Protocol-Version` doit égaler la valeur de `_meta` ;
`Mcp-Method` doit égaler `method` ; `Mcp-Name` doit égaler `params.name` ou `params.uri`, après
décodage du sentinelle `=?base64?…?=`. Tout écart : `400` + JSON-RPC `-32020` (`HeaderMismatch`).
Une version inconnue : `400` + `-32022` (`UnsupportedProtocolVersion`) listant les versions
servies. Une méthode inconnue : `404` + `-32601`, avec corps JSON-RPC — le corps est ce qui
distingue ce cas du `404` d'un serveur d'ancienne génération.

**`resultType`.** Tout résultat porte `resultType: "complete"`. Aucun outil de ces deux
connecteurs n'a besoin de `"input_required"` : ils sont en lecture seule et ne sollicitent
jamais l'usager. Ne pas implémenter le patron MRTR.

**`ttlMs` et `cacheScope`.** Obligatoires sur `tools/list`, `resources/list`,
`prompts/list`, `resources/read`, `resources/templates/list`.

| Résultat | `ttlMs` | `cacheScope` | Motif |
|---|---|---|---|
| `tools/list` | 3 600 000 | `public` | le registre ne bouge qu'au déploiement |
| `resources/list` (législation) | 86 400 000 | `public` | corpus semestriel |
| `resources/read` (article) | 86 400 000 | `public` | texte officiel, immuable dans l'expression |
| `resources/read` (fiche de décision) | 604 800 000 | `private` | tiré de la collection de CanLII sous la clef d'un licencié (S17) |

**Ordre déterministe de `tools/list`.** Trier par nom, jamais par ordre d'insertion d'objet.
Améliore la mise en cache d'invite côté client, et rend la page publique stable.

**`x-mcp-header`.** N'annoter **aucun** paramètre. Le seul usage envisageable serait la clef
CanLII, et il est écarté par S10. Un test de garde doit épingler l'absence de la chaîne
`x-mcp-header` dans les deux registres.

### 3.3 Compatibilité descendante

Le pont vit dans `protocole/versions.ts` et dans lui seul.

- Requête **sans** `MCP-Protocol-Version` : la spécification n'ouvre que deux branches — la
  traiter comme `2025-03-26` (permis seulement si l'on prend en charge les clients antérieurs
  à `2025-06-18`), ou la refuser en `400` + `-32020`. S3 retirant `2025-03-26`, **la refuser**.
  Ne jamais la promouvoir silencieusement en `2025-06-18` : ce serait inventer une troisième
  branche.
- Méthode `initialize` reçue : répondre comme avant, et retenir la version annoncée pour la
  durée de la requête seulement. Aucun état conservé — c'est une **imitation** de poignée.
- `notifications/initialized` : `202` vide.
- Sous une version antérieure à `2026-07-28` : ne pas exiger `Mcp-Method`/`Mcp-Name`, ne pas
  émettre `resultType`, ne pas émettre `ttlMs`/`cacheScope`.

**Porte de validation.** Une même session d'évaluation doit passer intégralement en
`2026-07-28`, en `2025-11-25` et en `2025-06-18`, et les connecteurs claude.ai existants doivent
rester opérationnels sans reconfiguration. Ordre de bascule impératif : **déployer le pont
avant de retirer quoi que ce soit.** L'ordre inverse a déjà détruit un connecteur (2026-07-25).

---

## 4. Identité, titulaires, jetons

### 4.1 Schéma

```sql
-- migrations/xxxx_socle_identite.sql   (identique dans les deux bases)

CREATE TABLE titulaire (
  id                TEXT PRIMARY KEY,              -- ULID
  cree_le           TEXT NOT NULL,
  etat              TEXT NOT NULL DEFAULT 'en_attente'
                    CHECK (etat IN ('en_attente','actif','surveille','limite',
                                    'suspendu','revoque','refuse')),
  -- Identité PROFESSIONNELLE. Nom et numéro de membre sont des renseignements publics
  -- (Tableau de l'Ordre) et la revue humaine les exige. Rien d'autre n'est collecté.
  nom               TEXT NOT NULL,
  numero_membre     TEXT NOT NULL UNIQUE,          -- non vérifiable par machine : cf. §4.4
  section           TEXT,
  courriel          TEXT NOT NULL UNIQUE,
  cabinet           TEXT,
  attestation_le    TEXT,                          -- horodatage de l'attestation solennelle
  attestation_ver   TEXT,                          -- version du texte attesté
  cgu_ver           TEXT,                          -- version des CGU acceptées
  -- Préférences de confidentialité du titulaire.
  hybride_permis    INTEGER NOT NULL DEFAULT 1,    -- S19 : recherche sémantique
  forme_permise     INTEGER NOT NULL DEFAULT 0,    -- S14 : contribution au plan de contenu
  note_admission    TEXT                           -- ce que l'exploitant a vérifié, et comment
);

CREATE TABLE jeton (
  id            TEXT PRIMARY KEY,
  titulaire_id  TEXT NOT NULL REFERENCES titulaire(id),
  -- SHA-256 du jeton, en hexadécimal. Le jeton EN CLAIR n'est montré QU'UNE FOIS, à
  -- l'émission, et n'existe ensuite nulle part.
  empreinte     TEXT NOT NULL UNIQUE,
  queue         TEXT NOT NULL,        -- 6 derniers caractères : reconnaître sans divulguer
  libelle       TEXT NOT NULL,        -- « claude.ai bureau », « Claude Code portable »
  emis_le       TEXT NOT NULL,
  expire_le     TEXT,                 -- 365 jours par défaut
  revoque_le    TEXT,
  motif_revoc   TEXT,
  vu_le         TEXT                  -- dernier usage, AU JOUR. Jamais à la seconde.
);
CREATE INDEX jeton_actif ON jeton(empreinte) WHERE revoque_le IS NULL;
```

**Correctif A2 — la forme du jeton, qui n'était spécifiée nulle part.** Le schéma ci-dessus
décrit soigneusement l'empreinte, la queue de six caractères et l'expiration, et ne dit **rien**
de ce qui est haché. Dans une spécification publique portant sur l'authentification, « non
spécifié » est la façon dont on se retrouve dans deux ans avec un jeton de douze caractères
tiré de `Math.random`, sans qu'aucune revue ne l'ait décidé. La forme est donc arrêtée ici :

```ts
// identite/porteur.ts — LA seule fabrique de jetons du dispositif.
export function frapperJeton(): string {
  const octets = new Uint8Array(32);            // 256 bits
  crypto.getRandomValues(octets);               // CSPRNG du runtime, jamais Math.random
  return base64url(octets);                     // 43 caractères, sûrs en URL et en en-tête
}
```

- **256 bits.** Le jeton voyage en clair dans une URL (S7, `?key=`) : il ne bénéficie
  d'aucun secret d'appoint, et il est la totalité du facteur d'authentification. Avec cette
  taille, la recherche exhaustive cesse d'être une hypothèse à défendre, ce qui est exactement
  ce qu'on veut, l'étage de débit anonyme (A1) n'étant qu'un filet.
- **`base64url`, sans remplissage.** Les trois porteurs de S7 sont un segment de chemin, un
  paramètre de requête et un en-tête : l'alphabet doit traverser les trois sans encodage, sinon
  `decodeURIComponent` et la comparaison divergent selon le porteur employé.
- **Aucune structure, aucun préfixe parlant.** Pas de `titulaire_id` encodé, pas d'horodatage :
  un jeton qui se lit renseigne celui qui l'intercepte, et invite à décider sur son contenu
  plutôt que sur la table.
- **Montré une seule fois** (§4.4), puis n'existe plus que sous forme d'empreinte. La queue de
  six caractères sert à le reconnaître dans la console, jamais à l'identifier au contrôle.

Un test de garde épingle les trois propriétés — longueur, alphabet, et le fait que
`frapperJeton` est la seule fonction du socle qui appelle `getRandomValues` pour un jeton.

### 4.2 Résolution

```ts
// identite/titulaire.ts
export async function resoudre(db: D1Database, presente: string): Promise<Titulaire | null>;
```

- Empreinte = `SHA-256(presente)` en hexadécimal minuscule, puis **une** lecture indexée.
- La comparaison est faite par l'index, sur un condensé : aucune fuite de préfixe n'est
  possible, contrairement à un `===` sur le jeton lui-même. La comparaison à temps constant de
  `safeEqual` reste utile pour les secrets d'administration (§9), pas ici.
- Un jeton expiré, révoqué, ou dont le titulaire n'est pas dans un état servi, est un jeton
  **inconnu** : même issue, même code, même délai. Aucun oracle.
- **Fermé par défaut, sans exception.** Aucune configuration ne doit ouvrir le point d'entrée :
  ni l'absence de secret, ni une table `jeton` vide, ni une erreur de lecture D1. C'est
  l'inverse du comportement actuel de `legislation` (`if (!secret) return onMount ? request`),
  qui est aussi son seul rollback documenté — d'où la marche 5 de la §11, à lire avant de
  toucher à `MCP_TOKEN`.
- `vu_le` est écrit **au plus une fois par jour et par jeton**, dans `ctx.waitUntil`.

### 4.3 Ordre de traitement d'une requête

L'ordre est délibéré à chaque marche, et le motif de chacune est écrit ici parce qu'il n'est
pas devinable.

1. **Coupe-circuit global, borné au bloc `/mcp` et à `/health`.** `MCP_ENABLED !== "true"` :
   `404`. **La polarité est celle du dépôt** — variable absente, vide ou mal orthographiée
   ⇒ service éteint. Ne jamais l'écrire `=== "false"` : ce serait un garde ouvert par défaut
   sur un service multilocataire. Et le coupe-circuit **ne touche ni `/`, ni les consoles, ni
   les documents publics** : c'est précisément quand le connecteur est coupé qu'un confrère
   doit pouvoir lire pourquoi, et retrouver la voie de rétablissement.
2. **Origine.** Une origine de navigateur présente et non reconnue : `403`, **avant toute
   authentification** — c'est la défense contre le ré-attachement DNS exigée par la
   spécification.
3. **Pré-vol CORS.** Répondu avant l'authentification : le navigateur l'émet sans en-tête
   d'authentification, et l'exiger casserait tout client de navigateur sans rien protéger.
4. **Débit anonyme.** Un plafond grossier avant la lecture D1, pour qu'une rafale de requêtes
   mal authentifiées ne coûte rien. Clé : `CF-Connecting-IP`, **jamais l'empreinte du jeton
   présenté** — voir le correctif A1 de la §6.1, qui explique pourquoi la clé évidente ne
   limite rien du tout.
5. **Identité.** Résolution du porteur. Échec : `404` (S8).
6. **Méthode — APRÈS l'identité, et c'est délibéré.** `2026-07-28` recommande `405` sur `GET`
   et `DELETE`, mais un `405` servi avant l'authentification apprend à un anonyme que le point
   d'entrée existe : c'est exactement l'oracle que S8 refuse. Le connecteur claude.ai émet des
   `GET /mcp` sans aucun porteur ; ils restent en `404`. Second écart assumé, à côté de S8, avec
   son test.
7. **État du titulaire.** `suspendu`, `revoque`, `refuse`, `en_attente` : `404`. `limite` :
   servi, avec quotas réduits.
8. **Débit par titulaire.** `429` + `Retry-After`.
9. **Lecture des compteurs.** Une lecture indexée sur `(titulaire_id, jour)` rend les trois
   classes d'un coup. On lit ici ; **on ne décide pas encore**.
10. **Validation des en-têtes** (§3.2), puis de l'enveloppe, puis des arguments.
11. **Décision de quota**, une fois le nom d'outil connu du **corps** — donc sa classe. Ne
    jamais décider sur l'en-tête `Mcp-Name` seul : c'est la vulnérabilité que la spécification
    décrit (l'intermédiaire décide sur l'en-tête, le serveur exécute sur le corps), et
    l'en-tête n'est pas exigé sous les versions antérieures que §3.3 continue de servir.
    Dépassement : une **erreur d'outil** typée `QUOTA_EPUISE`, pas un `429` HTTP — le modèle
    doit pouvoir la lire et l'expliquer au praticien.
12. **Exécution**, puis journalisation technique dans `ctx.waitUntil`.

**Le pré-vol n'est JAMAIS limité en débit.** Un `429` sur un pré-vol ne remonte au navigateur
que comme un échec CORS opaque : le connecteur casserait sans que le motif soit lisible nulle
part. Un test épingle ce comportement dans les deux dépôts.

### 4.4 Admission

Aucune auto-inscription. La console publique n'offre qu'un formulaire de **demande**.

| Champ | Obligatoire | Usage |
|---|---|---|
| Nom, prénom | oui | vérification au bottin ; `titulaire.nom` |
| Numéro de membre | oui | vérification ; contrôle de format seulement, jamais d'existence |
| Section du Barreau | oui | vérification |
| Courriel | oui | notification ; un domaine de cabinet est un indice, pas une preuve |
| Attestation solennelle | oui | « je suis membre en règle du Barreau du Québec » — horodatée, versionnée |
| Acceptation des CGU | oui | version conservée |

La revue est **humaine et manuelle** : il n'existe aucune interface machine du Tableau de
l'Ordre, et la vérification passe par le Registrariat. Ne pas implémenter de vérification
automatique, ne pas moissonner le bottin, ne pas laisser croire dans l'interface qu'une
vérification a eu lieu quand elle n'a pas eu lieu. `note_admission` consigne ce qui a été
vérifié et comment : c'est la seule trace de diligence.

À l'approbation : émission d'un jeton, affiché **une seule fois**, accompagné de l'URL de
connecteur prête à coller pour chacun des trois porteurs (S7).

---

## 5. Coffre de clefs CanLII

### 5.1 Schéma

```sql
CREATE TABLE coffre_canlii (
  titulaire_id  TEXT PRIMARY KEY REFERENCES titulaire(id),
  version       INTEGER NOT NULL,     -- sélectionne COFFRE_MAITRE_V{n} : rotation sans réécriture
  iv            BLOB NOT NULL,        -- 12 octets, tiré au hasard à chaque pose
  chiffre       BLOB NOT NULL,        -- AES-256-GCM, marque d'authenticité incluse
  repere        TEXT NOT NULL,        -- 4 premiers + 4 derniers + 8 hex de SHA-256. NON réversible.
  pose_le       TEXT NOT NULL,
  eprouve_le    TEXT,                 -- dernier appel témoin réussi
  etat          TEXT NOT NULL CHECK (etat IN ('valide','refusee','inconnue'))
);
```

### 5.2 Chiffrement

```
DEK = HKDF-SHA256(ikm = COFFRE_MAITRE_V{n}, salt = titulaire_id, info = "canlii/v1")
chiffre = AES-256-GCM(DEK, iv, clair, aad = titulaire_id || ":canlii:" || version)
```

La donnée additionnelle authentifiée liée au titulaire fait qu'une ligne recopiée sur un autre
compte **ne se déchiffre pas** : une erreur de restauration ou une exfiltration partielle ne
donne pas une clef utilisable ailleurs. `COFFRE_MAITRE_V1` est posé par
`wrangler secret put` et ne vit ni dans la base, ni dans `wrangler.jsonc`, ni sur disque.

### 5.3 L'invariant qui compte

```ts
// coffre/canlii.ts — LA SEULE porte vers le texte clair.
export async function ouvrirClientCanlii(
  db: D1Database, titulaire: Titulaire, entete: string | null, env: Env,
): Promise<CanliiClient>;                 // JAMAIS Promise<string>
```

Le texte clair vit dans une fermeture, le temps de fabriquer le client, et n'est **jamais** une
valeur que le reste du code peut tenir, renvoyer ou journaliser. Aucune autre fonction du dépôt
ne déchiffre. Trois tests de garde :

1. `coffre/canlii.ts` est le seul fichier qui importe `enveloppe.ts`.
2. Aucune signature exportée du dépôt ne rend une clef — `grep` de retour `string` sur les
   symboles dont le nom contient `clef`, `key`, `secret`.
3. La suite existante `redactUrl` est généralisée en `expurger()` et appliquée à **toute**
   chaîne journalisée. Le test capital de `test/client.test.ts` — la clef n'apparaît dans
   aucune sortie journalisable — est étendu au coffre, à l'en-tête `X-Clef-CanLII` et aux
   messages d'erreur.

### 5.4 Pose, épreuve, retrait

- **Pose** : uniquement par la console du titulaire, sur session authentifiée, en `POST`. Un
  appel témoin inoffensif (`caseBrowse/fr/`) confirme que la clef fonctionne **avant**
  l'écriture. En cas de `401`/`403` de CanLII, rien n'est écrit et le motif est rendu.
- **Ordre de résolution** à l'appel : en-tête `X-Clef-CanLII` (S11), puis coffre, puis
  `CLEF_ABSENTE`. **Aucune retombée sur la clef de l'exploitant** (S12) — un test l'épingle en
  posant `CANLII_API_KEY` et en vérifiant qu'un titulaire sans clef échoue quand même.
- **Épreuve périodique** : le cron hebdomadaire tente un appel témoin par clef `valide` non
  éprouvée depuis 30 jours et bascule à `refusee` le cas échéant, avec notification. Une clef
  révoquée par CanLII qui ne se découvre qu'au milieu d'une recherche est une mauvaise
  expérience évitable.
- **Retrait** : suppression de la ligne. Aucune conservation, aucune corbeille.
- **Étranglement par clef, non par invocation.** `CANLII_MIN_INTERVAL_MS` reste par invocation,
  mais `CANLII_MAX_CALLS_PER_INVOCATION` est doublé d'un budget **journalier par titulaire**
  (§6.2). Sinon un confrère peut faire étrangler sa propre clef en une minute.

---

## 6. Gouverne : débit, quotas, comportement, états

### 6.1 Étage 1 — débit à l'arête

Le limiteur Cloudflare existant de `jurisprudence` est **modifié**, non repris tel quel : sa
clé est aujourd'hui `CF-Connecting-IP`, et elle devient `titulaire_id` (S15). Le client est
claude.ai : l'adresse source est celle d'Anthropic, et limiter dessus punit tous les titulaires
ensemble sans en attribuer un seul. Le commentaire de `wrangler.jsonc` change avec la clé.

**Quatre espaces exigent quatre bindings.** Le plafond ne vit pas dans l'appel mais dans
`ratelimits.simple.{limit,period}` : les quatre lignes ci-dessous sont quatre bindings
distincts, avec quatre `namespace_id` — et **les deux dépôts doivent cesser d'employer le même
`namespace_id` `"1001"`**, qu'ils portent tous deux aujourd'hui.

| Espace | Clé | Plafond de départ | Réponse |
|---|---|---|---|
| anonyme | `CF-Connecting-IP` (**A1**) | 20 / min | `404` |
| échecs cumulés | constante globale `"echecs"` (**A1**) | 300 / min | `404` |
| titulaire | `titulaire_id` | 60 / min | `429` + `Retry-After: 60` |
| titulaire `limite` | `titulaire_id` | 10 / min | `429` + `Retry-After: 300` |

Le limiteur d'arête est approximatif et par centre de données : c'est une propriété assumée. Il
ne sert pas à compter, il sert à ce qu'une boucle ne coûte rien.

**Correctif A1 — pourquoi la clé anonyme n'est PAS l'empreinte du jeton.** La première
rédaction fondait la clé de l'étage anonyme sur l'empreinte du jeton présenté. C'est la clé évidente, et
elle ne limite **rien** : qui essaie un million de jetons produit un million d'empreintes
distinctes, donc un million de compteurs à 1. Le seuil n'est jamais atteint, et chaque essai
traverse le limiteur jusqu'à la lecture D1 — soit exactement l'inverse du but énoncé à la §4.3
marche 4, qui est qu'une rafale mal authentifiée ne coûte rien.

La clé doit être une chose que l'appelant ne peut pas faire varier à volonté. Pour un
**titulaire**, c'est `titulaire_id` ; l'adresse serait celle d'Anthropic (S15). Pour un
**inconnu**, c'est l'inverse : il n'a pas de `titulaire_id` — c'est précisément ce qu'il
cherche — et il appelle de chez lui. `CF-Connecting-IP` redevient donc la bonne clé, et la
seule, à cet étage-là et à aucun autre.

Le second espace est un **filet contre la distribution** : une seule fenêtre globale comptant
les refus, toutes adresses confondues. Il ne protège pas d'un attaquant patient ; il borne le
coût d'une rafale répartie. Il est **grossier à dessein** — s'il se déclenche, le service refuse
tout le monde pendant une minute, ce qui est un incident à traiter, non un régime de
fonctionnement. Le plafond de départ (300/min) est donc très au-dessus du trafic légitime de
refus attendu.

Ces deux étages ne protègent que dans la mesure où le jeton lui-même est hors de portée : c'est
l'objet du correctif A2 (§4.1).

**Le WAF de la zone arrive avant lui.** L'invariant 9 de `legislation` consigne que le WAF
bloque les rafales de `POST` non-navigateur sur le domaine personnalisé — c'est ce qui a forcé
le rattrapage des vecteurs à passer par `workers.dev`. Un confrère en Claude Code appelle de
serveur à serveur : il rencontrera cette règle **avant** tout limiteur applicatif, et le refus
ne ressemblera à rien de ce que ce document décrit. À vérifier et à ajuster avant l'ouverture,
et à retenir pour le rejeu de fixtures de la §8.5.

### 6.2 Étage 2 — quotas journaliers

```sql
CREATE TABLE compteur_jour (
  titulaire_id  TEXT NOT NULL,
  jour          TEXT NOT NULL,       -- AAAA-MM-JJ, UTC
  classe        TEXT NOT NULL CHECK (classe IN ('local','sortant','semantique')),
  appels        INTEGER NOT NULL DEFAULT 0,
  erreurs       INTEGER NOT NULL DEFAULT 0,
  introuvables  INTEGER NOT NULL DEFAULT 0,
  sortants      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (titulaire_id, jour, classe)
);
```

**`INSERT ... ON CONFLICT DO UPDATE`, jamais `INSERT OR REPLACE`.** La forme de l'invariant 1
de `jurisprudence` vaut ici, mais **pas son motif** : là-bas, `REPLACE` change le `rowid` et
fait diverger en silence l'index FTS5 en *external content* sur `cases`. Il n'y a pas de FTS
sur `compteur_jour`. Le motif ici est plus simple : `REPLACE` remet les colonnes omises à leur
défaut, donc écrase les compteurs des autres classes.

| Classe | Outils | Plafond `actif` | Plafond `limite` |
|---|---|---|---|
| `local` | `qclaw_*` lexicaux, `qclaw_find_relevant` (classement **déterministe**, aucun appel à Workers AI), `greffe_*`, `palais_*`, `canlii_parse_citation` | 1 000 / jour | 100 |
| `sortant` | tout `canlii_*` qui appelle l'API | 200 / jour | 20 |
| `semantique` | `qclaw_search_text` **seulement**, en mode hybride | 100 / jour | 10 |

La lecture du compteur est **une** lecture indexée en début de requête ; l'incrément est
différé dans `ctx.waitUntil`. Un léger dépassement est donc possible sur une rafale
concurrente : propriété assumée, à documenter, non à corriger par une transaction qui
coûterait plus que le dépassement.

### 6.3 Étage 3 — score de comportement

Calculé par le cron nocturne, **exclusivement** sur `compteur_jour` et `evenement_technique`.
Aucun signal ne lit un contenu de requête ; c'est ce qui rend l'exigence 3 compatible avec
l'exigence 1.

**Le dépôt du socle est public.** La ligne de partage est donc la suivante, et ce n'est pas un
compromis boiteux entre deux exigences : les deux moitiés sont voulues.

| Public | Secret |
|---|---|
| **Ce qui est mesuré** : la liste des signaux, leur définition, la colonne qu'ils lisent | **À partir de quelle valeur** un signal est réputé franchi |
| **Ce qui arrive ensuite** : les états, qui décide, la voie de rétablissement | **Quelle combinaison** de signaux déclenche une proposition |

La première colonne n'est pas seulement tolérable, elle est **due**. Un confrère a le droit de
savoir ce qui est mesuré à son sujet et à quelle fin — c'est une obligation de transparence
avant d'être une politesse —, et un service qui mesure en silence ne mérite pas qu'on lui confie
une recherche. La seconde n'apporte rien à personne, sauf à celui qui veut se régler juste en
dessous.

| Signal | Mesure | Ce qu'il trahit |
|---|---|---|
| Volume | `appels` par classe sur 24 h, rapporté au plafond | usage industriel |
| Taux d'échec | `erreurs / appels` | intégration fautive, ou sondage |
| Taux d'introuvable | `introuvables / appels` | **énumération d'identifiants** |
| Concentration | appels par minute active, et minutes actives consécutives | **automate, moissonnage** |
| Clients concurrents | `clientInfo` distincts par jeton et par jour | **jeton partagé** |
| Densité nominative | part de `canlii_find_case` dans les appels | recherche de personnes en masse |

**Aucune colonne « seuil » ici, et aucune valeur nulle part ailleurs dans le dépôt.** Le tableau
dit ce qu'on regarde ; il ne dit pas où est la barre.

**Deux signaux séduisants ont été retirés, et il faut savoir pourquoi.** La *cardinalité
d'identifiants distincts par heure* supposerait de conserver les identifiants demandés par
titulaire : c'est du contenu de requête, que S13 interdit, et qu'aucune colonne ne porte. Une
empreinte salée n'y changerait rien — l'espace des identifiants de décision est petit, donc
inversible par dictionnaire. La *régularité des intervalles* au seuil de 200 ms est impossible
sur un horodatage à la minute, et descendre à la seconde rouvrirait la jointure temporelle que
la §7.3 ferme. Le moissonnage se détecte donc par la conjonction du taux d'introuvable, du
volume et de la concentration — moins fin, mais compatible avec l'exigence 1. C'est le prix de
S13, et il est assumé.

**Où vivent les seuils.** Dans un secret `SEUILS_GOUVERNE`, posé par `wrangler secret put` —
**jamais** dans les `vars` de `wrangler.jsonc` : dans un dépôt public, tout ce qui est dans
`wrangler.jsonc` est publié par construction, et c'est précisément l'erreur que la première
rédaction de cette section commettait. Le secret porte un document JSON versionné, validé contre
un schéma au démarrage. La forme est publique ; les valeurs, marquées `…` ici, ne le sont pas :

```jsonc
{
  "version": 1,
  "signaux": {
    "volume":        { "facteur_plafond": …, "jours": … },
    "echec":         { "part": …, "appels_min": … },
    "introuvable":   { "part": …, "appels_min": … },
    "concentration": { "appels_par_minute": …, "minutes": … },
    "clients":       { "distincts": … },
    "nominative":    { "part": …, "appels_min": … }
  },
  "proposition": { "surveille": …, "limite": … }   // nombre de signaux franchis
}
```

**Secret absent ou invalide = observation seule, et bruyamment.** Le cron calcule alors les
signaux, les écrit au registre avec `auteur = 'automate'` et `vers = de` — donc sans changer
d'état — et émet un avertissement à chaque exécution. Il ne dégrade **jamais** personne sur des
valeurs devinées : un défaut compilé serait à la fois public et arbitraire, soit le pire des
deux mondes. Un service qui ne sait pas où est sa barre ne coupe l'accès de personne.

**Conséquence sur les tests, à respecter dès la première ligne.** La fonction de score prend ses
seuils **en paramètre** ; elle ne lit jamais l'environnement elle-même. Les tests en injectent
d'arbitraires, et aucune fixture n'encode de valeur réelle. La porte G26 échoue si un littéral
numérique de seuil réapparaît dans `gouverne/score.ts` ou dans `wrangler.jsonc`.

**Ce que la page `/gouverne` publie.** Les quotas, à la valeur exacte — le titulaire doit pouvoir
s'y conformer. La liste des signaux ci-dessus, à la définition exacte. Les états, qui décide, et
la voie de rétablissement. Et la mention **écrite** que les valeurs de franchissement ne sont pas
publiées, avec son motif : dire qu'on ne dit pas vaut mieux que laisser croire qu'il n'y a rien.

**Ce qui reste exposé, et qu'il faut assumer.** Publier la liste des signaux apprend à qui veut
abuser *quelles dimensions* surveiller — étaler dans le temps, varier les outils, ne pas
énumérer. C'est exact, et c'est le prix de la transparence due au confrère. La protection réelle
n'a jamais été le secret de cette liste : ce sont les seuils, la revue humaine à l'admission, et
le fait qu'un compte révoqué ne se remplace pas par une réinscription.

### 6.4 États et registre

```
en_attente ──approbation──> actif ⇄ surveille ⇄ limite ──décision humaine──> suspendu
     │                                                                          │
     └──refus──> refuse                                        révocation ──> revoque
```

```sql
CREATE TABLE registre_gouverne (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  titulaire_id  TEXT NOT NULL REFERENCES titulaire(id),
  le            TEXT NOT NULL,
  de            TEXT NOT NULL,
  vers          TEXT NOT NULL,
  motif         TEXT NOT NULL,      -- CODE du registre des motifs, jamais un texte libre
  auteur        TEXT NOT NULL CHECK (auteur IN ('automate','exploitant')),
  signaux       TEXT,               -- JSON des signaux franchis, chiffres seulement
  notifie_le    TEXT
);
```

**En ajout seul.** Aucune mise à jour, aucune suppression ; un test épingle l'absence de tout
`UPDATE registre_gouverne` et de tout `DELETE FROM registre_gouverne` dans le dépôt.

`actif ⇄ surveille ⇄ limite` : l'automate décide. `suspendu` et `revoque` : **l'exploitant
seul** (S16), et la transition écrit la notification au titulaire. La voie de rétablissement
est publiée dans les CGU : demande écrite, réponse dans les cinq jours ouvrables, motif donné.

### 6.5 Coupe-circuits

| Portée | Variable ou champ | Effet |
|---|---|---|
| Global | `MCP_ENABLED !== "true"` — **fermé par défaut** | `404` sur le bloc `/mcp` et `/health`. **Jamais** sur `/`, les consoles ni les documents publics |
| Par outil | `OUTILS_HORS_SERVICE = "canlii_find_case,…"` | l'outil disparaît de `tools/list` et rend `HORS_SERVICE` |
| Par titulaire | `titulaire.etat` | §6.4 |
| Sortant | `CANLII_HORS_SERVICE = "true"` | tous les `canlii_*` rendent `AMONT_HORS_SERVICE` ; les locaux servent |
| Sémantique | `hybride_permis` (par titulaire) ou `HYBRID_SEARCH` (global) | repli lexical, **annoncé** dans la sortie |

---

## 7. Journal en deux plans

### 7.1 Plan technique — porte le titulaire, ne porte aucun contenu

```sql
CREATE TABLE evenement_technique (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  titulaire_id  TEXT NOT NULL,
  jeton_id      TEXT NOT NULL,
  minute        TEXT NOT NULL,      -- AAAA-MM-JJTHH:MM. JAMAIS la seconde.
  outil         TEXT NOT NULL,
  classe        TEXT NOT NULL CHECK (classe IN ('local','sortant','semantique')),
  issue         TEXT NOT NULL CHECK (issue IN ('ok','introuvable','erreur_usager',
                                               'erreur_amont','refus','quota')),
  code          TEXT,               -- code du registre d'erreurs. JAMAIS un message libre.
  ms            INTEGER,
  sortants      INTEGER NOT NULL DEFAULT 0,
  client        TEXT                -- clientInfo : nom et version. Rien d'autre.
);
CREATE INDEX et_par_titulaire ON evenement_technique(titulaire_id, minute);
```

```ts
// journal/technique.ts — l'invariant S13 est PORTÉ PAR LE TYPE.
export interface EvenementTechnique {
  titulaire_id: string;  jeton_id: string;  minute: string;
  outil: string;         classe: Classe;    issue: Issue;
  code?: CodeErreur;     // union littérale FERMÉE — pas `string`
  ms?: number;           sortants?: number; client?: string;
}
```

`code` est une union de littéraux, non une chaîne : il est **impossible** d'y verser un
fragment de requête sans que le compilateur refuse. C'est la forme forte de l'invariant.

**Rétention : 90 jours.** Purge par le cron, sans exception ni dérogation.

### 7.2 Plan de contenu — porte une forme, ne porte aucun titulaire

```sql
CREATE TABLE forme_requete (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  jour     TEXT NOT NULL,           -- AAAA-MM-JJ. Aucune heure.
  outil    TEXT NOT NULL,
  forme    TEXT NOT NULL,           -- produit par expurgerForme(). Testé.
  verdict  TEXT,
  n        INTEGER NOT NULL DEFAULT 1,
  UNIQUE (jour, outil, forme, verdict)
);
```

Aucune colonne de titulaire, aucune colonne de jeton, aucune heure. L'agrégation par `n`
réduit encore la liaison possible. Alimenté **uniquement** si `titulaire.forme_permise = 1`,
lequel vaut `0` par défaut : un confrère ne contribue au réglage de l'analyseur que s'il y
consent.

```ts
// journal/forme.ts
export function expurgerForme(brut: string): string;
```

Conserve : l'année, le code de tribunal, le numéro de décision, la structure de ponctuation,
les identifiants d'éditeur (`J.E.`, `REJB`, `EYB`, `AZ`). Remplace par `[NOM]` : toute suite de
mots capitalisés hors vocabulaire connu, tout `X c. Y`, toute initiale suivie d'un point. Sur
échec de reconnaissance, l'entrée est **abandonnée**, pas conservée en clair. Défaut de
prudence délibéré : mieux vaut perdre une donnée de réglage qu'un nom.

### 7.3 Test de garde sur le schéma

Un test lit `migrations/` et **échoue** dans deux cas.

1. Une table déclare à la fois une colonne `titulaire_id` (ou `jeton_id`, ou `courriel`) et une
   colonne de texte non contrainte par un `CHECK ... IN (...)`.
2. Une table portant du texte libre déclare un horodatage **plus fin que le jour**. C'est le
   cas que les deux `search_log` existantes illustrent : sans titulaire, elles passeraient le
   premier contrôle, alors qu'un horodatage à la seconde suffit à les rejoindre à
   `evenement_technique` par la minute et à ré-identifier l'auteur d'une requête. `forme_requete`
   respecte déjà la règle ; elle n'était pas écrite.

C'est le contrôle qui rend l'invariant S13 durable après le départ de son auteur.

### 7.4 Le sort de la `search_log` existante

**Il y en a deux, et le document a d'abord manqué la seconde.** Celle de `jurisprudence` porte
les chaînes de citation, noms de parties compris. Celle de `legislation`
(`migrations/0001_search_log.sql`, colonne `query TEXT NOT NULL`, alimentée par `logSearch` de
`src/lib.ts` à **chaque** appel de `search_text` et `find_relevant`) porte le texte des requêtes
de recherche — les mêmes chaînes qui partent vers Workers AI. Elle est dépouillée par
`scripts/journal.mjs`, et l'invariant 7 du dépôt exige que tout repli y soit consigné : la
retirer casse cet invariant, donc la décision doit être explicite et l'invariant réécrit.

Pour chacune, avant la phase 2 : renommer en `search_log_exploitant`, cesser toute écriture
depuis le chemin d'exécution multilocataire, et arrêter par décision explicite si elle est
purgée ou conservée. Ne pas laisser la question se régler par défaut. `api_usage` migre vers
`compteur_jour`.

### 7.5 Observabilité Cloudflare

`observability: { enabled: true }` reste. Les invariants existants sont **étendus, non
assouplis** : ne jamais journaliser `request.url` (le jeton voyage dans le chemin et dans la
requête, S7), ni un corps JSON-RPC, ni un argument d'outil, ni un en-tête `Authorization` ou
`X-Clef-CanLII`. On journalise la **méthode**, le **nom d'outil**, le **code d'issue** et le
**titulaire** — rien d'autre. Un test parcourt tous les appels à `console.*` et échoue si
l'argument n'est pas une chaîne littérale ou une valeur d'un type sûr énuméré.

---

## 8. Sortie structurée

### 8.1 L'enveloppe

Tout outil rend un `content` en prose française **et** un `structuredContent` de la forme
suivante, validé contre un `outputSchema` publié.

```ts
interface Enveloppe<T> {
  "@context": string;      // https://<hôte>/ns/v1
  "@type": string;         // "Article" | "Division" | "Loi" | "Decision" | "Verdict" | …
  "@id"?: string;          // identifiant déréférençable (§8.2), quand il en existe un
  donnees: T;
  provenance: Provenance;
  gardes: Garde[];         // §8.4 — jamais vide quand une réserve s'applique
  pagination?: { offset: number; limite: number; total?: number };
}

interface Provenance {
  source: "legisquebec" | "canlii" | "mjq" | "local";
  autorite: string;               // « Éditeur officiel du Québec », « CanLII », « MJQ »
  corpus_version?: string;        // « 2026-04-01 » — l'EXPRESSION FRBR
  releve_le?: string;             // pour les tables du MJQ : « 2026-07-15 »
  cache: "aucun" | "local" | "arete";
  cache_pose_le?: string;
}

interface Garde { code: CodeGarde; severite: "information" | "reserve" | "avertissement"; texte: string; }
```

**La prose reste la prose.** Ne pas rendre du JSON dans `content`, ne pas dupliquer la prose
dans `structuredContent`. Chaque canal a son destinataire : la mise en garde se lit dans la
prose, elle s'applique depuis `gardes`.

**Écart assumé, consigné.** `2026-07-28` recommande (SHOULD) qu'un outil rendant du contenu
structuré renvoie **aussi** le JSON sérialisé dans un bloc `TextContent`, pour la compatibilité
descendante. On ne le fait pas : le bloc textuel est réservé à la prose qui porte la réserve, et
la dupliquer en JSON invite le modèle à lire la seconde et à ignorer la première — soit
exactement le mode de panne que l'invariant 4 de `jurisprudence` décrivait. Le contrôle qui rend
cet écart tenable : **`gardes` non vide est une obligation de compilation** dès qu'une réserve
s'applique à l'outil appelé, et non une intention.

### 8.2 Identifiants

**Législation — frappés, sur le patron FRBR d'Akoma Ntoso.**

| Niveau | Forme | Exemple |
|---|---|---|
| Œuvre | `/id/qc/loi/{loi}` | `/id/qc/loi/ccq` |
| Expression | `/id/qc/loi/{loi}/{lang}@{version}` | `/id/qc/loi/ccq/fr@2026-04-01` |
| Article | `…/art_{numero}` | `/id/qc/loi/ccq/fr@2026-04-01/art_1457` |
| Division | `…/{eId}` | `/id/qc/loi/ccq/fr@2026-04-01/bk_5__tit_1__chp_3` |
| Alias AKN | `/akn/ca-qc/act/{aaaa-mm-jj}/{numero}/{lng3}@{version}/!main#{eId}` | `/akn/ca-qc/act/1991-12-18/64/fra@2026-04-01/!main#bk_5__tit_1__chp_3` |

**Trois points à vérifier contre le document OASIS avant de frapper le moindre alias**, faute
de quoi ne pas l'appeler « AKN » : la langue s'exprime au niveau de l'expression en ISO 639-2
à **trois** lettres (`fra`, `eng` — non `fr`) ; l'IRI d'œuvre porte la **date et le numéro** de
la loi, non son sigle usuel ; et les `eId` emploient les abréviations **neutres** de la norme
(`bk_`, `tit_`, `chp_`, `art_`), non des abréviations françaises — `liv_5` n'en est pas une.
Le chemin `/id/…` sous votre domaine, lui, reste libre : c'est le vôtre.

Les décimaux du C.c.Q. (`2926.1`, `132.0.1`) se translittèrent `art_2926-1` et `art_132-0-1` :
le point est réservé aux extensions. La recodification 2016 du C.p.c. porte l'expression, pas
l'œuvre — `cpc/fr@2016-01-01` et `cpc/fr@2026-04-01` sont deux expressions de la même œuvre, et
l'ancien C.p.c. est une **œuvre distincte** (`cpc-1965`) si le corpus le couvre un jour.

**Jurisprudence — jamais frappés.** Les identifiants de CanLII font autorité : rendre
`databaseId`, `caseId`, la citation neutre et l'URL CanLII tels quels, plus une
`citation_normalisee` au *Manuel canadien de la référence juridique*. Ne frapper que sur ce dont
le connecteur est la source : `/id/qc/greffe/500`, `/id/qc/palais/montreal`,
`/id/qc/district/montreal`.

**Déréférençables, et c'est le point.** `GET` sur un identifiant négocie le contenu :
`text/html` pour l'humain, `application/ld+json` pour la machine, `application/xml`
(Akoma Ntoso) pour l'outil juridique, avec un en-tête
`Link: <…>; rel="describedby"; type="application/ld+json"`. Un identifiant qu'on ne peut pas
résoudre n'est pas un identifiant : c'est une chaîne.

Ces routes sont **publiques et non authentifiées** — le corpus législatif est le texte
officiel. Elles ne portent aucun jeton, ne lisent jamais `request.url` dans un journal, et
sont mises en cache à l'arête sur une clé synthétique (le piège du cache local de miniflare est
déjà documenté dans `legislation/src/index.ts` : le relire avant d'itérer sur ces routes).

### 8.3 Surface `resources/`

Exposer le corpus en ressources MCP dont l'**URI est l'identifiant `https://` déréférençable**
de la §8.2. Deux effets : un `ResourceLink` dans un résultat d'outil devient une adresse qu'un
praticien peut ouvrir, et un client peut lire une ressource sans passer par un outil.

`resources/templates/list` déclare `…/id/qc/loi/{loi}/{lang}@{version}/art_{numero}`.
`subscriptions/listen` : **non implémenté** — les corpus bougent deux fois l'an, `ttlMs` suffit.

### 8.4 Registre des codes de garde

Un tableau unique dans `sortie/gardes.ts`, publié sur la page et au `.well-known`. La prose de
chaque garde est celle qui figure déjà dans les gabarits de rendu : la promotion est mécanique,
pas rédactionnelle.

| Code | Sévérité | Où |
|---|---|---|
| `REPERAGE_HEURISTIQUE` | reserve | `qclaw_find_relevant`, `qclaw_search_text` |
| `TEXTE_A_VERIFIER` | reserve | toute sortie législative |
| `LANGUE_DISCORDANTE` | avertissement | requête FR sous `lang=en` et inversement |
| `METADONNEES_SEULEMENT` | avertissement | tout `canlii_*` de décision |
| `AUCUN_HISTORIQUE_APPEL` | avertissement | `canlii_citator`, `canlii_subsequent_history` |
| `AUCUN_INDICATEUR_TRAITEMENT` | avertissement | idem |
| `COUVERTURE_CANLII` | reserve | tout verdict |
| `ABSENCE_NON_PROBANTE` | avertissement | tout verdict négatif |
| `ADRESSE_PERISSABLE` | avertissement | `palais_get`, `palais_list` |
| `TABLE_LOCALE_DATEE` | information | `greffe_*`, `palais_*` |
| `SANS_ADRESSE_PUBLIEE` | information | les six greffes concernés |
| `SERVI_DU_CACHE` | information | toute réponse servie du cache |
| `REPLI_LEXICAL` | information | mode hybride indisponible ou désarmé |
| `RESULTAT_PARTIEL` | reserve | budget d'appels sortants épuisé |

`LANGUE_DISCORDANTE` **n'a rien à voir avec l'article 490 C.p.c.** L'affaire 490 était un échec
de *repérage* — ET implicite de FTS5, recherche restreinte à une loi, absence de pont sémantique
— et les rapports de phase la donnent réglée (cas 19 au rang 3, rappel@10 de 98 %). La
discordance de langue est un autre sujet, celui de l'invariant 4 de `legislation` : le
correctif est livré et épinglé par une éval, mais **la garde émise ne l'est pas**. C'est elle
que ce code ajoute. Ce qui reste ouvert sur 490 relève de la curation
(`gazetteer.json`, `division-links.json`, tous deux `validated: false`) et se dit sous
`REPERAGE_HEURISTIQUE`.

### 8.5 Contrat éprouvable par un tiers

- Contexte JSON-LD servi à `/ns/v1`, immuable ; toute rupture est `/ns/v2`.
- Paquet de schémas à `/.well-known/mcp-schemas.json` : tous les `inputSchema` et `outputSchema`.
- Fixtures de référence versées au dépôt (`fixtures/publiques/`), avec un script qui les rejoue
  contre le serveur déployé. Un tiers doit pouvoir éprouver son intégration sans vous écrire.
  **Le rejeu est une rafale de `POST` non-navigateur** : il rencontrera le WAF de la zone
  (invariant 9) avant tout limiteur. Le script doit viser `workers.dev`, ou la règle doit être
  ajustée — et le document remis au tiers doit le dire, sinon son premier essai échouera pour
  un motif introuvable.
- La page publique **dérive du registre**, sans seconde copie — invariant 19 existant, étendu
  aux `outputSchema`, aux gardes, aux quotas et aux durées de conservation (S20).

---

## 9. Consoles

Deux surfaces HTML distinctes, **hors** du bloc `/mcp`, chacune avec son propre secret.

| Route | Pour | Authentification |
|---|---|---|
| `/demande` | public | aucune — formulaire de demande (§4.4), limité en débit par IP, ici légitimement |
| `/moi` | titulaire | jeton de session court, obtenu par lien magique envoyé au courriel du titulaire |
| `/exploitant` | vous | `Authorization: Bearer` sur `CONSOLE_TOKEN`, comparaison à temps constant |

**`/moi`** : voir ses jetons (libellé, queue, dernier usage au jour), en émettre, en révoquer ;
poser, éprouver et retirer sa clef CanLII ; voir ses quotas et sa consommation du jour ;
désarmer la recherche sémantique ; consentir ou non au plan de contenu ; télécharger ce que le
service détient de lui ; demander la suppression de son compte. Les quatre derniers points sont
des obligations de la Loi 25, pas des agréments.

**`/exploitant`** : la file des demandes, avec approbation, refus et `note_admission` ; la liste
des titulaires et de leurs états ; le registre de gouverne ; les propositions de l'automate à
confirmer ; les compteurs agrégés. **Aucune vue ne rend un contenu de requête**, parce
qu'aucune table n'en porte un qui soit rattaché à un titulaire (S13). C'est ce qui rend
l'atténuation du conflit d'intérêts crédible : il n'y a rien à lire.

Chaque console applique la même politique de sécurité de contenu que la page publique — rien
n'est chargé d'un tiers, ni police, ni CDN, ni image.

---

## 10. Documents publics

Cinq textes, versionnés dans le dépôt et servis par le Worker. Les trois premiers sont
rédigés par vous ; les deux derniers **dérivent du code**.

| Document | Route | Auteur |
|---|---|---|
| Conditions d'utilisation | `/cgu` | vous — exclusion de garantie, absence d'engagement de disponibilité, préavis de fermeture, identité de l'exploitant et fait qu'il plaide, voie de rétablissement |
| Politique de confidentialité | `/confidentialite` | vous — responsable de la protection des RP, finalités, sous-traitants, conservation, droits |
| Attestation | `/attestation` | vous — texte que le demandeur atteste, versionné |
| Fiche de conformité | `/conformite` | **dérivée** : sous-traitants, localisation, tables et rétentions, chiffrement, ce que l'exploitant peut lire |
| Registre de gouverne | `/gouverne` | **dérivée** : quotas (valeurs exactes), liste des signaux mesurés, états, procédure — et **jamais** les valeurs de franchissement, avec mention écrite de cette réserve (§6.3) |

La fiche de conformité est le document dont un confrère prudent a besoin pour satisfaire à ses
propres obligations déontologiques. Qu'elle soit engendrée depuis le code est ce qui garantit
qu'elle ne mentira pas : une table ajoutée sans rétention déclarée doit **faire échouer la
compilation**.

---

## 11. Ordre de migration

Cette section est la plus dangereuse du document. **Deux incidents ont cassé le connecteur de
`legislation`** — le 2026-07-23 (le `404` du slash final) et le 2026-07-25 (une fenêtre de `404`
pendant une bascule faite dans le mauvais ordre), le second irréversiblement : il n'a été
débloqué que par `wrangler secret delete MCP_TOKEN`. Dans les deux cas, le mode de panne n'était
pas lisible — un `404` a poussé le client dans une découverte OAuth où il s'est coincé. Rien
d'équivalent n'est consigné pour `jurisprudence`.

**Règle générale : ajouter d'abord, servir les deux, retirer ensuite — jamais l'inverse.**

1. **Socle extrait, aucun comportement modifié.** Déplacer `rpc.ts` et `validate.ts` de
   `jurisprudence` vers le socle, sans changer une ligne de logique. De `registry.ts`, ne monter
   que le **type** `ToolDescriptor` et la mécanique de listage et d'ordre : les treize
   descripteurs, `INSTRUCTIONS`, `SERVER_INFO` et `callTool` **restent dans le dépôt** — c'est
   de la connaissance du domaine, que la §2 interdit au socle. Même réserve du côté de
   `legislation`, dont les descripteurs vivent dans `src/tools.ts` et `catalogue.json`, source
   unique des titres dont la parité est déjà épinglée par `tests/catalogue.test.mjs`. Suite
   verte, `tools/list` identique octet pour octet.
2. **`legislation` réécrit sur le socle, à comportement constant.** L'ancien `McpAgent` et le
   nouveau chemin coexistent derrière un drapeau (`SOCLE = "true"`). Basculer, observer une
   semaine, retirer le `McpAgent`.
3. **`2026-07-28` et `2025-11-25` ajoutés, `2025-06-18` conservé — les trois de S3.** Le pont
   de la §3.3 en premier. Ne retirer `2025-03-26` qu'après avoir constaté qu'aucun client ne
   l'annonce (le `clientInfo` du plan technique le dira).
4. **Sortie double, sans retirer la prose.** `structuredContent` ajouté outil par outil ;
   `content` intouché.
5. **Identité, en parallèle du secret partagé.** Les jetons par titulaire sont acceptés **en
   plus** de `MCP_TOKEN` et `MCP_SHARED_SECRET`. Poser un jeton de titulaire pour votre propre
   usage, vérifier, puis pour Pallas Athéna. **Danger, et il est réel :** sur `legislation`,
   retirer `MCP_TOKEN` n'éteint pas l'authentification, il **ouvre** `/mcp` — c'est le
   comportement R8, et c'est aussi le seul rollback qui a sauvé le connecteur le 2026-07-25.
   L'ordre est donc : livrer le défaut fermé du socle, **le vérifier par la porte G21**, et
   seulement ensuite retirer les secrets partagés. Jamais l'inverse.
6. **Coffre.** Votre clef y entre en premier. Vérifier qu'un titulaire d'essai sans clef reçoit
   bien `CLEF_ABSENTE` **avec** `CANLII_API_KEY` encore posée (S12). Ne retirer
   `CANLII_API_KEY` qu'ensuite.
7. **Gouverne, en observation d'abord.** Les seuils calculent et écrivent au registre sans
   appliquer, pendant deux semaines, sur votre seul trafic. Calibrer, puis armer.
8. **Journal en deux plans.** Nouvelles tables, écriture double, arrêt de la `search_log`
   multilocataire, renommage, décision sur la purge.
9. **Identifiants et `/id/`.** Additif, sans risque pour le bloc `/mcp`.
10. **Ouverture.** Cinq confrères, trente jours d'observation, puis la file d'admission.

**Pour chaque étape :** poser l'URL du connecteur **avant** d'armer le secret correspondant.
Cette forme d'URL doit répondre `200` avec **et** sans le nouveau contrôle, faute de quoi le
connecteur voit un `404` pendant la fenêtre de bascule.

---

## 12. Plan de test et portes de validation

La suite doit rester **entièrement hors ligne** : ni réseau, ni clef, ni quota. C'est déjà la
règle des deux dépôts et l'ouverture la rend plus impérative, pas moins.

| Porte | Contrôle | Phase |
|---|---|---|
| G1 | `npx wrangler types && npx tsc --noEmit && npx biome check . && npx vitest run` vert dans les trois dépôts | toutes |
| G2 | Registre confronté au README, et à la page publique — l'écart est une dérive même si tout est vert | toutes |
| G3 | Une même session d'évaluation passe en `2026-07-28`, `2025-11-25` et `2025-06-18` | 1 |
| G4 | `tools/list` rend le même ensemble, dans le même ordre, sous les trois versions | 1 |
| G5 | Tout `structuredContent` valide contre son `outputSchema` publié — sur **toutes** les fixtures | 1, 5 |
| G6 | Le pré-vol CORS n'est jamais limité en débit ; une origine inconnue est refusée avant l'authentification | 1 |
| G7 | Jeton inconnu, expiré, révoqué, et titulaire suspendu : **même** réponse, **même** code, **même** délai | 2 |
| G8 | Un titulaire sans clef reçoit `CLEF_ABSENTE` alors que `CANLII_API_KEY` est posée | 2 |
| G9 | Aucune sortie journalisable ne contient la clef CanLII, le jeton, ni `request.url` — étendu au coffre et à `X-Clef-CanLII` | 2 |
| G10 | Aucune signature exportée ne rend une clef en clair ; `enveloppe.ts` n'est importé que par `coffre/canlii.ts` | 2 |
| G11 | Un titulaire d'essai est limité par l'automate, puis rétabli, et les deux transitions figurent au registre | 3 |
| G12 | Aucun `UPDATE` ni `DELETE` sur `registre_gouverne` dans le dépôt | 3 |
| G13 | Test de garde de schéma : aucune table ne porte à la fois un titulaire et un texte libre | 4 |
| G14 | `expurgerForme()` ne laisse passer aucun nom sur un corpus de 200 citations éprouvantes ; l'échec de reconnaissance abandonne l'entrée | 4 |
| G15 | Tout appel à `console.*` a pour argument une chaîne littérale ou un type sûr énuméré | 4 |
| G16 | La purge à 90 jours vide effectivement `evenement_technique` (test sur horloge injectée) | 4 |
| G17 | Tout `@id` émis se résout en HTML, en JSON-LD et — pour la législation — en Akoma Ntoso | 5 |
| G18 | La fiche de conformité déclare **toutes** les tables du schéma ; une table sans rétention déclarée fait échouer la compilation | 5 |
| G19 | Aucune occurrence de `x-mcp-header` dans les deux registres | 1 |
| G20 | Le rejeu des fixtures publiques contre le serveur déployé est identique à la référence | 5 |
| G21 | **Aucun secret configuré ⇒ tout est refusé.** Table `jeton` vide, `MCP_TOKEN` absent, `MCP_SHARED_SECRET` absent, erreur de lecture D1 : quatre cas, quatre `404` | 2 |
| G22 | `MCP_ENABLED` absent, vide, `"FALSE"`, `"0"` ⇒ `404` sur `/mcp` ; et `/`, `/cgu`, `/conformite`, `/moi` répondent **quand même** `200` | 1 |
| G23 | Un `GET /mcp` sans porteur rend `404`, jamais `405` — l'oracle de la §4.3 marche 6 | 1 |
| G24 | Une requête sans `MCP-Protocol-Version` rend `400` + `-32020`, jamais un service silencieux | 1 |
| G25 | Toute table de contenu est horodatée **au jour** ; aucune ne descend à la seconde | 4 |
| G32 | **Le limiteur anonyme limite vraiment** : mille jetons DISTINCTS et invalides, présentés depuis une même adresse, sont refusés avant d'atteindre D1 — la clé ne varie pas avec le jeton (A1) | 3 |
| G33 | `frapperJeton()` rend 43 caractères `base64url`, tirés de `crypto.getRandomValues` ; aucune autre fonction du socle ne fabrique de jeton, et aucune n'emploie `Math.random` (A2) | 2 |
| G34 | Les quatre espaces de limitation portent quatre `namespace_id` distincts, et aucun n'est partagé entre les deux dépôts | 3 |
| G26 | Aucun littéral numérique de seuil dans `gouverne/score.ts` ni dans `wrangler.jsonc` ; `SEUILS_GOUVERNE` absent ou invalide ⇒ observation seule, aucun changement d'état, avertissement émis | 3 |

---

## 13. Phasage, effort, et ce qui n'est pas délégable

| Phase | Contenu | Effort Claude Code | Ce qui exige l'avocat |
|---|---|---|---|
| 0 | Déterminations préalables | — | **tout** : CanLII par écrit, EFVP, véhicule, assurance, textes |
| 1 | Socle, protocole `2026-07-28`, `legislation` hors `McpAgent`, sortie double | 3 à 5 séances | arbitrer S8 (404 contre 401) |
| 2 | Identité, jetons, coffre, consoles | 3 à 4 séances | les cinq textes de la §10, le processus d'admission |
| 3 | Gouverne : débit, quotas, score, états | 2 à 3 séances | arrêter les seuils et la voie de rétablissement |
| 4 | Journal en deux plans, purges, gardes | 1 à 2 séances | décider du sort de la `search_log` |
| 5 | Données structurées, identifiants, `/id/`, ressources | 3 à 4 séances | valider les identifiants FRBR et la citation normalisée |
| 6 | Ouverture graduée | — | choisir les cinq premiers, traiter la file |

Les phases 1, 4 et 5 sont livrables sans les déterminations de la phase 0 : elles n'exposent
rien de nouveau et améliorent les connecteurs pour votre propre usage. Les phases 2, 3 et 6 en
dépendent.

**Ce que ce document ne fait pas.** Il ne conçoit ni serveur d'autorisation OAuth (S9), ni
facturation, ni vérification automatique du Tableau de l'Ordre — laquelle n'existe pas. Il ne
touche ni à l'analyseur de citations, ni aux tables du Québec, ni au pipeline EPUB, ni au
moissonnage planifié du §11 de `SPEC_CANLII_MCP.md` — lequel n'est pas en attente d'une
détermination : il a été **tranché par la négative le 2026-07-23**, l'invariant 15 du dépôt
interdit de basculer le drapeau « même pour essayer », et rien ici ne rouvre cette décision.
