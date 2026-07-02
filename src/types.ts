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
  /** Which ideological leaning completing this project reinforces. */
  ideologyLean?: IdeologyAxis;
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
// Rival AI + evolving diplomacy — a Nemesis-inspired system.
//
// Rivals are not stat blocks: each is a leader with a personality who REMEMBERS
// what you have done, holds grudges and debts, rises and falls in a shifting
// power hierarchy, and has relationships with the OTHER rivals. Wrong one and it
// becomes your Nemesis with a vendetta; a fallen leader can resurface through a
// successor who inherits the faction's memory.
// ---------------------------------------------------------------------------

/** Personality traits that drive how a rival reacts and evolves. */
export type RivalTrait =
  | "vengeful"
  | "honorable"
  | "opportunist"
  | "paranoid"
  | "expansionist"
  | "cunning"
  | "ruthless"
  | "stoic"
  | "zealous"
  | "pragmatic";

export interface RivalTraitDef {
  id: RivalTrait;
  label: string;
  description: string;
}

/** Where a rival stands with you, from vendetta to alliance. Evolves over time. */
export type DiplomaticStance =
  | "nemesis"
  | "adversary"
  | "rival"
  | "competitor"
  | "partner"
  | "ally";

/** A remembered interaction. Positive weight = boon, negative = slight. */
export type MemoryKind = "slight" | "boon" | "clash" | "pact" | "milestone" | "betrayal";

export interface RivalMemory {
  turn: number;
  kind: MemoryKind;
  text: string;
  /** Signed magnitude of the memory's emotional weight. */
  weight: number;
}

export interface Rival {
  id: string;
  factionId: string;
  leaderName: string;
  /** Evolves with rank and stance — a Nemesis earns an epithet. */
  title: string;
  traits: RivalTrait[];
  /** Their own dominant ideological leaning. */
  ideologyLean: IdeologyAxis;

  // Power hierarchy
  /** Standing in the interstellar pecking order (their colony's strength). */
  power: number;
  /** 1 = strongest. Recomputed each turn. */
  rank: number;

  // Relationship with the player
  /** -100 (vendetta) … +100 (devoted ally). */
  disposition: number;
  stance: DiplomaticStance;
  /** Unavenged slights; high grudge tips a rival into becoming your Nemesis. */
  grudge: number;
  /** Unrepaid favors; honorable rivals pay these back. */
  debt: number;
  memories: RivalMemory[];

  // Relationships with the OTHER rivals: rivalId -> score (-100 … +100).
  relations: Record<string, number>;

  alive: boolean;
  eliminatedTurn?: number;
  /** True once a fallen faction has produced a successor leader. */
  resurfaced?: boolean;
}

/** A choice the player can make in response to a diplomatic overture. */
export interface DiplomaticOption {
  id: string;
  label: string;
}

export type DiplomaticEventKind =
  | "taunt"
  | "offer_pact"
  | "offer_aid"
  | "demand_tribute"
  | "threat"
  | "betrayal";

/** An overture from a rival awaiting the player's response. */
export interface DiplomaticEvent {
  id: string;
  rivalId: string;
  kind: DiplomaticEventKind;
  text: string;
  options: DiplomaticOption[];
}

/** A diplomatic action the player can initiate toward a rival. */
export type DiplomaticAction = "pact" | "aid" | "denounce" | "sabotage";

/** Earth, which becomes a diplomatic actor in the independence endgame. */
export interface EarthState {
  /** Sentiment toward the colony's autonomy, -100 … 100. */
  stance: number;
  present: boolean;
}

// ---------------------------------------------------------------------------
// The Stillness — the counter-terraforming antagonist.
//
// Not a rival corporation: a zealot movement that holds the dead world sacred
// and works to unmake everything the factions build. Its win condition is the
// inverse of yours — drag a wakening planet back down toward silence.
// ---------------------------------------------------------------------------

export interface AntagonistState {
  /** The Stillness stays hidden until terraforming visibly succeeds. */
  awakened: boolean;
  awakenedTurn?: number;
  /** 0–100. Drives how often and how hard they strike. Grows with your
   *  terraforming success; reduced by strikes and appeasement. */
  threat: number;
  /** Turns of reduced aggression bought by funding their enclaves. */
  appeasedTurns: number;
  /** Highest habitability the planet has reached — their victory measures the fall. */
  peakHabitability: number;
  /** Count of successful counter-terraforming strikes ("quietings"). */
  quietings: number;
}

// ---------------------------------------------------------------------------
// Game phases — the defining arc: corporate terraforming slowly becomes a
// civilization with its own identity and, eventually, its own sovereignty.
// ---------------------------------------------------------------------------

export type GamePhase = "corporate" | "settlement" | "ideological" | "independence";

export interface PhaseDef {
  key: GamePhase;
  name: string;
  tagline: string;
  description: string;
  /** Human-readable systems this phase brings online. */
  unlocks: string[];
}

// ---------------------------------------------------------------------------
// Ideology — not chosen up front, but accreted from years of decisions.
// ---------------------------------------------------------------------------

