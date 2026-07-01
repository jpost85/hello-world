import type { GameState, Production } from "../types";
import { getFaction } from "../data/factions";
import { combineModifiers, policyModifiers, policyStability } from "./policies";
import { ideologyModifiers, ideologyStability } from "./ideology";
import { updateInterestGroups } from "./politics";

/**
 * Colony survival: the per-turn economic + life-support tick.
 *
 * This is where terraforming and survival couple together:
 *  - Food production scales with habitability (a greener world farms itself).
 *  - Population capacity rises as the planet becomes livable.
 *  - Every colonist consumes food and energy; deficits cause starvation,
 *    blackouts, and morale collapse.
 *
 * Returns human-readable log lines describing anything notable that happened.
 */

// Tuned so a starting colony is roughly break-even-to-positive while idle:
// survival pressure should come from hazards, population growth, and
// overreaching on projects — not from an unwinnable baseline.
const BASE_FOOD_PER_POP = 0.3;
const BASE_ENERGY_PER_POP = 0.35;

/** Faction-adjusted per-capita life-support demand. */
function perCapitaDemand(state: GameState): { food: number; energy: number } {
  const faction = getFaction(state.colony.factionId);
  // Cradle of Ouroboros ("Rationing") needs less to keep people alive.
  const mult = faction.id === "ouroboros-cradle" ? 0.75 : 1;
  return {
    food: BASE_FOOD_PER_POP * mult,
    energy: BASE_ENERGY_PER_POP * mult,
  };
}

/**
 * Effective production for this turn: base production x faction modifiers,
 * with food further scaled by habitability (0.5x on a dead world -> 1.5x on a
 * fully terraformed one).
 */
export function effectiveProduction(state: GameState): Production {
  const faction = getFaction(state.colony.factionId);
  const base = state.colony.production;
  // Faction identity × social-engineering policy × dominant ideology.
  const mod = combineModifiers(
    faction.modifiers,
    policyModifiers(state),
    ideologyModifiers(state),
  );
  const habFactor = 0.85 + (state.habitability / 100) * 0.5; // 0.85 .. 1.35

  const apply = (key: keyof Production, extra = 1): number =>
    Math.max(0, base[key] * (mod[key] ?? 1) * extra);

  return {
    energy: apply("energy"),
    materials: apply("materials"),
    food: apply("food", habFactor),
    credits: apply("credits"),
    research: apply("research"),
  };
}

/** Recompute the population ceiling from habitability and stability. */
export function computeMaxPopulation(state: GameState): number {
  // Domes support a starting population with headroom to regrow after
  // hazards; a terraformed world supports cities. The generous scaling lets a
  // maturing colony become large and hazard-resilient — the demographic base a
  // civilization needs to reach the ideological and independence phases.
  const base = 28;
  const fromHabitability = Math.round(state.habitability * 1.3);
  return base + fromHabitability;
}

/**
 * Run the economy + life-support tick. Mutates the colony and returns log
 * lines. Called once per turn by the game engine, after production-affecting
 * projects for the turn have resolved.
 */
export function runSurvivalTick(state: GameState): string[] {
  const logs: string[] = [];
  const colony = state.colony;
  const prod = effectiveProduction(state);

  // 1. Bank production.
  colony.stocks.energy += prod.energy;
  colony.stocks.materials += prod.materials;
  colony.stocks.food += prod.food;
  colony.stocks.credits += prod.credits;

  // 2. Life-support consumption.
  const demand = perCapitaDemand(state);
  const foodNeed = colony.population * demand.food;
  const energyNeed = colony.population * demand.energy;
  colony.stocks.food -= foodNeed;
  colony.stocks.energy -= energyNeed;

  const faction = getFaction(colony.factionId);
  const fragile = faction.id === "cognitum" ? 1.5 : 1; // Cognitum is brittle.

  // 3. Starvation.
  if (colony.stocks.food < 0) {
    const deficit = -colony.stocks.food;
    const starved = Math.ceil((deficit / Math.max(1, demand.food)) * fragile);
    const lost = Math.min(colony.population, starved);
    colony.population -= lost;
    colony.stocks.food = 0;
    colony.stability = Math.max(0, colony.stability - 8);
    logs.push(`Famine: ${lost} colonists starve (-8 stability).`);
  }

  // 4. Blackout.
  if (colony.stocks.energy < 0) {
    colony.stocks.energy = 0;
    const hit = Math.round(8 * fragile);
    colony.stability = Math.max(0, colony.stability - hit);
    logs.push(`Power deficit forces rolling blackouts (-${hit} stability).`);
  }

  // 5. Political + ideological stability effects (settlement phase onward),
  //    then drift toward a habitability-linked equilibrium. The equilibrium
  //    sits above the growth threshold so a colony recovers to a growing state
  //    after a hazard instead of stalling permanently.
  colony.stability += policyStability(state) + ideologyStability(state);
  const politics = updateInterestGroups(state);
  colony.stability += politics.stability;
  for (const line of politics.logs) logs.push(line);
  colony.stability = Math.max(0, Math.min(100, colony.stability));

  const equilibrium = 60 + state.habitability * 0.3; // 60 .. 90
  const recovery = faction.id === "terran-union" ? 5 : 3; // Solidarity
  if (colony.stability < equilibrium) {
    colony.stability = Math.min(equilibrium, colony.stability + recovery);
  }

  // 6. Population dynamics. Grow only when food *production* sustainably feeds
  //    another colonist — this ties population to how habitable the world is
  //    and avoids a Malthusian famine oscillation on a barely-terraformed
  //    planet. A hazard that cuts food production naturally halts growth.
  colony.maxPopulation = computeMaxPopulation(state);
  const sustainable = prod.food >= (colony.population + 1) * demand.food;
  const content = colony.stability >= 50;
  if (sustainable && content && colony.population < colony.maxPopulation) {
    const growthRate = faction.id === "terran-union" ? 0.12 : 0.08;
    const growth = Math.max(1, Math.round(colony.population * growthRate));
    colony.population = Math.min(colony.maxPopulation, colony.population + growth);
  }

  return logs;
}
