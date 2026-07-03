/**
 * Small, dependency-free seeded PRNG so every simulation is reproducible
 * from a single integer seed. Uses mulberry32 — fast and good enough for
 * a game sim (not for cryptography).
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Force to a 32-bit unsigned integer.
    this.state = seed >>> 0;
  }

  /** Next float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Pick a random element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick called with empty array');
    return items[this.int(0, items.length - 1)]!;
  }

  /** In-place Fisher–Yates shuffle, returned for convenience. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [items[i], items[j]] = [items[j]!, items[i]!];
    }
    return items;
  }

  /** Approximate normal via averaging — mean `mean`, spread `spread`. */
  gaussian(mean: number, spread: number): number {
    const avg = (this.next() + this.next() + this.next()) / 3;
    return mean + (avg - 0.5) * 2 * spread;
  }
}
