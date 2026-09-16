# Ouvrir les connecteurs juridiques à la confraternité — considérations et arbitrages

**Objet.** Exposer publiquement `legislation.poirierlavoie.ca` (Législation du Québec) et
`jurisprudence.poirierlavoie.ca` (Jurisprudence du Canada) à des avocats, de façon uniforme,
sous quatre exigences : confidentialité des requêtes, clef CanLII apportée par l'usager,
maîtrise de l'abus, et donnée structurée exploitable par un tiers.

**Paramètres retenus** (vos réponses du 2026-09-04) : service gratuit, admission par demande
suivie d'une revue humaine, livrables = la présente note et la spécification exécutable
`SPEC-SOCLE-COMMUN.md`.

---

## 1. L'essentiel, d'abord

Trois conclusions dominent tout le reste.

**Première.** Les deux connecteurs ne sont pas seulement dissemblables par accident : ils
reposent aujourd'hui sur deux modèles de transport opposés. `jurisprudence` est un Worker
écrit à la main, sans cadriciel, en mode JSON **sans état** (votre décision D3). `legislation`
s'appuie sur `McpAgent` et le SDK officiel, donc sur des sessions portées par un Durable
Object. Or la révision `2026-07-28` de la spécification MCP a supprimé les sessions de
protocole, l'en-tête `Mcp-Session-Id` et jusqu'à la poignée `initialize` : le protocole est
devenu sans état. Votre pari D3 est donc devenu la norme, et le modèle de `legislation` est
devenu l'héritage. L'uniformité que vous cherchez n'est pas un compromis à négocier entre les
deux dépôts : c'est la convergence de `legislation` vers ce que `jurisprudence` fait déjà,
plus la mise à niveau des deux vers `2026-07-28`.

