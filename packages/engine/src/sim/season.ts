/**
 * Season orchestration: fixture generation (double round-robin), running
 * a round of games, and maintaining standings.
 */
import {
  Division,
  Fixture,
  GameState,
  Rng,
  Season,
  StandingRow,
} from '@eurobasqet/data';
import { simulateGame } from './game.js';

/** Circle-method round-robin, then mirrored for home/away legs. */
function roundRobin(divisionId: string, teamIds: string[], rng: Rng): Fixture[] {
  const ids = rng.shuffle([...teamIds]);
  if (ids.length % 2 === 1) ids.push('__BYE__');

  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;
  const fixtures: Fixture[] = [];
  let fixtureNo = 0;

  const rotation = [...ids];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const home = rotation[i]!;
      const away = rotation[n - 1 - i]!;
      if (home === '__BYE__' || away === '__BYE__') continue;
      // First leg.
      fixtures.push({
        id: `fx_${divisionId}_${fixtureNo++}`,
        round: r + 1,
        divisionId,
        homeTeamId: home,
        awayTeamId: away,
      });
      // Return leg in the second half of the season.
      fixtures.push({
        id: `fx_${divisionId}_${fixtureNo++}`,
        round: rounds + r + 1,
        divisionId,
        homeTeamId: away,
        awayTeamId: home,
      });
    }
    // Rotate all but the first element.
    rotation.splice(1, 0, rotation.pop()!);
  }

  return fixtures.sort((a, b) => a.round - b.round);
}

function emptyStandings(teamIds: string[]): StandingRow[] {
  return teamIds.map((teamId) => ({
    teamId,
    played: 0,
    won: 0,
    lost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    leaguePoints: 0,
  }));
}

/** Build a fresh, unplayed season for the given pyramid. */
export function createSeason(
  index: number,
  label: string,
  divisions: Division[],
  rng: Rng,
): Season {
  const fixtures: Fixture[] = [];
  const standings: Record<string, StandingRow[]> = {};
  for (const div of divisions) {
    fixtures.push(...roundRobin(div.id, div.teamIds, rng));
    standings[div.id] = emptyStandings(div.teamIds);
  }
  return { index, label, fixtures, standings, completed: false };
}

function applyResult(rows: StandingRow[], fixture: Fixture): void {
  const r = fixture.result!;
  const home = rows.find((x) => x.teamId === fixture.homeTeamId);
  const away = rows.find((x) => x.teamId === fixture.awayTeamId);
  if (!home || !away) return;
  const homeWon = r.homeScore > r.awayScore;

  home.played += 1;
  away.played += 1;
  home.pointsFor += r.homeScore;
  home.pointsAgainst += r.awayScore;
  away.pointsFor += r.awayScore;
  away.pointsAgainst += r.homeScore;

  if (homeWon) {
    home.won += 1;
    away.lost += 1;
    home.leaguePoints += 2;
    away.leaguePoints += 1;
  } else {
    away.won += 1;
    home.lost += 1;
    away.leaguePoints += 2;
    home.leaguePoints += 1;
  }
}

/** EuroLeague-style ordering: league points, then head-to-head-ish point diff. */
export function sortStandings(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
    const diffA = a.pointsFor - a.pointsAgainst;
    const diffB = b.pointsFor - b.pointsAgainst;
    if (diffB !== diffA) return diffB - diffA;
    return b.pointsFor - a.pointsFor;
  });
}

/** Simulate every not-yet-played fixture in a single round. */
export function simulateRound(state: GameState, round: number, rng: Rng): void {
  const { season, teams, players } = state;
  const playersByTeam = new Map<string, typeof players[string][]>();
  const rosterFor = (teamId: string) => {
    let list = playersByTeam.get(teamId);
    if (!list) {
      const team = teams[teamId]!;
      list = team.playerIds.map((id) => players[id]!).filter(Boolean);
      playersByTeam.set(teamId, list);
    }
    return list;
  };

  for (const fixture of season.fixtures) {
    if (fixture.round !== round || fixture.result) continue;
    const home = teams[fixture.homeTeamId]!;
    const away = teams[fixture.awayTeamId]!;
    fixture.result = simulateGame(home, away, rosterFor(home.id), rosterFor(away.id), rng);
    applyResult(season.standings[fixture.divisionId]!, fixture);
  }
}

/** Highest round number present in the schedule. */
export function totalRounds(season: Season): number {
  return season.fixtures.reduce((max, f) => Math.max(max, f.round), 0);
}

/** Simulate all remaining rounds and mark the season complete. */
export function simulateRestOfSeason(state: GameState, rng: Rng): void {
  const last = totalRounds(state.season);
  for (let r = 1; r <= last; r++) simulateRound(state, r, rng);
  for (const divId of Object.keys(state.season.standings)) {
    state.season.standings[divId] = sortStandings(state.season.standings[divId]!);
  }
  state.season.completed = true;
}
