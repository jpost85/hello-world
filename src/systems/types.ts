/**
 * Shared domain types for the game-systems layer.
 *
 * Nothing in `src/systems` may import Phaser. These systems are the pure
 * simulation core: deterministic, side-effect free where possible, and unit
 * testable in plain Node (see `src/systems/__tests__`). The Phaser layer in
 * `src/scenes` is only a rendering + input shell on top of this core.
 */

/** The slots a creature's body is composed from. A creature is just a set of parts. */
export type PartSlot = "body" | "mouth" | "fins" | "limbs" | "armor" | "sense";

/** Aggregate combat/traversal stats. All parts contribute additively. */
export interface Stats {
  /** Outgoing damage when attacking. */
  attack: number;
  /** Damage mitigation when defending. */
  defense: number;
  /** Max health pool. */
  maxHealth: number;
  /** Movement speed (px/sec at the presentation layer). */
  speed: number;
  /** How much body mass this confers — gates which prey you can eat/which enemies eat you. */
  size: number;
}

/** A single evolvable part. Adding a new mutation is a data entry, not new code. */
export interface BodyPart {
  id: string;
  slot: PartSlot;
  name: string;
  /** Higher tier = later/stronger evolution within a slot. */
  tier: number;
  /** Stat contribution of this part, summed into the creature total. */
  statMods: Partial<Stats>;
  /** EVO-point cost to evolve INTO this part. */
  cost: number;
  /** Parts this can evolve into next (ids). Empty = terminal for now. */
  evolvesTo: string[];
  /** Visual hint for the renderer (color, shape) until real art exists. */
  visual: { color: string; shape: "circle" | "triangle" | "rect" };
}

/** A creature instance: a composition of equipped parts plus live state. */
export interface CreatureState {
  /** Equipped part id per slot. Absent slots are simply not yet evolved. */
  parts: Partial<Record<PartSlot, string>>;
  evoPoints: number;
  currentHealth: number;
  eraId: string;
}

/** An enemy/prey definition. */
export interface Enemy {
  id: string;
  name: string;
  eraId: string;
  stats: Stats;
  /** EVO points awarded for eating it. */
  reward: number;
  behavior: "drift" | "flee" | "hunt";
  visual: { color: string; shape: "circle" | "triangle" | "rect"; radius: number };
}

/** A macro stage of the game (Age of Fish, Amphibian, ...). */
export interface Era {
  id: string;
  name: string;
  description: string;
  enemyIds: string[];
  /** Total EVO points the player must bank in this era to advance. */
  advanceAtPoints: number;
  /** Background tint for the renderer. */
  background: string;
}

/** Persisted save shape (also the cloud-sync payload). */
export interface SaveState {
  version: number;
  creature: CreatureState;
  unlockedParts: string[];
  updatedAt: number;
}
