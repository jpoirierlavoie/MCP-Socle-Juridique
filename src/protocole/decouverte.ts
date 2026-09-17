/**
 * `server/discover` — obligatoire sous `2026-07-28`.
 *
 * C'est ce qui remplace la poignée : un client apprend en UN appel les versions servies,
 * les capacités et l'identité du serveur, sans créer de session. C'est aussi la sonde de
 * compatibilité — il peut l'appeler avant tout le reste.
 *
 * L'appeler reste FACULTATIF pour le client : il peut envoyer n'importe quelle requête et
 * traiter l'erreur de version si elle vient. Le servir, en revanche, est obligatoire.
 */

import { avecCache, avecServerInfo, complet, type PorteeCache } from "./meta";

export interface IdentiteServeur {
  name: string;
  version: string;
}

export interface OptionsDecouverte {
  supportedVersions: readonly string[];
  capabilities: Record<string, unknown>;
  serverInfo: IdentiteServeur;
  instructions?: string;
  /** Une heure par défaut : l'identité et les capacités ne bougent qu'au déploiement. */
  ttlMs?: number;
  cacheScope?: PorteeCache;
}

/**
 * Construit le résultat de `server/discover`.
 *
 * ⚠ `serverInfo` VOYAGE DANS `_meta`, et non à la racine du résultat. C'est l'erreur facile,
 *   parce que la poignée `initialize` le mettait, elle, à la racine.
 *
 * ⚠ NE PAS DÉCLARER `listChanged: true` dans les capacités tant que `subscriptions/listen`
 *   n'est pas servi : sous cette révision, c'est le SEUL véhicule des notifications de
 *   changement. Déclarer la capacité sans le canal, c'est promettre un signal qui ne
 *   viendra jamais.
 */
export function resultatDecouverte(o: OptionsDecouverte): Record<string, unknown> {
  const base: Record<string, unknown> = {
    supportedVersions: [...o.supportedVersions],
    capabilities: o.capabilities,
  };
  if (o.instructions !== undefined) base.instructions = o.instructions;

  return avecCache(
    avecServerInfo(complet(base), o.serverInfo),
    o.ttlMs ?? 3_600_000,
    o.cacheScope ?? "public",
  );
}
