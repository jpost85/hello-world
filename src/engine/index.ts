/**
 * Public engine surface. The UI imports only from here, keeping the engine's
 * internal module layout free to change.
 */
export * from "./types.ts";
export { CONFIG, typeMatchup } from "./config.ts";
export {
  createGame,
  currentPlayer,
  provincesOf,
  leadOfficer,
  commandPointsFor,
  develop,
  cultivate,
  train,
  recruit,
  fortify,
  scheme,
  march,
  recruitableIn,
  recruitOfficer,
  releasePrisoner,
  executePrisoner,
  proposePact,
  breakPact,
  relationOf,
  areAllied,
  inCeasefire,
  atPeace,
  endTurn,
  type NewGameOptions,
} from "./game.ts";
export { resolveBattle, type BattleSide, type BattleInputs } from "./battle.ts";
export { playAITurn } from "./ai.ts";
export { DEFAULT_SCENARIO, type Scenario } from "./scenario.ts";
export { MAP_REGISTRY, getMapById } from "./maps/registry.ts";
export { chinaMap } from "./maps/china.ts";
export { ITEMS, getItem, effectiveStats, hasTrait } from "./items.ts";
export { seedRng, nextFloat, rollDie, rollRange } from "./rng.ts";
