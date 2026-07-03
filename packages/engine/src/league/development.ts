/**
 * Player development & ageing — the heart of a GM sim built around
 * "building a team of winning players". Runs once per off-season.
 *
 * Young players grow toward their `potential`, gated by morale and minutes;
 * veterans decline. Reserve/developmental squads exist precisely to give
 * prospects the minutes that drive growth.
 */
import { Attributes, GameState, Player, Rng } from '@eurobasqet/data';
import { overall } from '../ratings.js';

const GROWTH_KEYS: (keyof Attributes)[] = [
  'shooting', 'inside', 'playmaking', 'rebounding', 'defense', 'athleticism', 'iq',
];

function clamp(v: number): number {
  return Math.max(25, Math.min(99, Math.round(v)));
}

/** Progress or regress a single player one season. Mutates in place. */
export function developPlayer(player: Player, rng: Rng): void {
  player.age += 1;
  const ovr = overall(player.attributes);
  const room = player.potential - ovr;

  // Morale accelerates growth; developmental deals get a training bonus.
  const moraleFactor = 0.5 + player.morale / 100;
  const devBonus = player.contract.developmental ? 1.4 : 1;

  let delta: number;
  if (player.age <= 23 && room > 0) {
    delta = rng.range(0.4, 2.2) * moraleFactor * devBonus;
  } else if (player.age <= 29) {
    delta = rng.range(-0.4, 0.8);
  } else {
    // Decline steepens with age.
    delta = -rng.range(0.5, 1.2) * (1 + (player.age - 30) * 0.15);
  }

  // Spread the change across a couple of attributes so profiles shift.
  const picks = rng.shuffle([...GROWTH_KEYS]).slice(0, 3);
  for (const key of picks) {
    const attr = player.attributes[key];
    const capped = delta > 0 ? Math.min(delta, Math.max(0, player.potential - attr)) : delta;
    player.attributes[key] = clamp(attr + capped);
  }

  // Athletic decline hits stamina late in a career.
  if (player.age >= 32) {
    player.attributes.stamina = clamp(player.attributes.stamina - rng.range(1, 3));
  }
}

/** Age & develop every player in the world for the coming season. */
export function runOffseasonDevelopment(state: GameState, rng: Rng): void {
  for (const id of Object.keys(state.players)) {
    developPlayer(state.players[id]!, rng);
  }
}

/**
 * Promote the best eligible prospects from a senior club's reserve squad
 * into the senior roster (a "call-up"). Returns the players moved.
 */
export function callUpProspects(
  state: GameState,
  seniorTeamId: string,
  count: number,
  minOverall = 68,
): Player[] {
  const senior = state.teams[seniorTeamId];
  if (!senior?.reserveTeamId) return [];
  const reserve = state.teams[senior.reserveTeamId]!;

  const eligible = reserve.playerIds
    .map((id) => state.players[id]!)
    .filter((p) => overall(p.attributes) >= minOverall)
    .sort((a, b) => overall(b.attributes) - overall(a.attributes))
    .slice(0, count);

  for (const player of eligible) {
    reserve.playerIds = reserve.playerIds.filter((id) => id !== player.id);
    senior.playerIds.push(player.id);
    player.teamId = senior.id;
    player.contract.developmental = false;
  }
  return eligible;
}
