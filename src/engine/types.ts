/**
 * Core domain model for the Dominion: Balance of Power engine.
 *
 * Everything in `src/engine` is pure TypeScript with no UI or platform
 * dependencies. State is treated as immutable: engine functions return new
 * state rather than mutating in place, which keeps combat reproducible and
 * makes replay / undo / networked play tractable later.
 */

// ---------------------------------------------------------------------------
// Map definition (static data describing a board)
// ---------------------------------------------------------------------------

/** A named group of territories that grants bonus reinforcements when fully held. */
export interface Region {
  id: string;
  name: string;
  /** Territories belonging to this region. */
  territoryIds: string[];
  /** Bonus armies granted each turn to the player who controls every territory. */
  bonusArmies: number;
}

/** A single space on the board. */
export interface Territory {
  id: string;
  name: string;
  regionId: string;
  /** Territories reachable for movement and attack. */
  adjacentTo: string[];
  /**
   * Layout position for the unit badge. In maps with a `viewBox` these are
   * absolute coordinates in that space; otherwise they are normalised to [0, 1].
   */
  position: { x: number; y: number };
  /** Optional SVG path (projected real geography) rendered as the territory shape. */
  path?: string;
}

/** A complete, static board definition. */
export interface GameMap {
  id: string;
  name: string;
  territories: Territory[];
  regions: Region[];
  /** SVG viewBox for path-based maps; when absent, positions are normalised. */
  viewBox?: string;
  /** Sea/strait routes to draw as connecting lines (land borders are implicit). */
  connectors?: [string, string][];
  /** Non-playable landmasses drawn for realism (e.g. Antarctica) — not territories. */
  decorations?: MapDecoration[];
}

/** A purely cosmetic landmass: rendered, but never owned or fought over. */
export interface MapDecoration {
  name: string;
  fill: string;
  path: string;
  position: { x: number; y: number };
}

// ---------------------------------------------------------------------------
// Factions & players
// ---------------------------------------------------------------------------

/** A playable nation/faction. Cosmetic + identity today; hook for traits later. */
export interface Faction {
  id: string;
  name: string;
  /** CSS colour used to render owned territories. */
  color: string;
}

export interface Player {
  id: string;
  name: string;
  factionId: string;
  isAI: boolean;
  isEliminated: boolean;
}

// ---------------------------------------------------------------------------
// Units placed on the board
// ---------------------------------------------------------------------------

/**
 * A general is a mobile hero unit. While stationed in a territory it lends its
 * `combatBonus` to that territory's rolls (attacking from it, or defending it).
 * Generals can be moved and reassigned by their owner.
 */
export interface General {
  id: string;
  ownerId: string;
  name: string;
  /** Territory the general currently occupies, or null if not yet deployed. */
  territoryId: string | null;
  /** Bonus added to the controlling side's highest die while present. */
  combatBonus: number;
}

/** Per-territory dynamic state: who holds it, with how many armies, plus structures. */
export interface TerritoryState {
  ownerId: string | null;
  armies: number;
  /** A fortress strengthens defenders stationed here (see combat rules). */
  hasFortress: boolean;
}

// ---------------------------------------------------------------------------
// Combat styles
// ---------------------------------------------------------------------------

export type AttackStyle = "standard" | "aggressive" | "cautious";
export type DefenseStyle = "standard" | "aggressive" | "cautious";

/**
 * Numeric profile a style resolves to. Styles are data so balance can be tuned
 * in one place (see `combat.ts`) without touching resolution logic.
 */
export interface StyleProfile {
  /** Added to the side's maximum dice count for the round. */
  diceModifier: number;
  /** Flat bonus added to this side's single highest die. */
  highRollBonus: number;
  /** If true, this side wins tied die comparisons (normally the defender wins). */
  winsTies: boolean;
}

// ---------------------------------------------------------------------------
// Turn structure & game state
// ---------------------------------------------------------------------------

export type Phase = "reinforce" | "attack" | "fortify" | "gameover";

/** A single recorded event for the in-game log / replay stream. */
export interface GameEvent {
  turn: number;
  playerId: string;
  message: string;
}

/** The complete, serialisable state of a game in progress. */
export interface GameState {
  map: GameMap;
  factions: Faction[];
  players: Player[];
  /** Keyed by territory id. */
  territories: Record<string, TerritoryState>;
  generals: General[];
  turn: number;
  currentPlayerIndex: number;
  phase: Phase;
  /** Armies remaining to place during the reinforce phase. */
  reinforcementsRemaining: number;
  /** True once the current player has captured >=1 territory this turn. */
  conqueredThisTurn: boolean;
  /** Deterministic RNG state, advanced on every die roll. */
  rngState: number;
  events: GameEvent[];
  winnerId: string | null;
}

// ---------------------------------------------------------------------------
// Combat results
// ---------------------------------------------------------------------------

/** Outcome of a single round (one volley of dice) of an attack. */
export interface CombatRound {
  attackerDice: number[];
  defenderDice: number[];
  attackerLosses: number;
  defenderLosses: number;
}

/** Outcome of a full `attack()` action. */
export interface AttackResult {
  round: CombatRound;
  /** True if the defending territory fell and changed hands this attack. */
  captured: boolean;
  attackerArmiesRemaining: number;
  defenderArmiesRemaining: number;
}
