/**
 * Procedural generation of players, squads and a full league pyramid.
 * Everything is driven by an `Rng` instance so a seed fully determines
 * the generated world.
 */
import { NATIONS } from './names.js';
import { Rng } from './rng.js';
import {
  Attributes,
  Division,
  POSITIONS,
  Player,
  Position,
  Pyramid,
  Team,
} from './schema.js';

let counter = 0;
/** Deterministic-ish id — combined with the seed this stays stable per run. */
function makeId(prefix: string, rng: Rng): string {
  counter += 1;
  return `${prefix}_${rng.int(0, 0xffffff).toString(16)}${counter.toString(36)}`;
}

/** Positional bias so a centre rebounds and a guard playmakes. */
const POSITION_BIAS: Record<Position, Partial<Attributes>> = {
  PG: { playmaking: 12, shooting: 6, athleticism: 6, rebounding: -10, inside: -8 },
  SG: { shooting: 12, playmaking: 4, athleticism: 6, rebounding: -6, inside: -4 },
  SF: { shooting: 4, athleticism: 6, defense: 4 },
  PF: { inside: 8, rebounding: 8, defense: 4, playmaking: -6, shooting: -2 },
  C: { inside: 12, rebounding: 14, defense: 6, playmaking: -12, shooting: -8 },
};

function clamp(v: number, lo = 25, hi = 99): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

export function generatePlayer(rng: Rng, teamId: string, tier: number): Player {
  const nation = rng.pick(NATIONS);
  const position = rng.pick(POSITIONS);
  const age = rng.int(18, 35);

  // Lower tiers field weaker rosters on average.
  const base = 62 - (tier - 1) * 7;
  const bias = POSITION_BIAS[position];

  const roll = (key: keyof Attributes): number =>
    clamp(rng.gaussian(base, 12) + (bias[key] ?? 0));

  const attributes: Attributes = {
    shooting: roll('shooting'),
    inside: roll('inside'),
    playmaking: roll('playmaking'),
    rebounding: roll('rebounding'),
    defense: roll('defense'),
    athleticism: roll('athleticism'),
    stamina: clamp(rng.gaussian(75, 10)),
    iq: clamp(rng.gaussian(base, 10)),
  };

  const currentBest = Math.max(...Object.values(attributes));
  // Young players carry more room to grow.
  const growth = age <= 23 ? rng.int(6, 20) : rng.int(0, 6);
  const potential = clamp(currentBest + growth);

  return {
    id: makeId('ply', rng),
    firstName: rng.pick(nation.first),
    lastName: rng.pick(nation.last),
    nationality: nation.code,
    age,
    position,
    attributes,
    potential,
    morale: rng.int(55, 85),
    form: 0,
    teamId,
    contract: {
      wage: clamp(base * 8 + rng.int(0, 400), 40, 4000),
      expiresSeason: rng.int(1, 4),
      developmental: false,
    },
  };
}

export interface GeneratedWorld {
  pyramid: Pyramid;
  teams: Team[];
  players: Player[];
}

const CLUB_STEMS = [
  'Olympia', 'Real', 'Dynamo', 'Estrella', 'Lokomotiv', 'Partizan', 'Zenit',
  'Aris', 'Baskonia', 'Panathinaikos', 'Crvena', 'Alba', 'Virtus', 'Zalgiris',
  'Maccabi', 'Fenerbahce', 'Efes', 'Unicaja', 'Joventut', 'Buducnost',
  'Bayern', 'Milano', 'Bologna', 'Valencia', 'Malaga', 'Kaunas', 'Vitoria',
];

/**
 * Build a full country pyramid: `tiers` divisions of `teamsPerDivision`
 * teams each, wiring one reserve/developmental squad per top-tier club.
 */
export function generatePyramid(
  seed: number,
  opts: {
    country?: string;
    tiers?: number;
    teamsPerDivision?: number;
    rosterSize?: number;
  } = {},
): GeneratedWorld {
  const rng = new Rng(seed);
  const country = opts.country ?? 'Europa';
  const tiers = opts.tiers ?? 3;
  const teamsPerDivision = opts.teamsPerDivision ?? 8;
  const rosterSize = opts.rosterSize ?? 12;

  const teams: Team[] = [];
  const players: Player[] = [];
  const divisions: Division[] = [];
  const stems = rng.shuffle([...CLUB_STEMS]);
  let stemIdx = 0;

  const buildRoster = (team: Team, tier: number, size: number, dev: boolean) => {
    for (let i = 0; i < size; i++) {
      const player = generatePlayer(rng, team.id, tier);
      if (dev) {
        player.age = rng.int(17, 21);
        player.contract.developmental = true;
      }
      team.playerIds.push(player.id);
      players.push(player);
    }
  };

  for (let tier = 1; tier <= tiers; tier++) {
    const divTeams: Team[] = [];
    for (let i = 0; i < teamsPerDivision; i++) {
      const stem = stems[stemIdx++ % stems.length]!;
      const city = `${stem} City`;
      const name = `${stem} ${tier === 1 ? 'BC' : `Tier ${tier}`}`;
      const team: Team = {
        id: makeId('tm', rng),
        name,
        abbreviation: stem.slice(0, 3).toUpperCase(),
        city,
        country,
        tier,
        playerIds: [],
        finances: {
          balance: (tiers - tier + 1) * 2000 + rng.int(0, 1500),
          income: (tiers - tier + 1) * 300,
          wageBudget: (tiers - tier + 1) * 4000,
        },
        isReserve: false,
      };
      buildRoster(team, tier, rosterSize, false);
      teams.push(team);
      divTeams.push(team);
    }

    divisions.push({
      id: `div_t${tier}`,
      name: tier === 1 ? `${country} Superliga` : `${country} Division ${tier}`,
      country,
      tier,
      teamIds: divTeams.map((t) => t.id),
      promotionSlots: tier === 1 ? 0 : 2,
      relegationSlots: tier === tiers ? 0 : 2,
    });
  }

  // Attach a developmental squad to every top-flight club. Reserve teams
  // live in the bottom division but can never promote past their seniors.
  const bottom = divisions[divisions.length - 1]!;
  for (const senior of teams.filter((t) => t.tier === 1)) {
    const reserve: Team = {
      id: makeId('tm', rng),
      name: `${senior.name} II`,
      abbreviation: `${senior.abbreviation}2`,
      city: senior.city,
      country,
      tier: tiers,
      playerIds: [],
      finances: { balance: 200, income: 40, wageBudget: 600 },
      isReserve: true,
      seniorTeamId: senior.id,
    };
    buildRoster(reserve, tiers, rosterSize, true);
    senior.reserveTeamId = reserve.id;
    teams.push(reserve);
    bottom.teamIds.push(reserve.id);
  }

  return {
    pyramid: { country, divisions },
    teams,
    players,
  };
}
