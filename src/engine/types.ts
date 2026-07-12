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
 *
 * The model is built for RoTK depth: provincial commerce/agriculture and a real
 * food-supply economy, typed & trained troops, officers carrying items and
 * traits, prisoners taken in war, and diplomacy between the warlords.
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

/** A single province (zhou) on the board. */
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
  /** Sea/strait routes; also marks which marches cross water (navy matters). */
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
// Troops: types & condition
// ---------------------------------------------------------------------------

/**
 * Army branches. A soft rock-paper-scissors (spear > cavalry > archer > spear)
 * plus terrain roles: navy dominates water crossings, siege batters walls.
 */
export type UnitType = "spearmen" | "cavalry" | "archers" | "navy" | "siege";
export const UNIT_TYPES: UnitType[] = ["spearmen", "cavalry", "archers", "navy", "siege"];

// ---------------------------------------------------------------------------
// Officers (the heart of the series)
// ---------------------------------------------------------------------------

/** Innate skills that modify an officer's effectiveness in specific situations. */
export type OfficerTrait =
  | "valiant" // edge in single-combat duels
  | "strategist" // stronger fire attacks / ambushes and schemes
  | "administrator" // greater commerce development
  | "farmer" // greater agriculture development
  | "orator" // better at recruiting officers and diplomacy
  | "cavalier" // commands cavalry to greater effect
  | "archer" // commands archers to greater effect
  | "admiral" // commands navy to greater effect
  | "pacifier"; // restores public order faster

export type ItemKind = "weapon" | "horse" | "book" | "armor" | "treasure";

/** A treasure an officer can hold; its bonuses add to the holder's stats. */
export interface Item {
  id: string;
  name: string;
  kind: ItemKind;
  war?: number;
  intellect?: number;
  politics?: number;
  charisma?: number;
  leadership?: number;
}

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
  /** Owning player, or null if a free/wandering officer or a prisoner. */
  ownerId: string | null;
  /** Province the officer is stationed/held in, or null if unassigned. */
  provinceId: string | null;
  /** Innate skills. */
  traits: OfficerTrait[];
  /** Ids of items the officer carries (see `Item`). */
  items: string[];
  /** If captured, the player holding them prisoner; else null. */
  captiveOf: string | null;
  /** Cleared to false when executed; the dead are excluded from all rosters. */
  alive: boolean;
}

// ---------------------------------------------------------------------------
// Per-province dynamic state
// ---------------------------------------------------------------------------

/** Who holds a province, with what forces, economy and defences. */
export interface ProvinceState {
  ownerId: string | null;
  /** Soldiers garrisoned here. */
  troops: number;
  /** Dominant branch of the garrison (recruited & fielded type). */
  garrisonType: UnitType;
  /** Troop morale 0–100: fighting spirit, fed by order and supply. */
  morale: number;
  /** Troop training 0–100: drill and discipline, raised by the Train command. */
  training: number;
  gold: number;
  /** Grain stockpile — the supply that feeds the garrison each season. */
  food: number;
  /** Population in thousands — recruiting pool and tax base. */
  population: number;
  /** Public order 0–100: low order cuts income and invites revolt. */
  order: number;
  /** Commerce 0–100: scales seasonal gold income. */
  commerce: number;
  /** Agriculture 0–100: scales seasonal food (grain) income. */
  agriculture: number;
  /** Fortification level 0–5: strengthens defenders and resists sieges. */
  wallLevel: number;
}

// ---------------------------------------------------------------------------
// Diplomacy
// ---------------------------------------------------------------------------

export type PactKind = "alliance" | "ceasefire";

/** A standing agreement between two warlords. */
export interface Pact {
  /** The two player ids, stored sorted for a stable key. */
  a: string;
  b: string;
  kind: PactKind;
  /** Season-turn the pact lapses (ceasefires), or null for an open alliance. */
  untilTurn: number | null;
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
  /** All item definitions in play (carried by officers via `Officer.items`). */
  items: Item[];
  /** Standing diplomatic agreements. */
  pacts: Pact[];
  /** Pairwise relations, keyed `"a|b"` (sorted ids), in [-100, 100]. */
  relations: Record<string, number>;
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
  /** Recent battles (capped), for the report UI. Newest last. */
  battles: BattleReport[];
  /** Monotonic counter assigning each battle its `seq`. */
  battleSeq: number;
  winnerId: string | null;
}

// ---------------------------------------------------------------------------
// Battle results (auto-resolve + tactical nudges)
// ---------------------------------------------------------------------------

/** A scripted tactical event that can fire mid-battle. */
export type BattleEventKind = "fire-attack" | "ambush" | "duel" | "rout" | "low-supply";

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

/**
 * A player-facing record of a battle, with display names resolved so the UI can
 * render a report without re-deriving them. Appended to `GameState.battles`, and
 * tagged with a monotonic `seq` so the UI can show each one exactly once.
 */
export interface BattleReport {
  /** Monotonic id so the UI can track which reports it has already shown. */
  seq: number;
  turn: number;
  provinceId: string;
  provinceName: string;
  attackerId: string;
  attackerName: string;
  defenderId: string | null;
  defenderName: string;
  attackerType: UnitType;
  defenderType: UnitType;
  attackerOfficer: string | null;
  defenderOfficer: string | null;
  attackerStart: number;
  attackerEnd: number;
  defenderStart: number;
  defenderEnd: number;
  events: BattleEvent[];
  captured: boolean;
  capturedOfficer: string | null;
  waterCrossing: boolean;
}
