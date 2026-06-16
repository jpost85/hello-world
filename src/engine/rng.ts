/**
 * Deterministic, seedable pseudo-random number generator (mulberry32).
 *
 * The RNG state lives inside `GameState` so that an identical sequence of
 * actions always produces an identical game. That makes combat unit-testable,
 * supports replays, and lets a future server validate clients deterministically.
 *
 * State is an unsigned 32-bit integer. Each draw returns the next value and the
 * advanced state; nothing mutates in place.
 */

export interface RngDraw {
  /** Float in [0, 1). */
  value: number;
  /** The advanced RNG state to thread into the next draw. */
  state: number;
}

/** Produce a starting RNG state from an arbitrary seed. */
export function seedRng(seed: number): number {
  // Force to uint32 and avoid a zero state (which would stick at zero output).
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

/**
 * Roll `count` dice, returning the values sorted descending (highest first,
 * which is the order combat resolution compares them in) and the new state.
 */
export function rollDice(
  state: number,
  count: number,
  sides = 6,
): { values: number[]; state: number } {
  const values: number[] = [];
  let s = state;
  for (let i = 0; i < count; i++) {
    const r = rollDie(s, sides);
    values.push(r.value);
    s = r.state;
  }
  values.sort((a, b) => b - a);
  return { values, state: s };
}
