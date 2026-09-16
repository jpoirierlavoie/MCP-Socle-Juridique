# Procédures manuelles — ce que Claude Code ne peut pas faire

Ce document ne contient aucun secret. Il rassemble les gestes de la phase 1 qui exigent
soit une clef Cloudflare, soit l'interface de claude.ai, soit une décision sur le service
en production — donc vous.

Chaque section dit **pourquoi** le geste existe, ce qu'on attend de sa sortie, et quoi
faire si elle surprend. Un geste dont on ne sait pas lire le résultat ne protège de rien.

---

## A. L'ancre de retour — AVANT toute bascule d'authentification

**Pourquoi.** Vous avez arrêté le refus en `404` partout (S8). Or deux fenêtres de `404`
ont déjà poussé le connecteur claude.ai dans une découverte OAuth, le 2026-07-23 et le
2026-07-25 — la seconde fois **irréversiblement** : l'inscription à demi créée n'était plus
ni modifiable, ni déplaçable, ni supprimable depuis l'interface. Le seul déblocage avait
été `wrangler secret delete MCP_TOKEN`, qui rouvrait le point d'entrée.

**Ce remède n'existe plus.** Depuis le passage au fermé-par-défaut (2026-08-27), retirer
les secrets ne rouvre rien : la liste vide refuse tout. Il ne reste que le retour à une
version antérieure, et il faut l'avoir **répété** avant d'en avoir besoin.

### A.1 — S'authentifier

```bash
cd ~/MCP-Legislation-Quebec
export CLOUDFLARE_API_TOKEN="$(cat cf.token)"
```

> Le jeton reste dans la variable d'environnement du shell, jamais dans une commande
> versionnée. Fermer ce terminal l'efface.

### A.2 — Relever la version connue-bonne

```bash
npx wrangler versions list
```

**Attendu** : les dix versions les plus récentes. Repérer celle qui tourne aujourd'hui et
qu'on sait saine. **Noter son identifiant intégralement** (UUID).

```bash
npx wrangler versions view <version-id>
```

Confirme la date, l'auteur et le message. Vérifier que c'est bien la version que sert
`legislation.poirierlavoie.ca` en ce moment.

### A.3 — Répéter le retour, pour de vrai

Une répétition qui ne déploie rien ne prouve rien. Ce geste **change la production**
quelques minutes. Le faire à une heure creuse.

```bash
# 1. Constater l'état courant
curl -s -o /dev/null -w "%{http_code}\n" "https://legislation.poirierlavoie.ca/"

# 2. Revenir à la version notée
npx wrangler rollback <version-id> -m "répétition de la voie de retour (marche 0.1)"

# 3. Vérifier que le connecteur répond TOUJOURS
curl -s -o /dev/null -w "%{http_code}\n" "https://legislation.poirierlavoie.ca/"
#    attendu : 200

# 4. Revenir à la version courante
npx wrangler rollback <version-id-courante> -m "fin de répétition"
```

**Ce qu'on cherche à mesurer** : combien de temps sépare la commande du service rétabli.
C'est ce chiffre qui décide si le `404` partout est tenable. Le consigner.

**Si `wrangler rollback` refuse** avec un message mentionnant un changement de cycle de
vie d'un Durable Object : c'est le cas décrit en §3.2 du plan. Il ne doit PAS se produire
avant la marche 5 — si vous le voyez maintenant, arrêtez et dites-le-moi.

### A.4 — Consigner

Dans `MCP-Legislation-Quebec/CLAUDE.md`, remplacer la recette périmée par : l'identifiant
de la version connue-bonne, la date de la répétition, le délai mesuré, et la mention que
**cette ancre périme à la marche 5** (le retrait du Durable Object interdit tout retour
en deçà).

---

## B. L'état réel du connecteur `jurisprudence`

**Pourquoi.** C'est le renseignement le moins cher et le plus utile de toute la phase 1.
Si aucun connecteur claude.ai ne pointe sur `jurisprudence`, son passage de `401` à `404`
ne risque rien, et la prudence de la section A ne concerne plus que `legislation`.

Ce que je sais déjà, et qui ne suffit pas : `jurisprudence` n'apparaît pas parmi les
connecteurs exposés à ma session, et il ne sert **pas** la forme `?key=` — la seule qui
ait survécu au formulaire de connecteur en juillet 2026. Cela rend improbable qu'il y soit
inscrit, sans le prouver.

**Le geste.** Dans claude.ai → Réglages → Connecteurs, relever :

1. `jurisprudence.poirierlavoie.ca` y figure-t-il ?
2. Si oui, sous quelle forme d'URL exactement (segment de chemin, `Bearer`, `?key=`) ?
3. Depuis quand, et est-il réellement appelé ?

