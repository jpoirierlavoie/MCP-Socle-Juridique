# `identite/`

| Fichier | Marche / phase | Contenu |
|---|---|---|
| `porteur.ts` | 1 | extraction du jeton : `Bearer`, `?key=`, segment de chemin. **`queryKey` est OPTIONNEL** : absent, il n'y a pas de porteur `?key=`. Sans cette précaution, monter le code de `legislation` donnerait à `jurisprudence` une surface d'accès qu'il n'a pas aujourd'hui |
| `refus.ts` | 1 | `404` sans oracle (S8) ; bascule `401` + métadonnées de ressource protégée derrière un drapeau |
| `titulaire.ts` | phase 2 | résolution jeton → `Titulaire`, à temps constant |

**Fermé par défaut, sans exception.** Aucune configuration ne doit ouvrir le point
d'entrée : ni l'absence de secret, ni une table vide, ni une erreur de lecture.
