// Socle commun des connecteurs juridiques — surface publique.
//
// RIEN D'EXÉCUTABLE ICI : uniquement des réexports. Le socle est consommé comme
// dépendance de DÉVELOPPEMENT et empaqueté par esbuild au déploiement (S2), ce qui
// préserve la décision D2 — zéro dépendance d'exécution — au sens qui compte : du code
// à soi, versionné et signé, et non une surface Dependabot.
//
// CE QUE LE SOCLE NE PORTE JAMAIS : l'analyseur de citations, les tables du Québec, le
// pipeline EPUB, les descripteurs d'outils, `INSTRUCTIONS`, `SERVER_INFO`, `callTool`,
// les gabarits de rendu du domaine. Le socle ne connaît pas le droit. S'il faut y écrire
// le mot « article », c'est qu'on s'est trompé de dépôt.
//
// Les réexports apparaissent à mesure que les marches de la phase 1 les remplissent ;
// `export {}` tient la place pour que le module reste un module ES valide entre-temps.

export {};
