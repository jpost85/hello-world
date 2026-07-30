/**
 * Burning ground left by napalm. Each blob clings to the terrain surface and
 * slides downhill, scorching whatever it touches, then burns out.
 */
export interface Fire {
  x: number;
  y: number;
  vx: number;
  /** Seconds of burn left. */
  life: number;
  maxLife: number;
  r: number;
  ownerId: number;
}

/** Damage per second a tank takes while standing in fire. */
export const FIRE_DPS = 26;

/** How strongly slopes accelerate a burning blob (world px/s²). */
export const FIRE_SLOPE_ACCEL = 900;

/** Terminal-ish horizontal speed for spreading fire. */
export const FIRE_MAX_SPEED = 170;
