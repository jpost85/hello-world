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
  /** Era roster (great-power faction ids); omitted maps use generic factions. */
  factionIds?: string[];
  /** Optional fixed historical starts: territory id -> faction id. */
  startPositions?: Record<string, string>;
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
    description: "Napoleonic-era island theatre — 21 territories, naval routes.",
    factionIds: ["britain", "france", "spain", "netherlands", "portugal"],
    startPositions: {
      cuba: "spain",
      "puerto-rico": "spain",
      "dominican-republic": "spain",
      florida: "spain",
      jamaica: "britain",
      bahamas: "britain",
      belize: "britain",
      barbados: "britain",
      "mosquito-coast": "britain",
      haiti: "france",
      "leeward-islands": "netherlands",
    },
    load: () => import("./caribbean.ts").then((m) => m.caribbeanMap),
  },
  {
    id: "napoleon",
    name: "Napoleonic Europe",
    description: "Europe c.1812 — 24 territories, era states from France to Russia.",
    factionIds: ["france", "britain", "russia", "austria", "prussia", "ottoman"],
    load: () => import("./napoleon.ts").then((m) => m.napoleonMap),
  },
  {
    id: "africa-scramble",
    name: "Scramble for Africa",
    description: "The colonial partition of Africa — 25 territories.",
    factionIds: ["britain", "france", "germany", "italy", "portugal", "belgium", "ethiopia", "boers", "egypt"],
    load: () => import("./africaScramble.ts").then((m) => m.africaMap),
  },
  {
    id: "near-east",
    name: "Egypt & the Near East",
    description: "Napoleon's Egyptian campaign & the Ottoman Near East — 26 territories.",
    factionIds: ["france", "ottoman", "britain", "mamluks", "persia", "russia"],
    startPositions: {
      alexandria: "france",
      malta: "britain",
      aden: "britain",
      acre: "ottoman",
      cyprus: "ottoman",
      "western-anatolia": "ottoman",
      "central-anatolia": "ottoman",
      "eastern-anatolia": "ottoman",
      syria: "ottoman",
      palestine: "ottoman",
      "egypt-nile": "mamluks",
      "egypt-east": "mamluks",
      "egypt-west": "mamluks",
      "western-persia": "persia",
      "central-persia": "persia",
      "eastern-persia": "persia",
      caucasus: "russia",
    },
    load: () => import("./nearEast.ts").then((m) => m.nearEastMap),
  },
  {
    id: "crimea",
    name: "Crimean War",
    description: "The Black Sea littoral, 1853-56 — 14 territories.",
    factionIds: ["russia", "ottoman", "britain", "france", "sardinia", "austria"],
    startPositions: {
      crimea: "russia",
      don: "russia",
      ukraine: "russia",
      georgia: "russia",
      armenia: "russia",
      anatolia: "ottoman",
      "eastern-anatolia": "ottoman",
      thrace: "ottoman",
    },
    load: () => import("./crimea.ts").then((m) => m.crimeaMap),
  },
  {
    id: "india",
    name: "Indian Subcontinent",
    description: "Historical regions + European trading posts — 22 territories.",
    factionIds: ["britain", "maratha", "mysore", "sikh", "mughal", "france", "portugal", "netherlands", "denmark"],
    startPositions: {
      calcutta: "britain",
      bombay: "britain",
      madras: "britain",
      goa: "portugal",
      pondicherry: "france",
      cochin: "netherlands",
      tranquebar: "denmark",
    },
    load: () => import("./indiaSubcontinent.ts").then((m) => m.indiaMap),
  },
];

export const DEFAULT_MAP_ID = "world";

export function mapInfo(id: string): MapInfo {
  return MAP_REGISTRY.find((m) => m.id === id) ?? MAP_REGISTRY[0];
}
