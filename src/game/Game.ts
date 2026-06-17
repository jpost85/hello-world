import type { Difficulty, GameState, Vec2 } from "../types";
import { GRAVITY, MAX_WIND, TIMESTEP, launchVelocity } from "./Physics";
import { Terrain, makeRng } from "./Terrain";
import { Tank, TANK_BODY_H, TANK_HIT_RADIUS } from "./Tank";
import { Projectile } from "./Projectile";
import { getWeapon } from "./Weapons";
import { planShot, aiBuy, type Shot } from "./AI";
import {
  STARTING_CASH,
  awardDamage,
  awardKill,
  awardSurvival,
} from "./Economy";

export interface Explosion {
  x: number;
  y: number;
  r: number;
  maxR: number;
  t: number;
  dur: number;
  color: string;
}

export interface MatchConfig {
  opponents: number;
  difficulty: Difficulty;
  rounds: number;
}

const TANK_COLORS = ["#4db8ff", "#ff6b6b", "#7be06b", "#ffd24d", "#c08bff"];
const AI_NAMES = ["Rascal", "Vlad", "Ace", "Tank Sinatra"];

export class Game {
  width: number;
  height: number;
  state: GameState = "menu";

  terrain: Terrain;
  tanks: Tank[] = [];
  projectiles: Projectile[] = [];
  explosions: Explosion[] = [];

  wind = 0;
  round = 0;
  config: MatchConfig = { opponents: 1, difficulty: "normal", rounds: 5 };

  turnIndex = 0;
  startingPlayer = 0;
  current: Tank | null = null;

  /** Sampled trajectory points for the human aim preview. */
  aimLine: Vec2[] = [];

  private rng = makeRng(Date.now() >>> 0);
  private acc = 0;
  private aiTimer = 0;
  private pendingShot: Shot | null = null;
  private resolveTimer = 0;
  private resolved = false;
  private lastHitBy = new Map<number, number>();

