import type { Vec2 } from "../types";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  /** Debris is dragged down by gravity and settles; sparks just fade. */
  heavy: boolean;
}

const GRAVITY = 900;
const MAX_PARTICLES = 600;

/** Lightweight particle field for explosion sparks and terrain debris. */
export class ParticleField {
  items: Particle[] = [];

  private rng: () => number;
  constructor(rng: () => number) {
    this.rng = rng;
  }

  /** Bright sparks bursting outward from a blast. */
  spawnSparks(at: Vec2, count: number, baseColor: string, speed: number): void {
    for (let i = 0; i < count; i++) {
      const a = this.rng() * Math.PI * 2;
      const s = speed * (0.3 + this.rng() * 0.7);
      this.push({
        x: at.x,
        y: at.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - speed * 0.3,
        life: 0.4 + this.rng() * 0.4,
        maxLife: 0.8,
        size: 1.5 + this.rng() * 2.5,
        color: baseColor,
        heavy: false,
      });
    }
  }

  /** Chunks of dirt thrown up by a ground hit. */
  spawnDebris(at: Vec2, count: number, color: string, speed: number): void {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (this.rng() - 0.5) * Math.PI * 0.9;
      const s = speed * (0.4 + this.rng() * 0.8);
      this.push({
        x: at.x,
        y: at.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.7 + this.rng() * 0.6,
        maxLife: 1.3,
        size: 2 + this.rng() * 3,
        color,
        heavy: true,
      });
    }
  }

  private push(p: Particle): void {
    if (this.items.length >= MAX_PARTICLES) this.items.shift();
    this.items.push(p);
  }

  update(dt: number, floorY: number): void {
    for (const p of this.items) {
      if (p.heavy) p.vy += GRAVITY * dt;
      else p.vy += GRAVITY * 0.3 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      // Settle debris that hits the bottom of the world.
      if (p.y > floorY) {
        p.y = floorY;
        p.vx *= 0.4;
        p.vy = 0;
        p.life -= dt * 2;
      }
    }
    this.items = this.items.filter((p) => p.life > 0);
  }

  clear(): void {
    this.items.length = 0;
  }
}
