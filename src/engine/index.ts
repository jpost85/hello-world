/** Public surface of the pure game engine. UI code imports only from here. */

export * from "./types.ts";
export * from "./rng.ts";
export * from "./combat.ts";
export * from "./map.ts";
export * from "./game.ts";
export { CONFIG } from "./config.ts";
export { playAITurn } from "./ai.ts";
export { DEFAULT_FACTIONS } from "./factions.ts";
// Note: classicWorld is intentionally NOT re-exported here so it stays a
// lazily-loaded chunk (see registry.ts). Import it directly in tests.
export { worldMap } from "./maps/worldMap.ts";
export { MAP_REGISTRY, DEFAULT_MAP_ID, mapInfo } from "./maps/registry.ts";
export type { MapInfo } from "./maps/registry.ts";
