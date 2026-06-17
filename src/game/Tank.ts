import type { Difficulty } from "../types";
import { getWeapon } from "./Weapons";
import type { Terrain } from "./Terrain";

export const TANK_BODY_W = 26;
export const TANK_BODY_H = 12;
export const TANK_HIT_RADIUS = 18;
/** Distance from the turret pivot to the muzzle, for rendering & spawn point. */
export const BARREL_LEN = 22;

export class Tank {
  id: number;
  name: string;
  color: string;
  isAI: boolean;
  difficulty: Difficulty;

  x: number; // column (world px)
  y: number; // ground top at x (world px)

  angle = 45; // degrees, 0 = east, 90 = up, 180 = west
  power = 60; // 0..100

  health = 100;
  alive = true;
  cash = 0;
  score = 0; // round wins

  inventory: Record<string, number> = {};
  selectedWeapon = "baby";

  constructor(
    id: number,
    name: string,
    color: string,
    isAI: boolean,
    difficulty: Difficulty,
  ) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.isAI = isAI;
    this.difficulty = difficulty;
    // Face roughly toward centre-of-map; corrected when placed.
    this.x = 0;
    this.y = 0;
  }

  /** Turret pivot point (top-centre of the body). */
  get pivotX(): number {
    return this.x;
  }
  get pivotY(): number {
    return this.y - TANK_BODY_H;
  }

  /** World position of the muzzle, where projectiles spawn. */
  muzzle(): { x: number; y: number } {
    const a = (this.angle * Math.PI) / 180;
    return {
      x: this.pivotX + Math.cos(a) * BARREL_LEN,
      y: this.pivotY - Math.sin(a) * BARREL_LEN,
    };
  }

  ammoOf(id: string): number {
    const w = getWeapon(id);
    if (w.infinite) return Infinity;
    return this.inventory[id] ?? 0;
  }

  /** List of weapon ids the tank can currently fire (infinite or count > 0). */
  usableWeapons(): string[] {
    return Object.keys(this.inventory).filter((id) => this.ammoOf(id) > 0);
  }

  consumeSelected(): void {
    const w = getWeapon(this.selectedWeapon);
    if (w.infinite) return;
    this.inventory[this.selectedWeapon] = Math.max(
      0,
      (this.inventory[this.selectedWeapon] ?? 0) - 1,
    );
    if (this.ammoOf(this.selectedWeapon) <= 0) {
      // Fall back to a weapon we still have (baby missile is infinite).
      const next = this.usableWeapons()[0] ?? "baby";
      this.selectedWeapon = next;
    }
  }

  /** Snap the tank down onto the current ground; returns the fall distance. */
  settle(terrain: Terrain): number {
    const ground = terrain.surfaceAt(this.x);
    const fall = ground - this.y;
    this.y = ground;
    return fall > 0 ? fall : 0;
  }
}