  // UI hooks (wired by main.ts).
  onStateChange: ((next: GameState, prev: GameState) => void) | null = null;
  onBanner: ((text: string) => void) | null = null;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.terrain = new Terrain(width, height);
  }

  // ---------------------------------------------------------------- lifecycle

  newMatch(config: MatchConfig): void {
    this.config = config;
    this.rng = makeRng(Date.now() >>> 0);
    this.round = 0;
    this.startingPlayer = 0;
    this.tanks = [];

    // Human player first, then AI opponents.
    this.tanks.push(new Tank(0, "You", TANK_COLORS[0], false, "normal"));
    for (let i = 0; i < config.opponents; i++) {
      this.tanks.push(
        new Tank(
          i + 1,
          AI_NAMES[i % AI_NAMES.length],
          TANK_COLORS[(i + 1) % TANK_COLORS.length],
          true,
          config.difficulty,
        ),
      );
    }

    // Seed inventories and wallets.
    for (const t of this.tanks) {
      t.inventory = {};
      for (const w of [
        getWeapon("baby"),
        getWeapon("missile"),
        getWeapon("dirt"),
      ]) {
        t.inventory[w.id] = w.infinite ? Infinity : w.startCount;
      }
      t.selectedWeapon = "baby";
      t.cash = STARTING_CASH;
      t.score = 0;
    }

    this.startRound();
  }

  startRound(): void {
    this.round += 1;
    this.terrain = new Terrain(this.width, this.height);
    this.terrain.generate(this.rng);
    this.projectiles = [];
    this.explosions = [];
    this.wind = (this.rng() * 2 - 1) * MAX_WIND;

    // Place tanks in evenly spaced lanes with a little jitter.
    const margin = Math.min(90, this.width * 0.08);
    const span = this.width - margin * 2;
    const n = this.tanks.length;
    const order = shuffle(
      this.tanks.map((_, i) => i),
      this.rng,
    );
    order.forEach((tankIdx, lane) => {
      const t = this.tanks[tankIdx];
      const center = margin + span * ((lane + 0.5) / n);
      const jitter = (this.rng() * 2 - 1) * (span / n) * 0.25;
      t.x = clamp(Math.round(center + jitter), margin, this.width - margin);
      t.health = 100;
      t.alive = true;
      t.angle = t.x < this.width / 2 ? 55 : 125;
      t.power = 62;
      t.settle(this.terrain);
      if (t.ammoOf(t.selectedWeapon) <= 0) {
        t.selectedWeapon = t.usableWeapons()[0] ?? "baby";
      }
    });

    this.lastHitBy.clear();
    this.startingPlayer = this.startingPlayer % n;
    this.turnIndex = this.startingPlayer;
    if (!this.tanks[this.turnIndex].alive) this.turnIndex = this.nextAlive(this.turnIndex);
    this.beginTurn();
  }

  private beginTurn(): void {
    this.current = this.tanks[this.turnIndex];
    const t = this.current;
    if (t.ammoOf(t.selectedWeapon) <= 0) {
      t.selectedWeapon = t.usableWeapons()[0] ?? "baby";
    }
    this.recomputeAim();

    if (t.isAI) {
      this.pendingShot = planShot(t, this.enemiesOf(t), this.terrain, this.wind, this.rng);
      this.aiTimer = 0.85;
    } else {
      this.pendingShot = null;
    }
    this.setState("aiming");
  }

  // ------------------------------------------------------------------ input

  get isHumanTurn(): boolean {
    return this.state === "aiming" && !!this.current && !this.current.isAI;
  }

  setAim(angle: number, power: number): void {
    if (!this.isHumanTurn || !this.current) return;
    this.current.angle = clamp(angle, 1, 179);
    this.current.power = clamp(power, 0, 100);
    this.recomputeAim();
  }

  nudgeAngle(d: number): void {
    if (this.current) this.setAim(this.current.angle + d, this.current.power);
  }
  nudgePower(d: number): void {
    if (this.current) this.setAim(this.current.angle, this.current.power + d);
  }

  cycleWeapon(dir: number): void {
    if (!this.current) return;
    const list = this.current.usableWeapons();
    if (list.length === 0) return;
    let i = list.indexOf(this.current.selectedWeapon);
    i = (i + dir + list.length) % list.length;
    this.current.selectedWeapon = list[i];
  }

  fire(): void {
    if (this.state !== "aiming" || !this.current) return;
    const t = this.current;
    const weapon = getWeapon(t.selectedWeapon);
    if (t.ammoOf(weapon.id) <= 0) return;
    t.consumeSelected();

    const muzzle = t.muzzle();
    const vel = launchVelocity(t.angle, t.power);
    this.projectiles.push(new Projectile(muzzle, vel, weapon, t.id));
    this.aimLine = [];
    this.setState("firing");
  }

  // --------------------------------------------------------------- main loop

  update(dt: number): void {
    // Clamp huge frames (e.g. tab regains focus) so physics stays sane.
    dt = Math.min(dt, 0.05);

    this.updateExplosions(dt);

    if (this.state === "aiming" && this.current?.isAI) {
      this.aiTimer -= dt;
      // Swivel the barrel toward the planned shot for a touch of life.
      if (this.pendingShot) {
        this.current.angle += (this.pendingShot.angle - this.current.angle) * Math.min(1, dt * 6);
        this.current.power += (this.pendingShot.power - this.current.power) * Math.min(1, dt * 6);
      }
      if (this.aiTimer <= 0) {
        if (this.pendingShot) {
          this.current.angle = this.pendingShot.angle;
          this.current.power = this.pendingShot.power;
          this.current.selectedWeapon = this.pendingShot.weaponId;
        }
        this.fire();
      }
      return;
    }

    if (this.state === "firing") {
      this.acc += dt;
      while (this.acc >= TIMESTEP) {
        this.stepProjectiles(TIMESTEP);
        this.acc -= TIMESTEP;
      }
      if (this.projectiles.length === 0) {
        this.enterResolving();
      }
      return;
    }

    if (this.state === "resolving") {
      this.resolveTimer -= dt;
      if (this.resolveTimer <= 0 && this.explosions.length === 0) {
        this.advanceTurn();
      }
    }
  }

  private stepProjectiles(dt: number): void {
    const spawned: Projectile[] = [];
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.step(dt, this.wind, GRAVITY);

      p.trail.push({ x: p.pos.x, y: p.pos.y });
      if (p.trail.length > 18) p.trail.shift();

      if (p.shouldSplit()) {
        p.split = true;
        p.alive = false;
        spawned.push(...this.splitMirv(p));
        continue;
      }

      // Left/right/bottom escape: gone without a bang.
      if (p.pos.x < -60 || p.pos.x > this.width + 60 || p.pos.y > this.height + 80) {
        p.alive = false;
        continue;
      }
      // Direct hit on a tank?
      const hit = this.tankAt(p.pos, p.ownerId);
      if (hit || this.terrain.isSolid(p.pos.x, p.pos.y)) {
        this.detonate(p);
        p.alive = false;
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.alive).concat(spawned);
  }

  private splitMirv(p: Projectile): Projectile[] {
    const n = p.weapon.children ?? 4;
    const out: Projectile[] = [];
    const baseAngle = Math.atan2(p.vel.y, p.vel.x);
    const speed = Math.hypot(p.vel.x, p.vel.y);
    for (let i = 0; i < n; i++) {
      const spread = ((i - (n - 1) / 2) / n) * 0.9; // fan radians
      const a = baseAngle + spread;
      const s = speed * (0.8 + this.rng() * 0.3);
      out.push(
        new Projectile(
          { x: p.pos.x, y: p.pos.y },
          { x: Math.cos(a) * s, y: Math.sin(a) * s },
          p.weapon,
          p.ownerId,
        ),
      );
      out[out.length - 1].split = true; // children don't split again
    }
    return out;
  }

  private detonate(p: Projectile): void {
    const w = p.weapon;
    const { x, y } = p.pos;
    const color =
      w.id === "nuke" ? "#fff2c2" : w.kind === "dirt" ? "#a9743b" : "#ffb347";
    this.explosions.push({ x, y, r: 0, maxR: w.radius, t: 0, dur: 0.42, color });

    if (w.kind === "dirt") {
      this.terrain.deposit(x, y, w.radius);
      return;
    }
    this.terrain.carve(x, y, w.radius);
    this.applyBlast(x, y, w.radius, w.damage, p.ownerId);
  }

  private applyBlast(
    x: number,
    y: number,
    radius: number,
    damage: number,
    ownerId: number,
  ): void {
    for (const t of this.tanks) {
      if (!t.alive) continue;
      const cy = t.y - TANK_BODY_H / 2;
      const d = Math.hypot(t.x - x, cy - y);
      if (d >= radius) continue;
      const dmg = damage * (1 - d / radius);
      if (dmg <= 0) continue;
      t.health -= dmg;
      this.lastHitBy.set(t.id, ownerId);
      if (ownerId !== t.id) {
        const owner = this.tanks.find((o) => o.id === ownerId);
        if (owner) awardDamage(owner, dmg);
      }
    }
  }

  private enterResolving(): void {
    // Terrain is already carved; drop tanks onto the new ground.
    for (const t of this.tanks) {
      if (!t.alive) continue;
      const fall = t.settle(this.terrain);
      if (fall > 8) {
        t.health -= Math.min(45, fall * 0.14);
      }
    }
    this.resolved = false;
    this.applyDeaths();
    // Let any remaining explosion flashes finish before advancing.
    this.resolveTimer = 0.25;
    this.setState("resolving");
  }

  private applyDeaths(): void {
    if (this.resolved) return;
    this.resolved = true;
    for (const t of this.tanks) {
      if (t.alive && t.health <= 0) {
        t.health = 0;
        t.alive = false;
        const killerId = this.lastHitBy.get(t.id);
        const killer =
          killerId !== undefined && killerId !== t.id
            ? this.tanks.find((o) => o.id === killerId)
            : undefined;
        if (killer) awardKill(killer);
        this.banner(`${t.name} destroyed!`);
        // Big explosion where the tank was.
        this.explosions.push({
          x: t.x,
          y: t.y - TANK_BODY_H,
          r: 0,
          maxR: 48,
          t: 0,
          dur: 0.5,
          color: "#ff7a3c",
        });
      }
    }
  }

  private advanceTurn(): void {
    const alive = this.tanks.filter((t) => t.alive);
    if (alive.length <= 1) {
      this.endRound(alive[0]);
      return;
    }
    this.turnIndex = this.nextAlive(this.turnIndex);
    this.beginTurn();
  }

  private endRound(survivor: Tank | undefined): void {
    if (survivor) {
      awardSurvival(survivor);
      this.banner(`${survivor.name} wins round ${this.round}!`);
    } else {
      this.banner(`Round ${this.round}: mutual destruction!`);
    }
    // AI tanks restock for next round.
    for (const t of this.tanks) if (t.isAI) aiBuy(t, this.rng);

    this.startingPlayer = (this.startingPlayer + 1) % this.tanks.length;
    if (this.round >= this.config.rounds) {
      this.setState("gameover");
    } else {
      this.setState("roundover");
    }
  }

  // ----------------------------------------------------------------- shop API

  buyWeapon(id: string): boolean {
    const human = this.humanTank();
    const w = getWeapon(id);
    if (!human || human.cash < w.price) return false;
    human.cash -= w.price;
    human.inventory[id] = (human.inventory[id] ?? 0) + 1;
    return true;
  }

  continueFromShop(): void {
    if (this.state === "roundover") this.startRound();
  }

  // ----------------------------------------------------------------- helpers

  private updateExplosions(dt: number): void {
    for (const e of this.explosions) {
      e.t += dt;
      e.r = e.maxR * Math.min(1, e.t / (e.dur * 0.5));
    }
    this.explosions = this.explosions.filter((e) => e.t < e.dur);
  }

  /** Recompute the dotted aim preview for the current human tank. */
  recomputeAim(): void {
    if (!this.current || this.current.isAI) {
      this.aimLine = [];
      return;
    }
    this.aimLine = this.simulatePath(this.current);
  }

  private simulatePath(t: Tank): Vec2[] {
    const start = t.muzzle();
    const v = launchVelocity(t.angle, t.power);
    let x = start.x;
    let y = start.y;
    let vx = v.x;
    let vy = v.y;
    const dt = 1 / 60;
    const pts: Vec2[] = [];
    for (let i = 0; i < 600; i++) {
      vx += this.wind * dt;
      vy += GRAVITY * dt;
      x += vx * dt;
      y += vy * dt;
      if (i % 4 === 0) pts.push({ x, y });
      if (x < -40 || x > this.width + 40 || y > this.height + 40) break;
      if (this.terrain.isSolid(x, y)) break;
    }
    return pts;
  }

  private tankAt(p: Vec2, ownerId: number): Tank | null {
    for (const t of this.tanks) {
      if (!t.alive || t.id === ownerId) continue; // owner can't direct-hit itself
      const cy = t.y - TANK_BODY_H / 2;
      if (Math.hypot(t.x - p.x, cy - p.y) < TANK_HIT_RADIUS) return t;
    }
    return null;
  }

  private nextAlive(from: number): number {
    const n = this.tanks.length;
    for (let i = 1; i <= n; i++) {
      const idx = (from + i) % n;
      if (this.tanks[idx].alive) return idx;
    }
    return from;
  }

  private enemiesOf(t: Tank): Tank[] {
    return this.tanks.filter((o) => o.id !== t.id);
  }

  humanTank(): Tank | undefined {
    return this.tanks.find((t) => !t.isAI);
  }

  private setState(next: GameState): void {
    const prev = this.state;
    if (prev === next) return;
    this.state = next;
    this.onStateChange?.(next, prev);
  }

  private banner(text: string): void {
    this.onBanner?.(text);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
