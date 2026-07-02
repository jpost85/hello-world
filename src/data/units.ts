import type { ColonyStocks, UnitClass } from "../types";

/**
 * Unit definitions for the "very small slice" (docs/UNITS.md §8, decided):
 * only the player's territory is real, and enemy raiders arrive at the map
 * edge. Two player classes prove the two defensive roles — the Warden
 * (garrison slot) and the Ranger (field slot) — against a single enemy class,
 * the raider, fielded by the Stillness and by Nemesis rivals.
 *
 * The full roster (Terraformer, Prospector, Convoy, Settler, Saboteur) is
 * designed in docs/UNITS.md and layers on top of this loop.
 */

export interface UnitDefSlice {
  id: UnitClass;
  name: string;
  strength: number;
  hp: number;
  moves: number;
  cost: Partial<ColonyStocks>;
  upkeep: Partial<ColonyStocks>;
  blurb: string;
}

export const UNIT_DEFS: Record<UnitClass, UnitDefSlice> = {
  warden: {
    id: "warden",
    name: "Warden",
    strength: 5,
    hp: 22,
    moves: 1,
    cost: { materials: 40, credits: 30 },
    upkeep: { credits: 1 },
    blurb: "Defensive specialist. Garrisons a structure and fights with its hardness bonus.",
  },
  ranger: {
    id: "ranger",
    name: "Ranger",
    strength: 6,
    hp: 20,
    moves: 2,
    cost: { materials: 50, credits: 40 },
    upkeep: { credits: 2, energy: 1 },
    blurb: "Mobile field unit. Patrols your territory and hunts down raiders.",
  },
  raider: {
    id: "raider",
    name: "Raider",
    strength: 5,
    hp: 18,
    moves: 2,
    cost: {},
    upkeep: {},
    blurb: "Hostile strike party heading for your infrastructure.",
  },
};

/** Tuning for the slice's military simulation (engine/units.ts). */
export const MILITARY_TUNING = {
  /** Max player units — an army is turns of terraforming you didn't do. */
  forceCap: 4,
  /** Max simultaneous enemy raiders on the map. */
  enemyCap: 3,
  /** Extra defense a garrisoned Warden gets from the structure. */
  garrisonHardnessBonus: 2,
  /** New structures. */
  structureIntegrity: 24,
  structureHardness: 1,
  /** Re-completing a repeatable project hardens its structure instead. */
  reinforceIntegrity: 8,
  /** Fraction of a structure's parameter grant regressed when razed (min 2). */
  razeParamFraction: 0.6,
  /** HP healed per turn at the settlement or while garrisoned. */
  healPerTurn: 6,
  /** Below this fraction of max HP, a Ranger falls back to the settlement. */
  retreatAt: 0.3,
  /** Spawn chances per turn (when below enemyCap and structures exist). */
  stillnessSpawnDivisor: 300, // chance = min(0.25, threat / this)
  stillnessSpawnCap: 0.25,
  nemesisSpawnChance: 0.12,
} as const;
