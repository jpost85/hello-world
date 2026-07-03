/**
 * Single-game simulation. Deliberately lightweight: a ratings-driven
 * scoring model with a home-court edge and enough variance to produce
 * upsets. Good enough to drive a season; swap for a possession-level
 * model later without changing callers.
 */
import { BoxScoreLine, GameResult, Player, Rng, Team } from '@eurobasqet/data';
import { gameStrength, teamStrength } from '../ratings.js';

const HOME_ADVANTAGE = 3.5;
const LEAGUE_AVG_POINTS = 80;

function distributeBox(players: Player[], teamPoints: number, rng: Rng): BoxScoreLine[] {
  const rotation = [...players]
    .sort((a, b) => gameStrength(b) - gameStrength(a))
    .slice(0, 8);
  const weights = rotation.map((p) => gameStrength(p) + rng.range(0, 20));
  const total = weights.reduce((a, b) => a + b, 0) || 1;

  return rotation.map((p, i) => {
    const share = weights[i]! / total;
    const points = Math.round(teamPoints * share);
    const minutes = Math.round(16 + share * 80);
    return {
      playerId: p.id,
      points,
      rebounds: Math.round(share * teamPoints * 0.35 + rng.range(0, 3)),
      assists: Math.round(share * teamPoints * 0.2 + rng.range(0, 2)),
      minutes: Math.min(40, minutes),
    };
  });
}

export function simulateGame(
  home: Team,
  away: Team,
  homePlayers: Player[],
  awayPlayers: Player[],
  rng: Rng,
): GameResult {
  const homeStr = teamStrength(homePlayers) + HOME_ADVANTAGE;
  const awayStr = teamStrength(awayPlayers);

  // Map a rating gap to a points swing around the league average.
  const gap = homeStr - awayStr;
  const homeExpected = LEAGUE_AVG_POINTS + gap * 0.6 + rng.gaussian(0, 6);
  const awayExpected = LEAGUE_AVG_POINTS - gap * 0.6 + rng.gaussian(0, 6);

  let homeScore = Math.max(50, Math.round(homeExpected));
  let awayScore = Math.max(50, Math.round(awayExpected));

  // No ties in basketball — settle with an overtime bump.
  if (homeScore === awayScore) {
    if (rng.next() < 0.5) homeScore += rng.int(2, 6);
    else awayScore += rng.int(2, 6);
  }

  return {
    homeScore,
    awayScore,
    home: distributeBox(homePlayers, homeScore, rng),
    away: distributeBox(awayPlayers, awayScore, rng),
  };
}
