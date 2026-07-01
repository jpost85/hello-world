/**
 * Shared domain types for Aphelion.
 *
 * These are intentionally data-first: factions, projects, techs and hazards
 * are all plain data (see src/data/*), and the engine (src/engine/*) is a set
 * of pure-ish functions that transform a GameState. Keeping the model separate
 * from rendering means your existing hex-map infrastructure can drive the same
 * state without knowing anything about these rules.
 */

// ---------------------------------------------------------------------------
// Global terraforming parameters
// ---------------------------------------------------------------------------

/** The planet-wide dials the whole game is about pushing toward habitable. */
export type GlobalParamKey =
  | "temperature"
  | "oxygen"
  | "pressure"
  | "hydrosphere"
  | "biomass";

export interface GlobalParam {
  key: GlobalParamKey;
  label: string;
  unit: string;
  /** Current value. */
  value: number;
  /** Starting value / floor used to compute progress. */
  min: number;
  /** The value considered "habitable" — progress is measured against this. */
  target: number;
  /** Hard cap; projects cannot push past this. */
  max: number;
  description: string;
}

export type GlobalParams = Record<GlobalParamKey, GlobalParam>;

// ---------------------------------------------------------------------------
// Colony economy: stored stocks vs. per-turn flows
// ---------------------------------------------------------------------------

/** Storable resources a colony banks between turns. */
export interface ColonyStocks {
  energy: number;
  materials: number;
  food: number;
  credits: number;
}

export type StockKey = keyof ColonyStocks;

/** Per-turn flows. Everything in ColonyStocks plus research, which is spent
 *  immediately on the current tech rather than banked. */
export interface Production extends ColonyStocks {
  research: number;
}

/** Multipliers applied to a colony's base production (faction traits, etc.).
 *  Unspecified keys default to 1. */
export type ProductionModifiers = Partial<Record<keyof Production, number>>;

// ---------------------------------------------------------------------------
// Factions
// ---------------------------------------------------------------------------

export interface Faction {
  id: string;
  name: string;
  leader: string;
  /** One-line political/ideological stance. */
  agenda: string;
  blurb: string;
  /** CSS color used by the placeholder renderer and UI accents. */
  color: string;
  /** Production multipliers (see ProductionModifiers). */
  modifiers: ProductionModifiers;
  /** Human-readable trait list for the faction-select screen. */
  bonuses: string[];
  /** Resources this faction starts the game with. */
  startingStocks: ColonyStocks;
  /** Base per-turn production before modifiers. */
  startingProduction: Production;
  /** Flavor description of the faction's signature ability. */
  special: string;
  /** Multiplier on the effect this faction gets when a project moves a given
   *  global parameter (e.g. ecologists terraform biomass faster). */
  terraformAffinity: Partial<Record<GlobalParamKey, number>>;
}

// ---------------------------------------------------------------------------
// Terraforming projects
// ---------------------------------------------------------------------------

export type ProjectCategory =
  | "thermal"
  | "atmosphere"
  | "hydrosphere"
  | "biosphere"
  | "infrastructure";

export interface TerraformProject {
  id: string;
  name: string;
  category: ProjectCategory;
  description: string;
  /** Up-front cost paid when the project is started. */
  cost: Partial<ColonyStocks>;
  /** Turns until the project completes and its effects land. */
  duration: number;
  /** If true, the project can be run again after it completes (the core
   *  terraforming levers). One-shot mega-projects/infrastructure leave this
   *  false. */
  repeatable?: boolean;
  /** Applied to global parameters on completion. */
  effects: Partial<Record<GlobalParamKey, number>>;
  /** Permanent change to colony production on completion. */
  productionEffects?: Partial<Production>;
  /** One-time stock grant/cost on completion. */
  colonyEffects?: Partial<ColonyStocks>;
  /** Tech id that must be researched before this project is available. */
  requiresTech?: string;
  /** Minimum global-parameter thresholds required to start. */
  requiresParams?: Partial<Record<GlobalParamKey, number>>;
  /** Optional failure chance rolled on completion. */
  risk?: { chance: number; description: string };
}

/** A project the player has committed to; counts down each turn. */
export interface ActiveProject {
  projectId: string;
  turnsRemaining: number;
}

// ---------------------------------------------------------------------------
// Technology
// ---------------------------------------------------------------------------

export interface Technology {
  id: string;
  name: string;
  description: string;
  /** Research points required. */
  cost: number;
  /** Other tech ids that must be researched first. */
  requires?: string[];
}

// ---------------------------------------------------------------------------
// Hazards / events
// ---------------------------------------------------------------------------

/** A random crisis. `apply` mutates state and returns a log line describing
 *  what happened, so survival stays tense. */
export interface Hazard {
  id: string;
  name: string;
  description: string;
  /** Relative likelihood when an event fires. */
  weight: number;
  /** Earliest turn this can occur. */
  minTurn?: number;
  apply: (state: GameState) => string;
}

// ---------------------------------------------------------------------------
// AI rivals (stub)
// ---------------------------------------------------------------------------

export interface RivalFaction {
  factionId: string;
  /** Rough measure of how far along this rival's own colony is. */
  progress: number;
}

// ---------------------------------------------------------------------------
// Log + top-level game state
// ---------------------------------------------------------------------------

export type LogKind = "info" | "good" | "bad" | "project" | "event";

export interface LogEntry {
  turn: number;
  kind: LogKind;
  message: string;
}

export interface Colony {
  id: string;
  name: string;
  factionId: string;
  population: number;
  /** Population ceiling, grows as the planet becomes more habitable. */
  maxPopulation: number;
  /** Morale/cohesion, 0–100. Low stability slows growth and production. */
  stability: number;
  stocks: ColonyStocks;
  /** Base production before faction/habitability modifiers are applied. */
  production: Production;
}

export interface GameState {
  turn: number;
  playerFactionId: string;
  colony: Colony;
  globalParams: GlobalParams;
  activeProjects: ActiveProject[];
  completedProjects: string[];
  researchedTech: string[];
  currentResearch?: { techId: string; progress: number };
  /** Derived 0–100 habitability index (see engine/terraforming). */
  habitability: number;
  /** Gamey score: terraforming milestones reached. */
  terraformRating: number;
  rivals: RivalFaction[];
  log: LogEntry[];
  gameOver?: "won" | "lost";
}
