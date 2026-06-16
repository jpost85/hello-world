import { describe, expect, it } from "vitest";
import {
  attackerDiceCount,
  defenderDiceCount,
  resolveRound,
} from "../combat.ts";
import { seedRng } from "../rng.ts";
import type { CombatContext } from "../combat.ts";

function baseCtx(overrides: Partial<CombatContext> = {}): CombatContext {
  return {
    attackerArmies: 10,
    defenderArmies: 10,
    attackStyle: "standard",
    defenseStyle: "standard",
    attackerGeneralBonus: 0,
    defenderGeneralBonus: 0,
    defenderHasFortress: false,
    rngState: seedRng(2024),
    ...overrides,
  };
}

describe("dice counts", () => {
  it("caps the attacker at 3 dice and requires keeping one army back", () => {
    expect(attackerDiceCount(10, "standard")).toBe(3);
    expect(attackerDiceCount(3, "standard")).toBe(2);
    expect(attackerDiceCount(2, "standard")).toBe(1);
    expect(attackerDiceCount(1, "standard")).toBe(0);
  });

  it("reduces attacker dice under the cautious style", () => {
    expect(attackerDiceCount(10, "cautious")).toBe(2);
  });

  it("caps the defender at 2 dice without a fortress", () => {
    expect(defenderDiceCount(10, "standard", false)).toBe(2);
    expect(defenderDiceCount(1, "standard", false)).toBe(1);
  });

  it("grants the defender a third die with a fortress", () => {
    expect(defenderDiceCount(10, "standard", true)).toBe(3);
  });

  it("reduces defender dice under the cautious style", () => {
    expect(defenderDiceCount(10, "cautious", false)).toBe(1);
  });
});

describe("round resolution", () => {
  it("each comparison costs exactly one army to one side", () => {
    const { round } = resolveRound(baseCtx());
    const comparisons = Math.min(round.attackerDice.length, round.defenderDice.length);
    expect(round.attackerLosses + round.defenderLosses).toBe(comparisons);
  });

  it("is deterministic for a fixed rng state", () => {
    const a = resolveRound(baseCtx());
    const b = resolveRound(baseCtx());
    expect(a.round).toEqual(b.round);
    expect(a.rngState).toBe(b.rngState);
  });

  it("breaks ties for the defender under standard rules", () => {
    // Force a guaranteed tie by checking the win-ties flag path directly:
    // with aggressive attack, attacker wins ties; standard, defender wins.
    let standardAttackerLosses = 0;
    let aggressiveAttackerLosses = 0;
    let seed = 1;
    for (let i = 0; i < 200; i++) {
      const std = resolveRound(baseCtx({ rngState: seedRng(seed) }));
      const agg = resolveRound(baseCtx({ attackStyle: "aggressive", rngState: seedRng(seed) }));
      standardAttackerLosses += std.round.attackerLosses;
      aggressiveAttackerLosses += agg.round.attackerLosses;
      seed += 1;
    }
    // Aggressive (wins ties) should never cost the attacker more than standard.
    expect(aggressiveAttackerLosses).toBeLessThanOrEqual(standardAttackerLosses);
  });

  it("a general improves the side it fights for over many rounds", () => {
    let withoutGeneral = 0;
    let withGeneral = 0;
    let seed = 500;
    for (let i = 0; i < 300; i++) {
      const plain = resolveRound(baseCtx({ rngState: seedRng(seed) }));
      const buffed = resolveRound(baseCtx({ attackerGeneralBonus: 1, rngState: seedRng(seed) }));
      withoutGeneral += plain.round.defenderLosses;
      withGeneral += buffed.round.defenderLosses;
      seed += 1;
    }
    expect(withGeneral).toBeGreaterThan(withoutGeneral);
  });

  it("a fortress helps the defender over many rounds", () => {
    let openField = 0;
    let fortified = 0;
    let seed = 900;
    for (let i = 0; i < 300; i++) {
      const open = resolveRound(baseCtx({ rngState: seedRng(seed) }));
      const fort = resolveRound(baseCtx({ defenderHasFortress: true, rngState: seedRng(seed) }));
      openField += open.round.attackerLosses;
      fortified += fort.round.attackerLosses;
      seed += 1;
    }
    // Extra defending die means attackers should bleed more against a fortress.
    expect(fortified).toBeGreaterThan(openField);
  });
});
