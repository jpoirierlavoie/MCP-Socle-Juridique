# `identite/`

| Fichier | Marche / phase | Contenu |
|---|---|---|
| `porteur.ts` | 1 | extraction du jeton : `Bearer`, `?key=`, segment de chemin. **`queryKey` est OPTIONNEL** : absent, il n'y a pas de porteur `?key=`. ⚠ Corrigé le 2026-09-18 — cette case disait que `jurisprudence` n'avait pas cette surface. Il la SERT depuis le 2026-09-17 (S7 : seule forme qui survive au formulaire de claude.ai). Le champ reste optionnel pour que l'ouvrir soit un geste écrit dans le dépôt qui l'ouvre, jamais un héritage |
| `refus.ts` | 1 | `404` sans oracle (S8) ; bascule `401` + métadonnées de ressource protégée derrière un drapeau |
| `titulaire.ts` | phase 2 | résolution jeton → `Titulaire`, à temps constant |

**Fermé par défaut, sans exception.** Aucune configuration ne doit ouvrir le point
d'entrée : ni l'absence de secret, ni une table vide, ni une erreur de lecture.
