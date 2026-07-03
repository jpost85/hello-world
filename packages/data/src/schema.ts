/**
 * Eurobasqet core domain schema.
 *
 * These types are the single source of truth shared by the simulation
 * engine (`@eurobasqet/engine`) and the UI (`@eurobasqet/mobile`).
 * Everything is plain, serialisable data so a full game state can be
 * saved to disk / async-storage and re-hydrated on any platform.
 */

export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';

export const POSITIONS: readonly Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

/**
 * Player ability model. Every rating is on a 0–99 scale.
 * `overall` is derived from these by the engine (see `engine/ratings`).
 */
export interface Attributes {
  /** Perimeter / jump shooting. */
  shooting: number;
  /** Finishing and post scoring near the rim. */
  inside: number;
  /** Passing, ball-handling, shot creation. */
  playmaking: number;
  /** Offensive + defensive rebounding. */
  rebounding: number;
  /** On-ball and team defence. */
  defense: number;
  /** Speed, vertical, strength. */
  athleticism: number;
  /** Minutes a player can carry before fatigue bites. */
  stamina: number;
  /** Basketball IQ — decision quality, positioning. */
  iq: number;
}

export interface Contract {
  /** Wage per season in the game's currency (thousands). */
  wage: number;
  /** Season index (inclusive) the deal runs through. */
  expiresSeason: number;
  /** True while the player is on a developmental / academy deal. */
  developmental: boolean;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  nationality: string;
  age: number;
  position: Position;
  attributes: Attributes;
  /** Ceiling the player can grow toward (0–99). */
  potential: number;
  /** 0–100. Affects development speed and willingness to re-sign. */
  morale: number;
  /** -5..+5 short-term hot/cold streak applied on top of ratings. */
  form: number;
  /** Id of the team that holds the player's registration. */
  teamId: string;
  contract: Contract;
}

export interface Finances {
  /** Cash on hand (thousands). */
  balance: number;
  /** Weekly-ish gate + broadcast income (thousands). */
  income: number;
  /** Total wage bill (thousands). */
  wageBudget: number;
}

export interface Team {
  id: string;
  name: string;
  /** Short display code, e.g. "BAR". */
  abbreviation: string;
  city: string;
  country: string;
  /** Tier the team currently competes in (1 = top flight). */
  tier: number;
  playerIds: string[];
  finances: Finances;
  /** Reserve / developmental squad that feeds this senior team. */
  reserveTeamId?: string;
  /** When set, this team is the reserve squad of `seniorTeamId`. */
  seniorTeamId?: string;
  /** Reserve squads are ineligible for promotion into the senior tier. */
  isReserve: boolean;
}

export interface Division {
  id: string;
  name: string;
  country: string;
  /** 1 = top flight; larger numbers are lower down the pyramid. */
  tier: number;
  teamIds: string[];
  /** How many top teams promote up a tier at season's end. */
  promotionSlots: number;
  /** How many bottom teams relegate down a tier. */
  relegationSlots: number;
}

/** The full competition ladder, ordered top (tier 1) to bottom. */
export interface Pyramid {
  country: string;
  divisions: Division[];
}

export interface Fixture {
  id: string;
  round: number;
  divisionId: string;
  homeTeamId: string;
  awayTeamId: string;
  /** Populated once the fixture has been simulated. */
  result?: GameResult;
}

export interface BoxScoreLine {
  playerId: string;
  points: number;
  rebounds: number;
  assists: number;
  minutes: number;
}

export interface GameResult {
  homeScore: number;
  awayScore: number;
  home: BoxScoreLine[];
  away: BoxScoreLine[];
}

export interface StandingRow {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  /** League points — win = 2, loss = 1 (EuroLeague style). */
  leaguePoints: number;
}

export interface Season {
  /** 0-based season index since the save was created. */
  index: number;
  /** Human label, e.g. "2026–27". */
  label: string;
  fixtures: Fixture[];
  /** Standings keyed by division id. */
  standings: Record<string, StandingRow[]>;
  completed: boolean;
}

/** Top-level, save-able game state. */
export interface GameState {
  /** Seed used to make the whole save reproducible. */
  seed: number;
  /** Team the human GM controls. */
  userTeamId: string;
  pyramid: Pyramid;
  teams: Record<string, Team>;
  players: Record<string, Player>;
  season: Season;
  /** Completed seasons, most recent last. */
  history: Season[];
}
