/** Public surface of the pure game engine. UI code imports only from here. */

export * from "./types.ts";
export * from "./rng.ts";
export * from "./combat.ts";
export * from "./map.ts";
export * from "./game.ts";
export { DEFAULT_FACTIONS } from "./factions.ts";
export { classicWorld } from "./maps/classicWorld.ts";
