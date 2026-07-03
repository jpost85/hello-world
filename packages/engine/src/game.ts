/**
 * Top-level game lifecycle: create a new save, and advance from one
 * completed season to the next (development → promotion/relegation →
 * fresh fixtures).
 */
import {
  GameState,
  Player,
  Rng,
  Team,
  generatePyramid,
} from '@eurobasqet/data';
import { runOffseasonDevelopment } from './league/development.js';
import { applyPromotionRelegation } from './league/pyramid.js';
import { createSeason } from './sim/season.js';

export interface NewGameOptions {
  seed?: number;
  country?: string;
  tiers?: number;
  teamsPerDivision?: number;
  /** Which tier the human GM starts in. */
  startTier?: number;
}

function seasonLabel(startYear: number, index: number): string {
  const y = startYear + index;
  return `${y}–${String((y + 1) % 100).padStart(2, '0')}`;
}

/** Build a brand-new game world with the user assigned to a starting club. */
export function newGame(opts: NewGameOptions = {}): GameState {
  const seed = opts.seed ?? 1337;
  const rng = new Rng(seed);
  const world = generatePyramid(seed, {
    country: opts.country,
    tiers: opts.tiers,
    teamsPerDivision: opts.teamsPerDivision,
  });

  const teams: Record<string, Team> = {};
  for (const t of world.teams) teams[t.id] = t;
  const players: Record<string, Player> = {};
  for (const p of world.players) players[p.id] = p;

  const startTier = opts.startTier ?? world.pyramid.divisions.length; // default: bottom
  const userTeam =
    world.teams.find((t) => t.tier === startTier && !t.isReserve) ??
    world.teams[0]!;

  const season = createSeason(0, seasonLabel(2026, 0), world.pyramid.divisions, rng);

  return {
    seed,
    userTeamId: userTeam.id,
    pyramid: world.pyramid,
    teams,
    players,
    season,
    history: [],
  };
}

/**
 * Roll a completed season into the next one. Order matters: develop
 * players, resolve promotion/relegation, then generate new fixtures.
 * Returns the freshly created season.
 */
export function advanceToNextSeason(state: GameState): GameState['season'] {
  if (!state.season.completed) {
    throw new Error('Cannot advance: current season is not complete.');
  }
  const rng = new Rng(state.seed + state.season.index + 1);

  runOffseasonDevelopment(state, rng);
  applyPromotionRelegation(state);

  state.history.push(state.season);
  const nextIndex = state.season.index + 1;
  state.season = createSeason(
    nextIndex,
    seasonLabel(2026, nextIndex),
    state.pyramid.divisions,
    rng,
  );
  return state.season;
}
