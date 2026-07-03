/**
 * Headless smoke test of the engine — run with `npm run sim:demo`.
 * Creates a world, simulates three full seasons, and prints champions
 * plus the promotion/relegation churn so you can sanity-check the sim
 * without the UI.
 */
import { Rng } from '@eurobasqet/data';
import { advanceToNextSeason, newGame } from './game.js';
import { overall, teamStrength } from './ratings.js';
import { simulateRestOfSeason, sortStandings } from './sim/season.js';

const state = newGame({ seed: 2026, tiers: 3, teamsPerDivision: 8 });
const userTeam = state.teams[state.userTeamId]!;
console.log(`You are GM of ${userTeam.name} (tier ${userTeam.tier})\n`);

for (let s = 0; s < 3; s++) {
  const rng = new Rng(state.seed + state.season.index * 100);
  simulateRestOfSeason(state, rng);

  const topDiv = state.pyramid.divisions.find((d) => d.tier === 1)!;
  const champRow = sortStandings(state.season.standings[topDiv.id]!)[0]!;
  const champ = state.teams[champRow.teamId]!;
  console.log(
    `Season ${state.season.label}: ${topDiv.name} champion → ${champ.name} ` +
      `(${champRow.won}-${champRow.lost})`,
  );

  const roster = userTeam.playerIds.map((id) => state.players[id]!);
  console.log(
    `  ${userTeam.name}: strength ${teamStrength(roster).toFixed(1)}, ` +
      `best OVR ${Math.max(...roster.map((p) => overall(p.attributes)))}`,
  );

  if (s < 2) {
    const before = new Map(Object.values(state.teams).map((t) => [t.id, t.tier]));
    advanceToNextSeason(state);
    const moved = Object.values(state.teams).filter((t) => before.get(t.id) !== t.tier);
    console.log(`  ${moved.length} promotion/relegation moves`);
  }
}

console.log('\nEngine demo complete.');
