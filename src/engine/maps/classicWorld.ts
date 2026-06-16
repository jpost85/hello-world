/**
 * The classic 42-territory, 6-continent world map.
 *
 * Adjacency is authored once per territory; a unit test asserts it is fully
 * symmetric (if A borders B then B borders A). Positions are normalised to
 * [0, 1] for resolution-independent rendering.
 */

import type { GameMap, Region, Territory } from "../types.ts";

interface RawTerritory {
  id: string;
  name: string;
  region: string;
  pos: [number, number];
  adj: string[];
}

const RAW: RawTerritory[] = [
  // --- North America ---
  { id: "alaska", name: "Alaska", region: "north-america", pos: [0.06, 0.12], adj: ["northwest-territory", "alberta", "kamchatka"] },
  { id: "northwest-territory", name: "Northwest Territory", region: "north-america", pos: [0.15, 0.12], adj: ["alaska", "alberta", "ontario", "greenland"] },
  { id: "greenland", name: "Greenland", region: "north-america", pos: [0.28, 0.07], adj: ["northwest-territory", "ontario", "quebec", "iceland"] },
  { id: "alberta", name: "Alberta", region: "north-america", pos: [0.13, 0.21], adj: ["alaska", "northwest-territory", "ontario", "western-us"] },
  { id: "ontario", name: "Ontario", region: "north-america", pos: [0.2, 0.22], adj: ["alberta", "northwest-territory", "greenland", "quebec", "western-us", "eastern-us"] },
  { id: "quebec", name: "Quebec", region: "north-america", pos: [0.27, 0.22], adj: ["greenland", "ontario", "eastern-us"] },
  { id: "western-us", name: "Western United States", region: "north-america", pos: [0.14, 0.31], adj: ["alberta", "ontario", "eastern-us", "central-america"] },
  { id: "eastern-us", name: "Eastern United States", region: "north-america", pos: [0.21, 0.32], adj: ["ontario", "quebec", "western-us", "central-america"] },
  { id: "central-america", name: "Central America", region: "north-america", pos: [0.16, 0.41], adj: ["western-us", "eastern-us", "venezuela"] },

  // --- South America ---
  { id: "venezuela", name: "Venezuela", region: "south-america", pos: [0.22, 0.5], adj: ["central-america", "brazil", "peru"] },
  { id: "peru", name: "Peru", region: "south-america", pos: [0.22, 0.62], adj: ["venezuela", "brazil", "argentina"] },
  { id: "brazil", name: "Brazil", region: "south-america", pos: [0.3, 0.6], adj: ["venezuela", "peru", "argentina", "north-africa"] },
  { id: "argentina", name: "Argentina", region: "south-america", pos: [0.23, 0.74], adj: ["peru", "brazil"] },

  // --- Europe ---
  { id: "iceland", name: "Iceland", region: "europe", pos: [0.4, 0.15], adj: ["greenland", "great-britain", "scandinavia"] },
  { id: "great-britain", name: "Great Britain", region: "europe", pos: [0.41, 0.25], adj: ["iceland", "scandinavia", "northern-europe", "western-europe"] },
  { id: "scandinavia", name: "Scandinavia", region: "europe", pos: [0.49, 0.13], adj: ["iceland", "great-britain", "northern-europe", "ukraine"] },
  { id: "northern-europe", name: "Northern Europe", region: "europe", pos: [0.49, 0.25], adj: ["great-britain", "scandinavia", "ukraine", "southern-europe", "western-europe"] },
  { id: "western-europe", name: "Western Europe", region: "europe", pos: [0.42, 0.34], adj: ["great-britain", "northern-europe", "southern-europe", "north-africa"] },
  { id: "southern-europe", name: "Southern Europe", region: "europe", pos: [0.5, 0.32], adj: ["western-europe", "northern-europe", "ukraine", "middle-east", "egypt", "north-africa"] },
  { id: "ukraine", name: "Ukraine", region: "europe", pos: [0.58, 0.2], adj: ["scandinavia", "northern-europe", "southern-europe", "ural", "afghanistan", "middle-east"] },

  // --- Africa ---
  { id: "north-africa", name: "North Africa", region: "africa", pos: [0.46, 0.47], adj: ["brazil", "western-europe", "southern-europe", "egypt", "east-africa", "congo"] },
  { id: "egypt", name: "Egypt", region: "africa", pos: [0.52, 0.44], adj: ["southern-europe", "north-africa", "east-africa", "middle-east"] },
  { id: "east-africa", name: "East Africa", region: "africa", pos: [0.56, 0.54], adj: ["egypt", "north-africa", "congo", "south-africa", "madagascar", "middle-east"] },
  { id: "congo", name: "Congo", region: "africa", pos: [0.51, 0.58], adj: ["north-africa", "east-africa", "south-africa"] },
  { id: "south-africa", name: "South Africa", region: "africa", pos: [0.52, 0.7], adj: ["congo", "east-africa", "madagascar"] },
  { id: "madagascar", name: "Madagascar", region: "africa", pos: [0.59, 0.66], adj: ["east-africa", "south-africa"] },

  // --- Asia ---
  { id: "ural", name: "Ural", region: "asia", pos: [0.64, 0.2], adj: ["ukraine", "siberia", "china", "afghanistan"] },
  { id: "siberia", name: "Siberia", region: "asia", pos: [0.7, 0.14], adj: ["ural", "yakutsk", "irkutsk", "mongolia", "china"] },
  { id: "yakutsk", name: "Yakutsk", region: "asia", pos: [0.78, 0.1], adj: ["siberia", "kamchatka", "irkutsk"] },
  { id: "kamchatka", name: "Kamchatka", region: "asia", pos: [0.87, 0.12], adj: ["yakutsk", "irkutsk", "mongolia", "japan", "alaska"] },
  { id: "irkutsk", name: "Irkutsk", region: "asia", pos: [0.74, 0.2], adj: ["siberia", "yakutsk", "kamchatka", "mongolia"] },
  { id: "mongolia", name: "Mongolia", region: "asia", pos: [0.78, 0.27], adj: ["siberia", "irkutsk", "kamchatka", "japan", "china"] },
  { id: "japan", name: "Japan", region: "asia", pos: [0.89, 0.28], adj: ["kamchatka", "mongolia"] },
  { id: "afghanistan", name: "Afghanistan", region: "asia", pos: [0.64, 0.31], adj: ["ukraine", "ural", "china", "india", "middle-east"] },
  { id: "china", name: "China", region: "asia", pos: [0.75, 0.34], adj: ["ural", "siberia", "mongolia", "afghanistan", "india", "siam"] },
  { id: "middle-east", name: "Middle East", region: "asia", pos: [0.58, 0.41], adj: ["southern-europe", "ukraine", "afghanistan", "india", "egypt", "east-africa"] },
  { id: "india", name: "India", region: "asia", pos: [0.68, 0.43], adj: ["afghanistan", "china", "middle-east", "siam"] },
  { id: "siam", name: "Siam", region: "asia", pos: [0.78, 0.45], adj: ["china", "india", "indonesia"] },

  // --- Australia ---
  { id: "indonesia", name: "Indonesia", region: "australia", pos: [0.8, 0.57], adj: ["siam", "new-guinea", "western-australia"] },
  { id: "new-guinea", name: "New Guinea", region: "australia", pos: [0.9, 0.56], adj: ["indonesia", "western-australia", "eastern-australia"] },
  { id: "western-australia", name: "Western Australia", region: "australia", pos: [0.82, 0.69], adj: ["indonesia", "new-guinea", "eastern-australia"] },
  { id: "eastern-australia", name: "Eastern Australia", region: "australia", pos: [0.91, 0.69], adj: ["new-guinea", "western-australia"] },
];

const REGIONS: Region[] = [
  { id: "north-america", name: "North America", bonusArmies: 5, territoryIds: ids("north-america") },
  { id: "south-america", name: "South America", bonusArmies: 2, territoryIds: ids("south-america") },
  { id: "europe", name: "Europe", bonusArmies: 5, territoryIds: ids("europe") },
  { id: "africa", name: "Africa", bonusArmies: 3, territoryIds: ids("africa") },
  { id: "asia", name: "Asia", bonusArmies: 7, territoryIds: ids("asia") },
  { id: "australia", name: "Australia", bonusArmies: 2, territoryIds: ids("australia") },
];

function ids(region: string): string[] {
  return RAW.filter((t) => t.region === region).map((t) => t.id);
}

const territories: Territory[] = RAW.map((t) => ({
  id: t.id,
  name: t.name,
  regionId: t.region,
  adjacentTo: t.adj,
  position: { x: t.pos[0], y: t.pos[1] },
}));

export const classicWorld: GameMap = {
  id: "classic-world",
  name: "Classic World",
  territories,
  regions: REGIONS,
};
