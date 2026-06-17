import { describe, it, expect } from "vitest";
import { resolveBattle, type BattleInputs } from "../battle.ts";
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
  ...over,
});

const base = (over: Partial<BattleInputs>): BattleInputs => ({
  provinceId: "p",
  attacker: { playerId: "a", troops: 10000 },
  defender: { playerId: "b", troops: 10000 },
  hasRampart: false,
  defenderOrder: 50,
  ...over,
});

describe("resolveBattle", () => {
  it("is deterministic for a given seed", () => {
    const inputs = base({ attacker: { playerId: "a", troops: 12000 } });
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
      const r = resolveBattle(base({ attacker: { playerId: "a", troops: 30000 } }), seedRng(seed));
      if (r.result.captured) wins++;
    }
    expect(wins).toBeGreaterThan(20);
  });

  it("ramparts measurably help the defender", () => {
    const count = (hasRampart: boolean) => {
      let caps = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const r = resolveBattle(base({ attacker: { playerId: "a", troops: 22000 }, hasRampart }), seedRng(seed));
        if (r.result.captured) caps++;
      }
      return caps;
    };
    expect(count(true)).toBeLessThan(count(false));
  });

  it("a strong officer shifts outcomes in the attacker's favour", () => {
    const withHero = (hero: boolean) => {
      let caps = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const r = resolveBattle(
          base({
            attacker: { playerId: "a", troops: 12000, officer: hero ? officer({ war: 99, leadership: 95 }) : undefined },
          }),
          seedRng(seed),
        );
        if (r.result.captured) caps++;
      }
      return caps;
    };
    expect(withHero(true)).toBeGreaterThan(withHero(false));
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
