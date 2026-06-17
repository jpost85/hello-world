/**
 * Map registry. Mirrors the Dominion branch's lazy-loading registry so adding a
 * theatre is a data change. With one map today the import is static; switch to a
 * dynamic `import()` per entry when a second map lands, to code-split it.
 */
import type { GameMap } from "../types.ts";
import { chinaMap } from "./china.ts";

export interface MapEntry {
  id: string;
  name: string;
  load: () => Promise<GameMap>;
}

export const MAP_REGISTRY: MapEntry[] = [
  { id: chinaMap.id, name: chinaMap.name, load: async () => chinaMap },
];

export function getMapById(id: string): MapEntry | undefined {
  return MAP_REGISTRY.find((m) => m.id === id);
}
