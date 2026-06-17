/**
 * Core domain model for the Three Kingdoms engine.
 *
 * Everything in `src/engine` is pure TypeScript with no UI or platform
 * dependencies. State is treated as immutable: engine functions return new
 * state rather than mutating in place, which keeps resolution reproducible and
 * makes replay / undo / networked play tractable later.
 *
 * This mirrors the Dominion (Risk) branch's architecture deliberately: a single
 * serialisable `GameState`, a seeded RNG threaded through every random draw, and
 * a hard engine/UI split — so the two projects troubleshoot the same way.
 */

// ---------------------------------------------------------------------------
// Map definition (static data describing the board)
// ---------------------------------------------------------------------------

/** A named group of provinces that grants a prosperity bonus when fully held. */
export interface Region {
  id: string;
  name: string;
  provinceIds: string[];
  /** Bonus gold granted each year to the warlord who controls every province. */
  bonusGold: number;
}

/** A single province (州, zhou) on the board. */
export interface Province {
  id: string;
  name: string;
  regionId: string;
  /** Provinces reachable for marching and attack. */
  adjacentTo: string[];
  /** Absolute coordinates (in the map `viewBox`) for the province badge. */
  position: { x: number; y: number };
  /** SVG path (real projected geography) rendered as the province shape. */
  path?: string;
}

/** A complete, static board definition. */
export interface GameMap {
  id: string;
  name: string;
  provinces: Province[];
  regions: Region[];
  /** SVG viewBox for the path-based map. */
  viewBox?: string;
  /** Sea/strait routes to draw as connecting lines (land borders are implicit). */
  connectors?: [string, string][];
}

// ---------------------------------------------------------------------------
// Factions & players (warlords)
// ---------------------------------------------------------------------------

/** A playable warlord faction. Cosmetic + identity today; hook for traits later. */
export interface Faction {
  id: string;
  name: string;
  /** CSS colour used to render owned provinces. */
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
// Officers (the heart of the series)
// ---------------------------------------------------------------------------

/**
 * An officer is a hero unit serving a warlord. Stats are on the classic 1–100
 * scale. While assigned to a province the officer's stats shape what happens
 * there: WAR drives battle, LEADERSHIP the size of an army they can command,
 * INTELLECT schemes and defence against them, POLITICS development income, and
 * CHARISMA recruiting other officers. Loyalty governs defection.
 */
export interface Officer {
  id: string;
  name: string;
  war: number;
  intellect: number;
  politics: number;
  charisma: number;
  leadership: number;
  /** Loyalty to the current lord (0–100); low loyalty invites defection. */
  loyalty: number;
  /** Owning player, or null if a free/wandering officer not yet recruited. */
  ownerId: string | null;
  /** Province the officer is stationed in, or null if unassigned/wandering. */
  provinceId: string | null;
}

// ---------------------------------------------------------------------------
// Per-province dynamic state
// ---------------------------------------------------------------------------

/** Who holds a province, with what forces and economy. */
export interface ProvinceState {
  ownerId: string | null;
  /** Soldiers garrisoned here. */
  troops: number;
  gold: number;
  food: number;
  /** Population in thousands — recruiting pool and tax base. */
  population: number;
  /** Public order 0–100: low order cuts income and invites revolt. */
  order: number;
  /** Economic development 0–100: scales seasonal income. */
  development: number;
  /** A rampart strengthens defenders stationed here (see battle rules). */
  hasRampart: boolean;
}

// ---------------------------------------------------------------------------
// Turn structure & game state
// ---------------------------------------------------------------------------

export type Season = "spring" | "summer" | "autumn" | "winter";
export const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

/** A warlord spends command points during `command`; `gameover` ends play. */
export type Phase = "command" | "gameover";

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
  /** Keyed by province id. */
  provinces: Record<string, ProvinceState>;
  officers: Officer[];
  /** Years since 189 AD (display only). */
  year: number;
  season: Season;
  /** Monotonic season counter across the whole game. */
  turn: number;
  currentPlayerIndex: number;
  phase: Phase;
  /** Command points the current warlord has left to spend this season. */
  commandPointsRemaining: number;
  /** Deterministic RNG state, advanced on every random draw. */
  rngState: number;
  events: GameEvent[];
  winnerId: string | null;
}

// ---------------------------------------------------------------------------
// Battle results (auto-resolve + tactical nudges)
// ---------------------------------------------------------------------------

/** A scripted tactical event that can fire mid-battle. */
export type BattleEventKind = "fire-attack" | "ambush" | "duel" | "rout";

export interface BattleEvent {
  kind: BattleEventKind;
  message: string;
  /** Extra casualties inflicted on the side named by `against`. */
  damage: number;
  against: "attacker" | "defender";
}

/** Outcome of a full battle when an army marches into a hostile province. */
export interface BattleResult {
  provinceId: string;
  attackerId: string;
  defenderId: string | null;
  attackerTroopsStart: number;
  defenderTroopsStart: number;
  attackerTroopsEnd: number;
  defenderTroopsEnd: number;
  events: BattleEvent[];
  /** True if the attacker took the province. */
  captured: boolean;
  /** Officer captured in the fall of the province, if any. */
  capturedOfficerId: string | null;
}