**Ce que la réponse décide.** Absent ⇒ la marche 3 peut basculer `jurisprudence` en `404`
sans précaution particulière. Présent ⇒ il lui faut la même ancre de retour que
`legislation`, à établir avant la bascule.

---

## C. Les deux compétences claude.ai — après tout changement d'outil

**Pourquoi, et c'est la surface la plus fragile du dispositif.** Le couplage qui vivait
dans `athena/chat/worker_tools.py` n'a pas disparu : il a changé de support. Il vit
maintenant dans les **compétences claude.ai** `competences-juridiques-pallas-athena/`
(recherche et rédaction), qui nomment les outils **à la main** — 25 appels sur 6 fichiers,
relevés le 2026-09-16.

**Rien ne les engendre, donc rien ne peut les réparer.** Aucune commande d'aucun des trois
dépôts ne voit ces fichiers dériver. L'échec n'apparaît qu'au prochain appel, sous la forme
d'un « Outil inconnu » que l'usager lit comme une panne du connecteur.

**Quand agir** : après tout ajout, retrait ou renommage d'outil — donc après le renommage
en cours, et de nouveau si la marche 3 réordonne ou si la marche 4 change la forme des
sorties.

**Le geste** : corriger les appels à la main dans les deux compétences, puis les
téléverser dans claude.ai. Vérifier ensuite par un appel réel de chaque compétence.

> Si vous me donnez le chemin local de ces compétences, je peux faire le relevé des appels
> et préparer les corrections — le téléversement, lui, reste vôtre.

---

## D. Retirer les secrets d'Athéna — possible, et désormais inutile

**Pourquoi.** Vérifié ce jour : le dépôt `Pallas-Athena` ne contient **plus aucune**
référence aux deux connecteurs — ni nom d'hôte, ni préfixe d'outil, ni `MCP_TOKEN`, ni
`MCP_SHARED_SECRET`. Le clavardage a été retiré en entier le 2026-09-02.

`MCP_TOKEN_ATHENA` (legislation) et `MCP_SHARED_SECRET_ATHENA` (jurisprudence) sont donc
des porteurs valides **sans appelant**. Un identifiant vivant que personne n'utilise est
une surface, pas un filet.

**Pourquoi c'est sûr ici**, contrairement à l'intuition : les deux dépôts sont
fermés-par-défaut et acceptent une LISTE de secrets. En retirer un laisse l'autre servir.
Ce n'est vrai que parce qu'il en reste un — ne jamais retirer le dernier.

```bash
cd ~/MCP-Legislation-Quebec
export CLOUDFLARE_API_TOKEN="$(cat cf.token)"

# 1. Constater ce qui est posé
npx wrangler secret list
#    attendu : MCP_TOKEN et MCP_TOKEN_ATHENA

# 2. Vérifier que le connecteur vit sur l'AUTRE secret, AVANT de retirer
#    (un appel réel depuis claude.ai, pas un curl)

# 3. Retirer
npx wrangler secret delete MCP_TOKEN_ATHENA

# 4. Re-vérifier le connecteur immédiatement
```

Même séquence pour `MCP_SHARED_SECRET_ATHENA` dans `MCP-Jurisprudence-Quebec`.

**À ne pas faire** : retirer les deux, ou retirer avant d'avoir confirmé que le connecteur
passe par celui qui reste. On retomberait sur l'incident du 2026-07-25, sans son remède.

---

## E. La règle de bascule, à appliquer à chaque marche

Elle a été payée cher, et elle tient en une phrase : **poser l'URL du connecteur avant
d'armer le contrôle correspondant.**

La forme d'URL retenue doit répondre `200` **avec et sans** le nouveau contrôle. C'est
contre-intuitif et c'est exactement le point : tant que les deux régimes répondent `200`,
le connecteur ne voit jamais de `404` pendant la fenêtre de bascule. L'ordre inverse a
détruit un connecteur le 2026-07-25.

Avant chaque déploiement de la phase 1 :

```bash
# la forme réellement servie doit répondre 200 AVANT la bascule
curl -s -o /dev/null -w "%{http_code}\n" "https://legislation.poirierlavoie.ca/mcp?key=<jeton>"
```

Et après : un appel réel depuis claude.ai, pas un `curl`. Seul un vrai client exerce la
négociation de version et la découverte.

---

## Ce que je peux faire, moi, quand vous aurez ces réponses

- Section A : consigner l'ancre et le délai mesuré dans `CLAUDE.md`, et inscrire sa
  péremption à la marche 5.
- Section B : adapter la marche 3 selon que `jurisprudence` est câblé ou non.
- Section C : relever les 25 appels et préparer les corrections, si vous m'indiquez le
  chemin des compétences.
- Section D : rien — c'est un geste de production de bout en bout.
