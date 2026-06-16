import { describe, expect, it } from "vitest";
import { nextFloat, rollDice, rollDie, seedRng } from "../rng.ts";

describe("rng", () => {
  it("is deterministic for a given seed", () => {
    const a = nextFloat(seedRng(123));
    const b = nextFloat(seedRng(123));
    expect(a.value).toBe(b.value);
    expect(a.state).toBe(b.state);
  });

  it("produces different streams for different seeds", () => {
    const a = nextFloat(seedRng(1));
    const b = nextFloat(seedRng(2));
    expect(a.value).not.toBe(b.value);
  });

  it("never returns a zero state from a zero seed", () => {
    expect(seedRng(0)).not.toBe(0);
  });

  it("rolls dice within [1, sides]", () => {
    let state = seedRng(42);
    for (let i = 0; i < 1000; i++) {
      const r = rollDie(state);
      expect(r.value).toBeGreaterThanOrEqual(1);
      expect(r.value).toBeLessThanOrEqual(6);
      state = r.state;
    }
  });

  it("returns dice sorted descending", () => {
    const { values } = rollDice(seedRng(7), 3);
    expect(values).toHaveLength(3);
    expect(values[0]).toBeGreaterThanOrEqual(values[1]);
    expect(values[1]).toBeGreaterThanOrEqual(values[2]);
  });

  it("covers the full face range over many rolls", () => {
    const seen = new Set<number>();
    let state = seedRng(99);
    for (let i = 0; i < 500; i++) {
      const r = rollDie(state);
      seen.add(r.value);
      state = r.state;
    }
    expect(seen).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });
});
