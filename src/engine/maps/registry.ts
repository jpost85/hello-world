/**
 * Map registry.
 *
 * The default map is statically imported (bundled in the main chunk for instant
 * boot); every other map is loaded on demand via a dynamic `import()`, which
 * Vite code-splits into its own chunk. This keeps the initial download roughly
 * constant no matter how many maps we add — only the map you actually play is
 * fetched. (The single-file build inlines all of them so it still runs offline.)
 */

import type { GameMap } from "../types.ts";
import { worldMap } from "./worldMap.ts";

export interface MapInfo {
  id: string;
  name: string;
  description: string;
  /** Resolves the full map data — lazily for non-default maps. */
  load: () => Promise<GameMap>;
}

export const MAP_REGISTRY: MapInfo[] = [
  {
    id: "world",
    name: "World",
    description: "55 real-world territories across 9 continents.",
    load: async () => worldMap,
  },
  {
    id: "classic",
    name: "Classic (abstract)",
    description: "The traditional 42-territory board.",
    load: () => import("./classicWorld.ts").then((m) => m.classicWorld),
  },
  {
    id: "caribbean",
    name: "Caribbean",
    description: "Napoleonic-era island theatre — 16 territories, naval routes.",
    load: () => import("./caribbean.ts").then((m) => m.caribbeanMap),
  },
  {
    id: "napoleon",
    name: "Napoleonic Europe",
    description: "Europe c.1812 — 24 territories, era states from France to Russia.",
    load: () => import("./napoleon.ts").then((m) => m.napoleonMap),
  },
];

export const DEFAULT_MAP_ID = "world";

export function mapInfo(id: string): MapInfo {
  return MAP_REGISTRY.find((m) => m.id === id) ?? MAP_REGISTRY[0];
}
