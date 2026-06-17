/**
 * Deterministic, seedable pseudo-random number generator (mulberry32).
 *
 * The RNG state lives inside `GameState` so that an identical sequence of
 * actions always produces an identical game. That makes battles unit-testable,
 * supports replays, and lets a future server validate clients deterministically.
 *
 * State is an unsigned 32-bit integer. Each draw returns the next value and the
 * advanced state; nothing mutates in place. (Shared verbatim with the Dominion
 * branch so both engines behave identically.)
 */

export interface RngDraw {
  /** Float in [0, 1). */
  value: number;
  /** The advanced RNG state to thread into the next draw. */
  state: number;
}

/** Produce a starting RNG state from an arbitrary seed. */
export function seedRng(seed: number): number {
  const s = seed >>> 0;
  return s === 0 ? 0x9e3779b9 : s;
}

/** Draw the next float in [0, 1) and return the advanced state. */
export function nextFloat(state: number): RngDraw {
  let t = (state + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: t >>> 0 };
}

/** Roll one die with `sides` faces (default 6), returning the value and new state. */
export function rollDie(state: number, sides = 6): { value: number; state: number } {
  const draw = nextFloat(state);
  return { value: 1 + Math.floor(draw.value * sides), state: draw.state };
}

/** Draw an integer in [min, max] inclusive. */
export function rollRange(state: number, min: number, max: number): { value: number; state: number } {
  const draw = nextFloat(state);
  return { value: min + Math.floor(draw.value * (max - min + 1)), state: draw.state };
}
