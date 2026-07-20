import type { Difficulty, Vec2 } from "../types";
import { GRAVITY, launchVelocity } from "./Physics";
import type { Terrain } from "./Terrain";
import type { Tank } from "./Tank";
import { getWeapon } from "./Weapons";
import { getItem } from "./Items";

export interface Shot {
  angle: number;
  power: number;
  weaponId: string;
}

const DIFFICULTY: Record<
  Difficulty,
  { angleJitter: number; powerJitter: number; samples: number }
> = {
  // Bigger jitter = sloppier aim. Hard players barely miss.
  easy: { angleJitter: 9, powerJitter: 12, samples: 28 },
  normal: { angleJitter: 4, powerJitter: 5, samples: 40 },
  hard: { angleJitter: 1.2, powerJitter: 1.5, samples: 56 },
};

/**
 * Plan a shot by sampling many (angle, power) candidates, simulating each
 * trajectory, and keeping the one whose path passes closest to the target.
 * Cheap (a few thousand integration steps) and robust to wind & terrain.
 */
export function planShot(
  shooter: Tank,
  enemies: Tank[],
  terrain: Terrain,
  wind: number,
  rng: () => number,
  maxSpeed: number,
): Shot | null {
  const targets = enemies.filter((t) => t.alive);
  if (targets.length === 0) return null;

  // Aim at the nearest enemy.
  const target = targets.reduce((a, b) =>
    Math.abs(b.x - shooter.x) < Math.abs(a.x - shooter.x) ? b : a,
  );
  const aimPoint: Vec2 = { x: target.x, y: target.y - 6 };
  const facingRight = target.x >= shooter.x;

  const cfg = DIFFICULTY[shooter.difficulty];
  const weaponId = pickWeapon(shooter, Math.abs(target.x - shooter.x));
  const muzzle = shooter.muzzle();

  let best: Shot | null = null;
  let bestMiss = Infinity;

  const N = cfg.samples;
  for (let i = 0; i < N; i++) {
    // Bias the angle sweep toward the side the target is on.
    const lo = facingRight ? 5 : 95;
    const hi = facingRight ? 85 : 175;
    const angle = lo + (hi - lo) * (i / (N - 1));
    for (let p = 30; p <= 100; p += 7) {
      const miss = simulateMiss(muzzle, angle, p, terrain, wind, aimPoint, maxSpeed);
      if (miss < bestMiss) {
        bestMiss = miss;
        best = { angle, power: p, weaponId };
      }
    }
  }

  if (!best) return null;

  // Degrade accuracy according to difficulty.
  best.angle = clamp(best.angle + (rng() * 2 - 1) * cfg.angleJitter, 1, 179);
  best.power = clamp(best.power + (rng() * 2 - 1) * cfg.powerJitter, 5, 100);
  return best;
}

/** Lowest-cost owned weapon that fits the situation. */
function pickWeapon(shooter: Tank, range: number): string {
  const owned = shooter
    .usableWeapons()
    .map(getWeapon)
    .filter((w) => w.kind !== "dirt"); // dirt is defensive; don't lob it at foes
  if (owned.length === 0) return "baby";

  // Close-range or low on health: bring out the biggest blast we own.
  const desperate = shooter.health < 35 || range < 220;
  owned.sort((a, b) =>
    desperate ? b.radius - a.radius : a.price - b.price || b.radius - a.radius,
  );
  // Save the very expensive ordnance unless desperate.
  if (!desperate) {
    const cheap = owned.find((w) => w.price < 8000) ?? owned[0];
    return cheap.id;
  }
  return owned[0].id;
}

/**
 * Integrate one candidate trajectory and return the closest distance its path
 * comes to the aim point. Stops on terrain impact or leaving the field.
 */
function simulateMiss(
  start: Vec2,
  angle: number,
  power: number,
  terrain: Terrain,
  wind: number,
  aim: Vec2,
  maxSpeed: number,
): number {
  const v = launchVelocity(angle, power, maxSpeed);
  let x = start.x;
  let y = start.y;
  let vx = v.x;
  let vy = v.y;
  const dt = 1 / 60;
  let closest = Infinity;

  for (let step = 0; step < 1200; step++) {
    vx += wind * dt;
    vy += GRAVITY * dt;
    x += vx * dt;
    y += vy * dt;

    const d = Math.hypot(x - aim.x, y - aim.y);
    if (d < closest) closest = d;

    if (x < -40 || x > terrain.width + 40 || y > terrain.height + 40) break;
    if (terrain.isSolid(x, y)) break;
  }
  return closest;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Spend an AI tank's winnings between rounds (simple greedy budget). */
export function aiBuy(tank: Tank, rng: () => number): void {
  // Top up defences first — a shield and a spare parachute if affordable.
  const shield = getItem("shield");
  if (tank.shield < shield.cap * 0.6 && tank.cash >= shield.price) {
    tank.cash -= shield.price;
    tank.shield = Math.min(shield.cap, tank.shield + shield.amount);
  }
  const para = getItem("parachute");
  if (tank.parachutes < 2 && tank.cash >= para.price) {
    tank.cash -= para.price;
    tank.parachutes += 1;
  }

  // Then stock mid-tier ordnance; splurge on a nuke occasionally.
  const wishlist = rng() < 0.3 ? ["nuke", "missile", "dirt"] : ["missile", "funky", "dirt"];
  let guard = 0;
  while (guard++ < 30) {
    let bought = false;
    for (const id of wishlist) {
      const w = getWeapon(id);
      if (tank.cash >= w.price && (tank.inventory[id] ?? 0) < 6) {
        tank.cash -= w.price;
        tank.inventory[id] = (tank.inventory[id] ?? 0) + 1;
        bought = true;
      }
    }
    if (!bought) break;
  }
}
