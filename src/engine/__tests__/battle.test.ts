import { describe, it, expect } from "vitest";
import { resolveBattle, type BattleInputs, type BattleSide } from "../battle.ts";
import { seedRng } from "../rng.ts";
import type { Officer } from "../types.ts";

const officer = (over: Partial<Officer>): Officer => ({
  id: "x",
  name: "X",
  war: 50,
  intellect: 50,
  politics: 50,
  charisma: 50,
  leadership: 50,
  loyalty: 80,
  ownerId: "a",
  provinceId: "p",
  traits: [],
  items: [],
  captiveOf: null,
  alive: true,
  ...over,
});

const side = (over: Partial<BattleSide>): BattleSide => ({
  playerId: "a",
  troops: 10000,
  unitType: "spearmen",
  morale: 60,
  training: 50,
  ...over,
});

const base = (over: Partial<BattleInputs>): BattleInputs => ({
  provinceId: "p",
  attacker: side({ playerId: "a" }),
  defender: side({ playerId: "b" }),
  defenderWallLevel: 0,
  defenderOrder: 50,
  waterCrossing: false,
  ...over,
});

describe("resolveBattle", () => {
  it("is deterministic for a given seed", () => {
    const inputs = base({ attacker: side({ playerId: "a", troops: 12000 }) });
    const r1 = resolveBattle(inputs, seedRng(1));
    const r2 = resolveBattle(inputs, seedRng(1));
    expect(r1.result).toEqual(r2.result);
    expect(r1.rngState).toBe(r2.rngState);
  });

  it("advances the RNG state", () => {
    const seed = seedRng(5);
    const { rngState } = resolveBattle(base({}), seed);
    expect(rngState).not.toBe(seed);
  });

  it("a large numerical edge usually wins the province", () => {
    let wins = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const r = resolveBattle(base({ attacker: side({ playerId: "a", troops: 30000 }) }), seedRng(seed));
      if (r.result.captured) wins++;
    }
    expect(wins).toBeGreaterThan(20);
  });

  it("walls measurably help the defender", () => {
    const count = (wall: number) => {
      let caps = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const r = resolveBattle(base({ attacker: side({ playerId: "a", troops: 22000 }), defenderWallLevel: wall }), seedRng(seed));
        if (r.result.captured) caps++;
      }
      return caps;
    };
    expect(count(5)).toBeLessThan(count(0));
  });

  it("a strong officer shifts outcomes in the attacker's favour", () => {
    const withHero = (hero: boolean) => {
      let caps = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const r = resolveBattle(
          base({
            attacker: side({ playerId: "a", troops: 12000, officer: hero ? officer({ war: 99, leadership: 95 }) : undefined }),
          }),
          seedRng(seed),
        );
        if (r.result.captured) caps++;
      }
      return caps;
    };
    expect(withHero(true)).toBeGreaterThan(withHero(false));
  });

  it("the branch matchup (spear beats cavalry) tilts the odds", () => {
    const caps = (atkType: "spearmen" | "archers") => {
      let c = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const r = resolveBattle(
          base({
            attacker: side({ playerId: "a", troops: 13000, unitType: atkType }),
            defender: side({ playerId: "b", troops: 11000, unitType: "cavalry" }),
          }),
          seedRng(seed),
        );
        if (r.result.captured) c++;
      }
      return c;
    };
    // Spearmen counter cavalry; archers are countered by them.
    expect(caps("spearmen")).toBeGreaterThan(caps("archers"));
  });

  it("higher morale and training win more often", () => {
    const caps = (good: boolean) => {
      let c = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const r = resolveBattle(
          base({
            attacker: side({ playerId: "a", troops: 13000, morale: good ? 100 : 30, training: good ? 100 : 30 }),
            defender: side({ playerId: "b", troops: 12000 }),
          }),
          seedRng(seed),
        );
        if (r.result.captured) c++;
      }
      return c;
    };
    expect(caps(true)).toBeGreaterThan(caps(false));
  });

  it("conserves the no-negative-troops invariant", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = resolveBattle(base({}), seedRng(seed)).result;
      expect(r.attackerTroopsEnd).toBeGreaterThanOrEqual(0);
      expect(r.defenderTroopsEnd).toBeGreaterThanOrEqual(0);
      expect(r.attackerTroopsEnd).toBeLessThanOrEqual(r.attackerTroopsStart);
      expect(r.defenderTroopsEnd).toBeLessThanOrEqual(r.defenderTroopsStart);
    }
  });
});
