import { describe, it, expect } from "vitest";
import { nextFloat, rollDie, rollRange, seedRng } from "../rng.ts";

describe("rng", () => {
  it("is deterministic for a fixed seed", () => {
    const a: number[] = [];
    const b: number[] = [];
    let sa = seedRng(42);
    let sb = seedRng(42);
    for (let i = 0; i < 100; i++) {
      const ra = nextFloat(sa);
      const rb = nextFloat(sb);
      a.push(ra.value);
      b.push(rb.value);
      sa = ra.state;
      sb = rb.state;
    }
    expect(a).toEqual(b);
  });

  it("never sticks at zero", () => {
    expect(seedRng(0)).not.toBe(0);
  });

  it("rolls dice within range", () => {
    let s = seedRng(7);
    for (let i = 0; i < 500; i++) {
      const r = rollDie(s, 6);
      expect(r.value).toBeGreaterThanOrEqual(1);
      expect(r.value).toBeLessThanOrEqual(6);
      s = r.state;
    }
  });

  it("rollRange respects inclusive bounds", () => {
    let s = seedRng(99);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const r = rollRange(s, 3, 8);
      expect(r.value).toBeGreaterThanOrEqual(3);
      expect(r.value).toBeLessThanOrEqual(8);
      seen.add(r.value);
      s = r.state;
    }
    expect(seen).toEqual(new Set([3, 4, 5, 6, 7, 8]));
  });
});
