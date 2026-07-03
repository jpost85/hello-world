/**
 * End-of-season promotion & relegation across the pyramid.
 *
 * Reserve/developmental squads are pinned: they never promote out of the
 * bottom tier even if they finish top, mirroring most European reserve-league
 * rules. The slot they would have taken passes to the next eligible club.
 */
import { GameState, Pyramid, Team } from '@eurobasqet/data';
import { sortStandings } from '../sim/season.js';

export interface Movement {
  teamId: string;
  fromTier: number;
  toTier: number;
  kind: 'promotion' | 'relegation';
}

/** Reserve teams are ineligible to promote past their senior side's tier. */
function canPromote(team: Team): boolean {
  return !team.isReserve;
}

/**
 * Compute promotions/relegations from the completed season's standings and
 * mutate each team's `tier` + division membership in place.
 */
export function applyPromotionRelegation(state: GameState): Movement[] {
  const { season, pyramid, teams } = state;
  const movements: Movement[] = [];
  const divisions = [...pyramid.divisions].sort((a, b) => a.tier - b.tier);

  // Decide who moves, per division, before mutating membership.
  const promoteUp = new Map<number, string[]>();
  const relegateDown = new Map<number, string[]>();

  for (const div of divisions) {
    const table = sortStandings(season.standings[div.id] ?? []);

    const promoting = table
      .filter((row) => canPromote(teams[row.teamId]!))
      .slice(0, div.promotionSlots)
      .map((row) => row.teamId);

    const relegating = table
      .slice(-div.relegationSlots || table.length)
      .slice(div.relegationSlots > 0 ? -div.relegationSlots : 0)
      .map((row) => row.teamId);

    promoteUp.set(div.tier, promoting);
    relegateDown.set(div.tier, div.relegationSlots > 0 ? relegating : []);
  }

  const divByTier = new Map(divisions.map((d) => [d.tier, d]));

  const move = (teamId: string, toTier: number, kind: Movement['kind']) => {
    const team = teams[teamId]!;
    const from = divByTier.get(team.tier);
    const to = divByTier.get(toTier);
    if (!from || !to) return;
    from.teamIds = from.teamIds.filter((id) => id !== teamId);
    to.teamIds.push(teamId);
    movements.push({ teamId, fromTier: team.tier, toTier, kind });
    team.tier = toTier;
  };

  // Apply relegations first so promoting teams slot cleanly into the tier above.
  for (const div of divisions) {
    for (const teamId of relegateDown.get(div.tier) ?? []) {
      move(teamId, div.tier + 1, 'relegation');
    }
  }
  for (const div of divisions) {
    for (const teamId of promoteUp.get(div.tier) ?? []) {
      move(teamId, div.tier - 1, 'promotion');
    }
  }

  return movements;
}

/** Convenience: divisions ordered top-to-bottom. */
export function orderedDivisions(pyramid: Pyramid) {
  return [...pyramid.divisions].sort((a, b) => a.tier - b.tier);
}
