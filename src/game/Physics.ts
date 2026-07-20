import type { Vec2 } from "../types";

/**
 * Reference world height. The world is measured in these virtual units, not
 * device pixels, so tanks, terrain, and physics feel identical on every screen
 * and DPI. Width varies with the screen's aspect ratio (see maxSpeedFor).
 */
export const WORLD_HEIGHT = 720;

/** Downward acceleration in world units / s². */
export const GRAVITY = 620;

/** Wind acceleration range (units/s²); a round picks a value in [-MAX, +MAX]. */
export const MAX_WIND = 170;

/** Fixed simulation step. Physics runs at this rate regardless of frame rate. */
export const TIMESTEP = 1 / 120;

/**
 * Initial projectile speed at 100% power, scaled to the field width so that
 * maximum range stays ~1.75× the field width at any aspect ratio. Without this,
 * a narrow portrait field would let every shot fly clean off the map.
 */
export function maxSpeedFor(width: number): number {
  return Math.sqrt(1.755 * width * GRAVITY);
}

/** Map a 0..100 power setting to an initial speed. */
export function powerToSpeed(power: number, maxSpeed: number): number {
  return (Math.max(0, Math.min(100, power)) / 100) * maxSpeed;
}

/**
 * Convert an aim angle (degrees, 0 = east, 90 = straight up) and power into a
 * velocity vector. Screen y grows downward, so "up" is negative y.
 */
export function launchVelocity(
  angleDeg: number,
  power: number,
  maxSpeed: number,
): Vec2 {
  const a = (angleDeg * Math.PI) / 180;
  const speed = powerToSpeed(power, maxSpeed);
  return { x: Math.cos(a) * speed, y: -Math.sin(a) * speed };
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