export type IdeologyAxis =
  | "technocratic"
  | "ecological"
  | "industrialist"
  | "militarist"
  | "humanist";

export interface IdeologyDef {
  key: IdeologyAxis;
  name: string;
  blurb: string;
  advantages: string[];
  disadvantages: string[];
  /** Production multipliers applied while this is the dominant ideology. */
  modifiers: ProductionModifiers;
  /** Flat per-turn stability delta while dominant. */
  stability: number;
}

/** Accumulated ideology "pressure" across the five leanings. Dominant = argmax. */
export type IdeologyVector = Record<IdeologyAxis, number>;

// ---------------------------------------------------------------------------
// Social engineering — tunable policy, not a fixed government.
// ---------------------------------------------------------------------------

export type PolicyAxisKey =
  | "economy"
  | "society"
  | "science"
  | "environment"
  | "security";

export interface PolicyOption {
  id: string;
  label: string;
  description: string;
  /** Production multipliers this option imposes. */
  modifiers: ProductionModifiers;
  /** Flat per-turn stability delta. */
  stability?: number;
  /** Ideology pressure this option applies each turn. */
  leanings?: Partial<IdeologyVector>;
  /** Per-turn interest-group satisfaction deltas. */
  groups?: Partial<Record<InterestGroupKey, number>>;
}

export interface PolicyAxis {
  key: PolicyAxisKey;
  label: string;
  description: string;
  options: PolicyOption[];
  /** id of the default option. */
  defaultOption: string;
}

/** The player's current selection: one option id per axis. */
export type PolicySelection = Record<PolicyAxisKey, string>;

// ---------------------------------------------------------------------------
// Internal politics — interest groups that must be kept (roughly) content.
// ---------------------------------------------------------------------------

export type InterestGroupKey =
  | "scientists"
  | "workers"
  | "environmentalists"
  | "security"
  | "shareholders";

export interface InterestGroupDef {
  key: InterestGroupKey;
  name: string;
  wants: string;
}

export interface InterestGroup {
  key: InterestGroupKey;
  /** 0–100. Low satisfaction breeds unrest and stability loss. */
  satisfaction: number;
}

// ---------------------------------------------------------------------------
// Colonists as characters — memorable individuals who emerge from the colony.
// ---------------------------------------------------------------------------

export interface CharacterTrait {
  id: string;
  label: string;
  /** Flavor of what the trait does. */
  effect: string;
  /** Optional permanent production nudge applied when the character appears. */
  production?: Partial<Production>;
  /** Optional ideology pressure the character represents. */
  leaning?: IdeologyAxis;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  age: number;
  bornTurn: number;
  traits: CharacterTrait[];
  bio: string;
}

// ---------------------------------------------------------------------------
// Scientific breakthroughs — discoveries that reshape the whole game.
// ---------------------------------------------------------------------------

export interface Breakthrough {
  id: string;
  name: string;
  description: string;
  /** Fires once its trigger conditions are met. */
  requiresTech?: string;
  requiresPhase?: GamePhase;
  requiresHabitability?: number;
  /** Permanent production change when it lands. */
  productionEffects?: Partial<Production>;
  /** Chronicle line recorded when it fires. */
  chronicle: string;
}

// ---------------------------------------------------------------------------
// History / chronicle — the game's central record. Distinct from the rolling
// event log: these are the landmark moments that become the planet's history.
// ---------------------------------------------------------------------------

export type ChronicleCategory =
  | "phase"
  | "milestone"
  | "person"
  | "breakthrough"
  | "crisis"
  | "politics";

export interface ChronicleEntry {
  turn: number;
  phase: GamePhase;
  category: ChronicleCategory;
  title: string;
  detail: string;
}

/** The endgame question the independence phase poses. */
export type IndependenceOutcome = "colony" | "autonomy" | "independent";

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
  rivals: Rival[];
  /** Diplomatic overtures from rivals awaiting the player's response. */
  pendingDiplomacy: DiplomaticEvent[];
  /** Earth as a diplomatic actor (activates in the independence phase). */
  earth: EarthState;
  /** The Stillness — the counter-terraforming antagonist. */
  antagonist: AntagonistState;
  log: LogEntry[];
  gameOver?: "won" | "lost";

  // --- Civilization layer (unfolds as the game evolves) ------------------
  /** Current phase of the corporate-to-civilization arc. */
  phase: GamePhase;
  /** Accumulated ideological pressure; the dominant leaning gains effects. */
  ideology: IdeologyVector;
  /** Current social-engineering policy selection (one option per axis). */
  policies: PolicySelection;
  /** Internal interest groups and their satisfaction. */
  interestGroups: InterestGroup[];
  /** Notable colonists who have emerged. */
  characters: Character[];
  /** World-changing discoveries that have fired. */
  breakthroughs: string[];
  /** The planet's landmark history — the central record. */
  chronicle: ChronicleEntry[];
  /** One-time milestone flags (firstOcean, firstBreath, …) to fire history once. */
  milestones: Record<string, boolean>;
  /** Resolution of the independence question, once taken. */
  independenceOutcome?: IndependenceOutcome;
}
