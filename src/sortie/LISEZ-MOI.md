# `sortie/`

| Fichier | Marche / phase | Contenu |
|---|---|---|
| `enveloppe.ts` | 4 | `Enveloppe<T>` : `@context`, `@type`, `@id`, `donnees`, `provenance`, `gardes` |
| `gardes.ts` | 4 | registre des quatorze codes de mise en garde (SPEC §8.4) |
| `frbr.ts` | phase 5 | frappe et analyse des identifiants, patron FRBR d'Akoma Ntoso |
| `jsonld.ts` | phase 5 | contexte servi, cadrage |

**La prose reste la prose.** Ne pas rendre du JSON dans `content`, ne pas dupliquer la
prose dans `structuredContent`. La mise en garde se **lit** dans la prose ; elle
s'**applique** depuis `gardes`.

`gardes` non vide est une **obligation de compilation** dès qu'une réserve s'applique, en
trois couches : champ requis sur le descripteur (avec sentinelle `AUCUNE_RESERVE`
greppable), fusion par le constructeur d'enveloppe plutôt que par le gestionnaire, et
`minItems: 1` dans chaque `outputSchema` pour que la porte G5 l'attrape sur le fil.