**Deuxième.** L'exigence 1 (confidentialité) et l'exigence 3 (repérer l'abuseur) portent sur
les **mêmes lignes de journal**. On ne peut pas les servir toutes deux avec un seul journal :
il faut deux plans structurellement séparés — un plan technique qui porte le titulaire et
aucun contenu, un plan de contenu qui porte la forme de la requête et aucun titulaire. Cette
séparation doit être portée par les **types** et par un test de garde sur le schéma, non par
la vigilance. C'est le point de conception le plus important de tout le projet, et c'est celui
que vos **deux** `search_log` violent. Celle de `jurisprudence` consigne les chaînes de
citation soumises, qui pour `canlii_find_case` peuvent contenir des noms de parties. Celle de
`legislation` consigne en clair, à chaque appel, la requête de `qclaw_search_text` et de
`qclaw_find_relevant` — 1 887 lignes analysées au 2026-07-30. Les deux portent un horodatage
**à la seconde**, ce qui suffit à les rejoindre à un journal technique par titulaire : la
séparation des plans ne vaut que si le plan de contenu est aussi grossier dans le temps qu'il
est anonyme. Acceptable quand l'unique usager, c'est vous. Inacceptable dès qu'un confrère y
verse quoi que ce soit.

**Troisième.** Il n'existe **aucune interface machine** du Tableau de l'Ordre : ni interface de
programmation, ni flux de données. Le Tableau est public et se consulte à la main ; la
confirmation qui fait foi passe par le Registrariat, par téléphone ou par courriel. Votre choix
d'une revue humaine n'est donc pas un choix de prudence parmi d'autres : c'est la seule
vérification honnête disponible à l'échelle d'un cabinet. Cela plafonne mécaniquement la croissance du service, ce qui est
également sa meilleure protection contre l'abus.

---

## 2. Confidentialité : ce qui sort, et vers qui

L'inventaire compte davantage que les principes. Voici tout ce qui quitte votre
infrastructure, aujourd'hui, par requête.

| Destinataire | Ce qu'il voit | Sous quelle exigence | Réserve |
|---|---|---|---|
| Cloudflare (Workers, D1) | l'URL, les en-têtes, le corps JSON-RPC — donc les arguments d'outil | traitement de tout appel | hors Québec ; `observability: enabled` verse des traces |
| Cloudflare Workers AI | **le texte de la requête** de `qclaw_search_text` (vectorisation bge-m3) | `HYBRID_SEARCH` est **armé en production** depuis juillet 2026 | c'est la fuite la moins visible du lot |
| Cloudflare Vectorize | le **vecteur** de 1 024 dimensions et les filtres de métadonnées — pas le texte | idem | traitement distinct du précédent ; l'EFVP doit couvrir les deux |
| CanLII | l'identifiant demandé, et pour `canlii_find_case` **les noms de parties** | tout appel `canlii_*` non servi par le cache | sous la clef du licencié, ce qui change tout — voir §3 |
| Ministère de la Justice | rien | jamais | `greffe_*` et `palais_*` lisent des tables compilées |
| Vous, exploitant | ce que vos tables conservent | par construction | c'est le seul destinataire que vous pouvez réduire à volonté |

Trois observations.

**La donnée servie est publique ; la requête ne l'est pas.** Le corpus législatif est le texte
officiel, les fiches de CanLII sont des métadonnées publiques. Ce qui est confidentiel, c'est
**l'intérêt de recherche** : savoir qu'un avocat a cherché l'article 1457 C.c.Q. et le nom
d'une partie le même jour en dit long. Toute la conception de la confidentialité doit donc
porter sur la requête, sa conservation et sa corrélation — jamais sur la réponse.

**La recherche sémantique est le point aveugle.** `qclaw_search_text` en mode hybride envoie
la requête de l'usager à Workers AI pour vectorisation. C'est un traitement par un tiers
américain d'un texte possiblement identifiant, et il n'apparaît nulle part dans votre
`SECURITY.md`. Trois suites : le déclarer dans la fiche de conformité, confirmer par écrit la
politique de Cloudflare sur les entrées d'inférence, et rendre le mode hybride **désarmable
par titulaire** pour le confrère maximaliste.

**Vous êtes vous-même un risque de conflit.** Vous plaidez. Un confrère de la partie adverse
qui interroge votre connecteur révèle à un adversaire un intérêt de recherche. Aucune clause
ne répare cela : seule l'architecture le fait, en ne conservant rien qui puisse être lu.
L'atténuation est donc triple — ne rien conserver qui rattache un contenu à un titulaire, le
dire dans les conditions d'utilisation (le praticien doit savoir qui exploite le service, et
qu'il plaide), et vous abstenir de tout accès direct à la base autre que par les vues agrégées
prévues à cette fin.

**Loi 25.** L'ouverture vous fait passer de « je traite mes propres renseignements » à « je
détiens des renseignements de tiers pour le compte de confrères ». En découlent : la
désignation d'un responsable de la protection des renseignements personnels, une politique
publiée, un registre d'incidents, une politique de conservation et de destruction, et — parce
que Cloudflare traite hors Québec — une **évaluation des facteurs relatifs à la vie privée**
préalable à la communication, au sens de l'article 17 de la Loi sur la protection des
renseignements personnels dans le secteur privé. La Commission d'accès à l'information publie
un guide et un gabarit ; c'est un travail borné, mais il est préalable, non concomitant.

**Ce qu'un confrère devra pouvoir lire.** Votre confrère utilisateur a ses propres obligations
déontologiques quant au secret professionnel. Pour qu'il puisse s'en acquitter, il lui faut une
page de conformité qui énonce, sans marketing : les sous-traitants, la localisation des
données, la durée de conservation par table, le chiffrement, le processus d'incident, et ce que
vous, exploitant, pouvez techniquement lire. Cette page est un livrable, pas un ornement : sans
elle, un praticien prudent ne peut pas adopter le service.

---

## 3. La clef CanLII apportée par l'usager

Le motif habituel — protéger votre quota — est le moins intéressant. Le vrai gain est
juridique : **sous la clef du licencié, la requête part vers CanLII dans le cadre de la
relation contractuelle propre au confrère.** Vous n'êtes plus l'intermédiaire qui expose à un
tiers l'intérêt de recherche d'autrui ; vous êtes le mandataire technique de celui qui le fait
déjà. C'est une amélioration substantielle de la posture, et non un simple partage de coût.

**Où la clef ne doit jamais aller.** La révision `2026-07-28` introduit `x-mcp-header`, qui
permet à un serveur de désigner un **paramètre d'outil** à recopier dans un en-tête HTTP. La
tentation est immédiate et il faut y résister : un paramètre d'outil est rempli par le modèle,
il figure dans le contexte, dans l'historique de la conversation et dans les journaux du
client. Une clef d'API n'a rien à y faire. `x-mcp-header` est utile pour l'acheminement et la
limitation par locataire ; jamais pour un secret.

| Mécanisme | Clef au repos | Compatibilité | Verdict |
|---|---|---|---|
| Coffre côté serveur, chiffré, posé par une console web authentifiée | oui, chiffrée | tous les clients | **retenu** |
| En-tête dédié `X-Clef-CanLII` posé dans la configuration du client | aucune | Claude Code, clients maîtrisés ; pas le formulaire de connecteur claude.ai | **retenu en variante** |
| Paramètre d'outil + `x-mcp-header` | aucune | normalisé | **écarté** : la clef entre dans le contexte du modèle |
| Clef en paramètre de requête d'URL | aucune | tous | **écarté** : journaux, historiques de shell, capture d'écran |

Le coffre suppose que vous puissiez déchiffrer — sinon vous ne pourriez pas injecter la clef à
l'appel. Il faut le dire franchement dans les conditions d'utilisation plutôt que de le
maquiller. Ce que la conception peut garantir, en revanche : le chiffrement par enveloppe avec
une clef maîtresse qui ne vit pas dans la base, une donnée additionnelle authentifiée liée au
titulaire (une ligne recopiée sur un autre compte ne se déchiffre pas), et surtout une
**interface qui ne rend jamais la clef en clair** — la fonction d'ouverture rend un *client
CanLII*, pas une chaîne. Le texte clair n'existe alors nulle part comme valeur que le reste du
code pourrait tenir, journaliser ou renvoyer.

**Aucune retombée sur votre clef.** Un titulaire sans clef doit recevoir une erreur typée qui
l'oriente vers la console, jamais un service silencieux payé par votre quota. Corollaire :
votre propre compte devient un titulaire comme les autres, avec votre clef au coffre. C'est
l'uniformité au sens fort.

**Le cache est la vraie question à poser à CanLII.** Votre décision D6 fait sédimenter dans D1
tout balayage déjà effectué. En multilocataire, cela signifie que la clef du confrère A paie
une fiche que le confrère B lira gratuitement. La donnée est publique, donc il n'y a pas de
problème de confidentialité — mais il y a une question de licence, et la documentation de
l'API de CanLII n'en dit **rien du tout** : ni sur la transférabilité des clefs, ni sur la mise
en cache, ni sur les applications tierces. La seule voie propre est une détermination écrite,
demandée par le formulaire de commentaires, avant l'ouverture. En attendant, la conception
prudente scinde le cache : partagé pour le **répertoire des bases** (donnée de référence,
qu'aucune clef ne « possède »), cloisonné par titulaire et à durée bornée pour les **fiches de
décision**. Cela coûte des appels ; cela ne coûte pas une relation avec CanLII.

---

## 4. Repérer et contenir l'abus

**Le préalable est l'identité, pas la limitation.** Aujourd'hui, `legislation` accepte un
`MCP_TOKEN` unique et `jurisprudence` deux secrets aux droits identiques. Avec un secret
partagé, l'abus est indétectable par construction : il n'y a personne à distinguer. Tout le
reste découle du passage à un jeton **par titulaire**, révocable seul.

**Ne jamais limiter par adresse IP — et c'est déjà le cas.** Le limiteur de `jurisprudence`
est aujourd'hui clé sur `CF-Connecting-IP`, à 60 requêtes la minute. Or le client, c'est
claude.ai : l'adresse source est celle d'Anthropic. Cette configuration punit donc tous les
titulaires ensemble et n'attribue rien à personne. Ce n'est pas un risque à prévenir, c'est une
correction à faire.

Trois étages, du moins cher au plus fin.

| Étage | Mécanisme | Ce qu'il arrête | Coût |
|---|---|---|---|
| Débit | limiteur d'arête Cloudflare, clé = titulaire | la rafale, la boucle | quasi nul, avant toute lecture D1 |
| Quota | compteurs journaliers D1, par classe d'outil | l'usage industriel | une lecture indexée par appel |
| Comportement | score nocturne sur le plan technique | le moissonnage, le jeton partagé | une tâche planifiée |

Le troisième étage est le seul intéressant, et il doit fonctionner **sans contenu**. Se
calculent sur des compteurs et des formes, jamais sur des chaînes : la part d'échecs, la part
de « introuvable » (qui trahit l'énumération d'identifiants), la cardinalité d'identifiants
distincts par heure (qui trahit le moissonnage), la régularité des intervalles (qui trahit
l'automate), et — signal nouveau et précieux offert par `2026-07-28` — le nombre de
`clientInfo` distincts vus sur un même jeton, qui trahit un jeton partagé entre plusieurs
postes ou plusieurs personnes.

**Une ligne à ne pas franchir.** La dégradation automatique vers l'état « limité » est
acceptable : elle est réversible et son dommage est faible. La **suspension** et la
**révocation** d'un avocat, elles, doivent rester des décisions humaines, motivées, notifiées,
avec un droit de réponse et une voie de rétablissement écrite. Ce sont des professionnels ; une
coupure opaque en cours de mandat ne serait ni tenable, ni défendable. Le registre des
décisions est en ajout seul, avec code de motif et auteur.

**Le service est gratuit : il n'y a aucun frein économique à l'abus.** Les seuls freins sont
le quota, la révocation, et le fait que l'admission passe par vous. Cela vaut aussi dans
l'autre sens : un service gratuit crée une attente de disponibilité que vous n'avez pas
souscrite. Les conditions d'utilisation doivent l'écarter explicitement — aucune garantie de
disponibilité, aucun engagement de niveau de service, préavis de fermeture.

---

## 5. La donnée structurée

C'est l'exigence où le gain est le plus grand, et l'apparente contradiction avec votre
décision D4 (« sortie en texte français, pas en JSON ») se dissout complètement.

**D4 est amendée, non renversée.** Depuis `2025-06-18`, un outil peut rendre à la fois du
`content` textuel et un `structuredContent` validé contre un `outputSchema` publié. La
révision `2026-07-28` assouplit encore `outputSchema` à tout JSON Schema 2020-12 et
`structuredContent` à toute valeur JSON. Il n'y a donc plus à choisir : la prose française
sert le modèle et porte la mise en garde là où elle se lit, la donnée structurée sert le
logiciel tiers. `legislation` en fait déjà la moitié — ses évaluations lisent
`structuredContent.results` et `structuredContent.count` — et `jurisprudence` n'en fait rien.
Généraliser est une mise à niveau, pas un virage.

Cinq exigences font la différence entre « du JSON » et « une donnée réellement exploitable ».

**Des identifiants stables et déréférençables.** `urn:lex` n'a jamais été enregistré comme
espace de noms URN auprès de l'IANA — c'est resté un projet individuel de l'IETF, expiré — et
ELI est européen. La bonne réponse est donc de frapper vos identifiants
sous votre domaine, sur le patron **FRBR d'Akoma Ntoso** (norme OASIS LegalDocML), qui est
exactement la structure que votre corpus possède déjà sans la nommer : l'œuvre (« C.c.Q. »),
l'expression (« français, à jour au 2026-04-01 »), la manifestation (l'EPUB de LégisQuébec).
Votre sortie affiche déjà « (à jour au 2026-04-01) » : c'est une expression FRBR, il ne reste
qu'à la rendre adressable. Et déréférençable veut dire ce qu'il dit : `GET` sur l'identifiant
rend du HTML pour l'humain, du JSON-LD pour la machine, de l'Akoma Ntoso pour l'outil
juridique.

**Ne pas frapper d'identifiant sur la donnée d'autrui.** Pour la jurisprudence, les
identifiants de CanLII (`databaseId`, `caseId`, citation neutre) sont ceux qui font autorité.
Les reprendre tels quels, y adjoindre une citation normalisée au *Manuel canadien de la
référence juridique* et l'URL CanLII. Ne frapper des identifiants propres que sur ce dont vous
êtes la source : vos tables de greffes et de palais.

**De la provenance sur chaque réponse.** Autorité, version du corpus, date de relevé, et si la
réponse vient du cache, laquelle et depuis quand. Sans cela, une sortie n'est pas citable — et
dans un outil juridique, une sortie non citable ne vaut rien.

**Des mises en garde lisibles par machine.** Vos réserves sont aujourd'hui de la prose dans le
texte : « une absence n'est jamais une preuve d'inexistence », « le repérage est heuristique »,
« ces adresses vieillissent ». Un tiers ne peut ni les faire respecter, ni les afficher, ni les
tester. Promues en tableau typé — code, sévérité, texte — elles deviennent opposables.
Deux d'entre elles méritent d'exister pour elles-mêmes : `LANGUE_DISCORDANTE`, quand une
requête française est soumise sous `lang=en` ou l'inverse — le correctif de repérage est livré,
la **garde** émise ne l'est pas — et `REPERAGE_HEURISTIQUE`, qui est la seule réserve honnête
tant que les fichiers de curation (`gazetteer.json`, `division-links.json`) restent
`validated: false`. L'affaire de l'article 490 C.p.c. est réglée côté repérage : ne pas la
rouvrir sous un code de langue.

**Un contrat qu'un tiers peut éprouver seul.** Un contexte JSON-LD servi à une URL stable, le
paquet de schémas publié, les descripteurs d'outils rendus dans un ordre déterministe (que
`2026-07-28` recommande pour la mise en cache côté client), les indices `ttlMs` et
`cacheScope`, et des fixtures de référence versées au dépôt. Votre discipline actuelle — la
page publique **dérive** du registre, les tables de schémas sont générées depuis le schéma que
le validateur applique — est exactement la bonne et doit s'étendre à la documentation de
gouverne : quotas, durées de conservation et codes de mise en garde publiés depuis le code, non
recopiés à côté.

---

## 6. Uniformité : où mettre le code commun

| Voie | Pour | Contre |
|---|---|---|
| Monodépôt (pnpm workspaces) | uniformité mécanique, un seul lot de tests | migre deux dépôts établis, casse la synchronisation du projet, refonte de la CI |
| **Troisième dépôt, paquet versionné** | frontière nette, versions épinglées, dépôts intacts | une étape de publication, une version à faire progresser |
| Sous-module git | aucun registre | pénible avec GitHub Desktop, que vous employez |

**Retenu : un troisième dépôt `MCP-Socle-Juridique`, consommé comme dépendance de
développement et empaqueté au déploiement.** Cela préserve votre décision D2 — zéro dépendance
d'exécution — au sens qui compte : le code du socle est du code à vous, versionné et signé, non
une surface Dependabot. Le socle porte le protocole, l'identité, la gouverne, le journal, la
sortie structurée et la page publique. Ce qu'il ne porte jamais : la connaissance du domaine.
L'analyseur de citations, les tables du Québec, le pipeline EPUB restent chez eux.

---

## 7. Réserves et déterminations préalables

Ces sept points conditionnent l'**ouverture**, non tout le chantier : les phases 1 et 5 du
tableau de la §8 améliorent les connecteurs pour votre seul usage et ne dépendent de rien. Les
trois premiers points sont bloquants pour tout le reste.

1. **CanLII, par écrit.** La documentation de l'API ne dit rien sur la transférabilité des
   clefs, la mise en cache, ni les applications tierces ; les conditions d'utilisation du site
   sont fermées au moissonnage automatisé et doivent être lues à la main. Trois questions à
   poser ensemble : un tiers peut-il opérer un service appelant l'API sous la clef d'un
   licencié ? un cache de métadonnées est-il admis ? peut-il être partagé entre licenciés ?
   Ces trois questions sont **neuves** et ne sont consignées nulle part : ne pas les confondre
   avec le §16.1 de `SPEC_CANLII_MCP.md`, qui portait sur le moissonnage de masse et que vous
   avez **tranché par la négative le 2026-07-23** — cette décision reste fermée, et le
   drapeau `BACKFILL_ENABLED` reste à `false`. La seule détermination encore ouverte, le
   §16.2, porte sur le quota et le débit : elle est adjacente, pas identique.
2. **Évaluation des facteurs relatifs à la vie privée.** Préalable à la communication hors
   Québec. Doit couvrir Cloudflare Workers, D1, et — point le plus facile à oublier — Workers
   AI et Vectorize pour la recherche sémantique.
3. **Véhicule et assurance.** La police du Fonds d'assurance du Barreau couvre l'exercice de la
   profession ; exploiter un service logiciel au profit de confrères n'en relève probablement
   pas. À valider auprès du Fonds, et à doubler d'une entité distincte, de conditions
   d'utilisation avec exclusion de garantie et limitation de responsabilité, et d'une
   couverture commerciale.
4. **OAuth 2.1 : mesurer avant de bâtir, et corriger une croyance.** La spécification exige,
   pour un serveur authentifié, les métadonnées de ressource protégée et un `401` porteur de
   `WWW-Authenticate`. Votre `legislation` refuse délibérément en `404`. Attention au motif :
   les dépôts n'enregistrent **aucune** mesure d'un `401` ayant déclenché une découverte OAuth.
   Ce qu'ils enregistrent est l'inverse — ce sont deux **`404`** qui ont poussé le connecteur
   dans cette découverte, le 2026-07-23 (slash final) et le 2026-07-25 (fenêtre de bascule), et
   la seconde fois irréversiblement. Un client MCP lit un `404` comme « ce serveur exige une
   authentification », pas comme « rien ici ». Le `404` conserve donc son mérite propre — ne pas
   servir d'oracle sur l'existence d'un compte — mais il **n'immunise pas** contre la découverte
   OAuth, et l'argument qui le présentait ainsi était une inférence, non un fait. Reste que
   l'enregistrement dynamique de clients vient d'être **déprécié** au profit des *Client ID
   Metadata Documents* : bâtir aujourd'hui un serveur d'autorisation sur cette pièce serait
   bâtir sur du sortant. Conclusion inchangée mais mieux fondée : jetons opaques par titulaire
   maintenant, OAuth en phase ultérieure, conditionnée à une mesure réelle avec le formulaire
   de connecteur.
5. **Les porteurs de jeton sont un fait de production, pas une préférence.** `?key=` est la
   seule forme qui a survécu au formulaire du connecteur claude.ai en juillet 2026. À
   re-mesurer avant l'ouverture — le formulaire a pu évoluer — mais jamais à présumer.
6. **Le sort des deux `search_log` existantes.** Celle de `jurisprudence` contient vos chaînes
   de citation, noms de parties compris ; celle de `legislation` contient le texte de vos
   requêtes de recherche, horodaté à la seconde. À décider avant l'ouverture, pour chacune :
   purge, ou conservation comme plan privé qui n'accepte plus rien d'un tiers. Ne pas laisser
   la question se régler par défaut.
7. **Ce que l'ouverture vous coûte en temps.** Un service gratuit à des confrères engendre des
   demandes d'admission à traiter, des clefs CanLII à dépanner, des questions, et l'attente
   implicite d'une continuité. Le plafonnement par cooptation et une file d'admission traitée
   par lots hebdomadaires sont des mesures de conception, pas de la mauvaise volonté.

---

## 8. Ce que je propose de construire

Le détail est dans `SPEC-SOCLE-COMMUN.md`, destiné à Claude Code. En résumé :

| Phase | Contenu | Bloquée par |
|---|---|---|
| 0 | Déterminations de la §7 | vous, et des tiers |
| 1 | Socle : protocole `2026-07-28` sans état, sortie double, `legislation` hors `McpAgent` | rien |
| 2 | Identité par titulaire, jetons, coffre CanLII, consoles | phase 1 |
| 3 | Gouverne : débit, quotas, score, états, registre | phase 2 |
| 4 | Journal en deux plans, purges, tests de garde | phase 2, donc phase 0 |
| 5 | Données structurées : identifiants FRBR, `/id/`, JSON-LD, Akoma Ntoso, ressources MCP | phase 1 |
| 6 | Ouverture graduée : cinq confrères, observation, puis file d'admission | 0 à 5 |

**Règle de blocage, énoncée ici et nulle part ailleurs.** Les phases 1 et 5 sont livrables sans
les déterminations de la §7. Les phases 2, 3, 4 et 6 en dépendent — la phase 4 indirectement,
parce que le plan technique du journal est clé sur le titulaire, qui n'existe qu'en phase 2.

Aucune phase n'est *entièrement* délégable, mais l'essentiel du code des phases 1, 4 et 5 l'est.
Ce qui reste vôtre : arbitrer le refus en `404` contre le `401` normalisé (phase 1) ; les cinq
textes publics (phase 2) ; les seuils et la voie de rétablissement (phase 3) ; le sort des deux
`search_log` (phase 4) ; la validation des identifiants et de la citation normalisée (phase 5) ;
et la totalité de la phase 0.
