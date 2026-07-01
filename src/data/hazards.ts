import type { Hazard, GameState } from "../types";
import { getFaction } from "./factions";

/**
 * Space is trying to kill your colony. Hazards are the survival pressure that
 * makes the terraforming race tense: each turn there's a chance one fires,
 * weighted by `weight`. `apply` mutates state and returns a log line.
 *
 * Faction resilience is honored here: the Iron Vanguard ("Hardened") and the
 * Cradle of Ouroboros take reduced casualties. Wire more faction specials in
 * the same way.
 */

/** Population loss helper that respects faction damage-reduction traits. */
function killPopulation(state: GameState, base: number): number {
  const faction = getFaction(state.colony.factionId);
  let mult = 1;
  if (faction.id === "iron-vanguard") mult = 0.5;
  if (faction.id === "ouroboros-cradle") mult = 0.6;
  // Cap casualties as a fraction of the colony so a single event can't wipe a
  // small starting colony — survival pressure, not a coin-flip death.
  const cap = Math.ceil(state.colony.population * 0.25);
  const lost = Math.min(cap, Math.max(0, Math.round(base * mult)));
  state.colony.population = Math.max(0, state.colony.population - lost);
  return lost;
}

export const HAZARDS: Hazard[] = [
  {
    id: "solar-flare",
    name: "Solar Flare",
    description: "A coronal mass ejection floods the colony with radiation.",
    weight: 3,
    apply: (state) => {
      state.colony.stocks.energy = Math.max(0, state.colony.stocks.energy - 30);
      const lost = killPopulation(state, 2);
      state.colony.stability = Math.max(0, state.colony.stability - 8);
      return `Solar flare knocks out grid capacity (-30 energy)${
        lost ? ` and ${lost} colonists are lost to radiation` : ""
      }.`;
    },
  },
  {
    id: "dust-storm",
    name: "Global Dust Storm",
    description: "Weeks-long dust blackout starves solar arrays and crops.",
    weight: 3,
    apply: (state) => {
      state.colony.stocks.energy = Math.max(0, state.colony.stocks.energy - 20);
      state.colony.stocks.food = Math.max(0, state.colony.stocks.food - 25);
      return "A planet-wide dust storm blots out the sun (-20 energy, -25 food).";
    },
  },
  {
    id: "hull-breach",
    name: "Habitat Breach",
    description: "Structural failure vents a dome to the outside.",
    weight: 2,
    apply: (state) => {
      const lost = killPopulation(state, 3);
      state.colony.stability = Math.max(0, state.colony.stability - 10);
      return `A habitat dome breaches${
        lost ? `; ${lost} colonists are lost` : ""
      } (-10 stability).`;
    },
  },
  {
    id: "coolant-failure",
    name: "Reactor Coolant Failure",
    description: "A primary reactor scrams, forcing rolling blackouts.",
    weight: 2,
    apply: (state) => {
      state.colony.stocks.energy = Math.max(0, state.colony.stocks.energy - 45);
      state.colony.stability = Math.max(0, state.colony.stability - 5);
      return "Reactor coolant loop fails — emergency shutdown (-45 energy).";
    },
  },
  {
    id: "crop-blight",
    name: "Hydroponic Blight",
    description: "An engineered pathogen tears through the food vats.",
    weight: 2,
    minTurn: 4,
    apply: (state) => {
      state.colony.stocks.food = Math.max(0, state.colony.stocks.food - 40);
      state.colony.production.food = Math.max(0, state.colony.production.food - 1);
      return "Blight ruins the hydroponics (-40 food, farm output reduced).";
    },
  },
  {
    id: "meteor-strike",
    name: "Meteor Strike",
    description: "An unshielded rock punches into a production district.",
    weight: 1,
    minTurn: 3,
    apply: (state) => {
      const lost = killPopulation(state, 4);
      state.colony.stocks.materials = Math.max(0, state.colony.stocks.materials - 30);
      state.colony.stability = Math.max(0, state.colony.stability - 12);
      return `Meteor strike devastates a district${
        lost ? `, ${lost} dead` : ""
      } (-30 materials, -12 stability).`;
    },
  },

  // A rare *good* event — not everything out here wants you dead.
  {
    id: "salvage-find",
    name: "Derelict Salvage",
    description: "Survey drones find an intact pre-collapse supply cache.",
    weight: 1,
    apply: (state) => {
      state.colony.stocks.materials += 40;
      state.colony.stocks.credits += 30;
      state.colony.stability = Math.min(100, state.colony.stability + 5);
      return "Salvage crews recover a derelict cache (+40 materials, +30 credits).";
    },
  },
];
