// Socle commun des connecteurs juridiques — surface publique.
//
// RIEN D'EXÉCUTABLE ICI : uniquement des réexports. Le socle est consommé comme dépendance
// de DÉVELOPPEMENT et empaqueté par esbuild au déploiement (S2), ce qui préserve la
// décision D2 — zéro dépendance d'exécution — au sens qui compte : du code à soi, versionné
// et signé, et non une surface Dependabot.
//
// CE QUE LE SOCLE NE PORTE JAMAIS : l'analyseur de citations, les tables du Québec, le
// pipeline EPUB, les descripteurs d'outils, `INSTRUCTIONS`, `SERVER_INFO`, `callTool`, les
// gabarits de rendu du domaine. Le socle ne connaît pas le droit. S'il faut y écrire le mot
// « article », c'est qu'on s'est trompé de dépôt.

export {
  apparie,
  bearerOf,
  decodeOrNull,
  empreinte,
  frapperJeton,
  LONGUEUR_JETON,
  memeSecret,
  ouvrir,
  type Porte,
  porteursPresentes,
  secretsAdmis,
  trimTrailingSlash,
} from "./identite/porteur";
export {
  type Annotations,
  listToolDescriptors,
  type Registre,
  type ToolDescriptor,
  type ToolHandler,
} from "./protocole/registre";
export {
  err,
  errorResponse,
  INTERNAL_ERROR,
  INVALID_PARAMS,
  INVALID_REQUEST,
  isNotification,
  JsonRpcError,
  type JsonRpcMessage,
  METHOD_NOT_FOUND,
  ok,
  PARSE_ERROR,
  parseMessage,
  type RequestId,
  resultResponse,
  type ToolResult,
} from "./protocole/rpc";
export { type JsonSchema, TYPES_CONNUS, validateArgs } from "./protocole/valide";
