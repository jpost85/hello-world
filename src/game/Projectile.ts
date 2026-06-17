import type { Vec2, Weapon } from "../types";

/** A single munition in flight. MIRV warheads spawn child Projectiles. */
export class Projectile {
  pos: Vec2;
  vel: Vec2;
  weapon: Weapon;
  ownerId: number;
  alive = true;
  /** True once a MIRV has split, so it only splits once. */
  split = false;
  prevVy = 0;
  /** Recent positions, for drawing a motion trail. */
  trail: Vec2[] = [];

  constructor(pos: Vec2, vel: Vec2, weapon: Weapon, ownerId: number) {
    this.pos = { ...pos };
    this.vel = { ...vel };
    this.weapon = weapon;
    this.ownerId = ownerId;
    this.prevVy = vel.y;
  }

  step(dt: number, wind: number, gravity: number): void {
    this.prevVy = this.vel.y;
    this.vel.x += wind * dt;
    this.vel.y += gravity * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
  }

  /** MIRVs split when they crest (vertical velocity flips downward). */
  shouldSplit(): boolean {
    return (
      this.weapon.kind === "mirv" &&
      !this.split &&
      this.prevVy < 0 &&
      this.vel.y >= 0
    );
  }
}
