import type { Vec2 } from "../types";

/** Downward acceleration in world px / s². */
export const GRAVITY = 620;

/** Initial projectile speed (px/s) at 100% power. */
export const MAX_SPEED = 1180;

/** Wind acceleration range (px/s²); a round picks a value in [-MAX, +MAX]. */
export const MAX_WIND = 170;

/** Fixed simulation step. Physics runs at this rate regardless of frame rate. */
export const TIMESTEP = 1 / 120;

/** Map a 0..100 power setting to an initial speed. */
export function powerToSpeed(power: number): number {
  return (Math.max(0, Math.min(100, power)) / 100) * MAX_SPEED;
}

/**
 * Convert an aim angle (degrees, 0 = east, 90 = straight up) and power into a
 * velocity vector. Screen y grows downward, so "up" is negative y.
 */
export function launchVelocity(angleDeg: number, power: number): Vec2 {
  const a = (angleDeg * Math.PI) / 180;
  const speed = powerToSpeed(power);
  return { x: Math.cos(a) * speed, y: -Math.sin(a) * speed };
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
