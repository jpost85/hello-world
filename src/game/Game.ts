import type { Difficulty, GameState, Vec2, WallMode } from "../types";
import {
  type Fire,
  FIRE_DPS,
  FIRE_MAX_SPEED,
  FIRE_SLOPE_ACCEL,
} from "./Fire";
import { GRAVITY, MAX_WIND, TIMESTEP, launchVelocity, maxSpeedFor } from "./Physics";
import { Terrain, makeRng } from "./Terrain";
import { Tank, TANK_BODY_H, TANK_HIT_RADIUS } from "./Tank";
import { Projectile } from "./Projectile";
import { getWeapon } from "./Weapons";
import { getItem } from "./Items";
import { ParticleField } from "./Particles";
import { planShot, aiBuy, type Shot } from "./AI";
import {
  STARTING_CASH,
  awardDamage,
  awardKill,
  awardSurvival,
} from "./Economy";

export type SoundType = "fire" | "explode" | "death";

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
  wallMode?: WallMode;
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
  fires: Fire[] = [];

  /** Decaying screen-shake magnitude (world px), read by the renderer. */
  shake = 0;
  /** Brief time dilation (1 = normal). Drops on a kill for a slow-mo beat. */
  timeScale = 1;
  private slowMoLeft = 0;
  /** How the battlefield edges behave this match. */
  wallMode: WallMode = "open";

  wind = 0;
  /** Launch speed at full power, derived from field width (aspect-aware). */
  maxSpeed: number;
  round = 0;
  config: MatchConfig = { opponents: 1, difficulty: "normal", rounds: 5 };

  turnIndex = 0;
  startingPlayer = 0;
  current: Tank | null = null;

  /** Sampled trajectory points for the human aim preview. */
  aimLine: Vec2[] = [];

  private rng = makeRng(Date.now() >>> 0);
  particles = new ParticleField(() => this.rng());
  private acc = 0;
  private aiTimer = 0;
  private pendingShot: Shot | null = null;
  private resolveTimer = 0;
  private lastHitBy = new Map<number, number>();

  // UI hooks (wired by main.ts).
  onStateChange: ((next: GameState, prev: GameState) => void) | null = null;
  onBanner: ((text: string) => void) | null = null;
  onSound: ((type: SoundType, intensity?: number) => void) | null = null;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.maxSpeed = maxSpeedFor(width);
    this.terrain = new Terrain(width, height);
  }

  /**
   * Adapt to a new viewport (resize / rotation). Resamples the terrain to the
   * new width and rescales every entity so the match continues seamlessly at
   * the new aspect ratio — no letterboxing, no restart.
   */
  resize(width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    const sx = width / this.width;
    const sy = height / this.height;

    // Resample the height-map to the new column count.
    const old = this.terrain;
    const next = new Terrain(width, height);
    for (let x = 0; x < width; x++) {
      const srcX = Math.min(old.width - 1, Math.round(x / sx));
      next.surface[x] = old.surface[srcX] * sy;
    }
    this.terrain = next;

    this.width = width;
    this.height = height;
    this.maxSpeed = maxSpeedFor(width);

    for (const t of this.tanks) {
      t.x *= sx;
      t.y *= sy;
      t.settle(this.terrain);
    }
    for (const p of this.projectiles) {
      p.pos.x *= sx;
      p.pos.y *= sy;
      p.vel.x *= sx;
      p.vel.y *= sy;
      for (const pt of p.trail) {
        pt.x *= sx;
        pt.y *= sy;
      }
    }
    for (const pt of this.particles.items) {
      pt.x *= sx;
      pt.y *= sy;
      pt.vx *= sx;
      pt.vy *= sy;
    }
    for (const e of this.explosions) {
      e.x *= sx;
      e.y *= sy;
      e.r *= sx;
      e.maxR *= sx;
    }
    for (const f of this.fires) {
      f.x *= sx;
      f.vx *= sx;
      f.r *= sx;
      f.y = this.terrain.surfaceAt(f.x);
    }
    this.recomputeAim();
  }

  // ---------------------------------------------------------------- lifecycle

  newMatch(config: MatchConfig): void {
    this.config = config;
    this.wallMode = config.wallMode ?? "open";
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
        getWeapon("roller"),
      ]) {
        t.inventory[w.id] = w.infinite ? Infinity : w.startCount;
      }
      t.selectedWeapon = "baby";
      t.cash = STARTING_CASH;
      t.score = 0;
      t.shield = 0;
      t.parachutes = 1;
    }

    this.startRound();
  }

  startRound(): void {
    this.round += 1;
    this.terrain = new Terrain(this.width, this.height);
    this.terrain.generate(this.rng);
    this.projectiles = [];
    this.explosions = [];
    this.fires = [];
    this.particles.clear();
    this.shake = 0;
    this.slowMoLeft = 0;
    this.timeScale = 1;
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
      this.pendingShot = planShot(t, this.enemiesOf(t), this.terrain, this.wind, this.rng, this.maxSpeed);
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
    const vel = launchVelocity(t.angle, t.power, this.maxSpeed);
    this.projectiles.push(new Projectile(muzzle, vel, weapon, t.id));
    this.aimLine = [];
    this.onSound?.("fire");
    this.setState("firing");
  }

  // --------------------------------------------------------------- main loop

  update(dt: number): void {
    // Clamp huge frames (e.g. tab regains focus) so physics stays sane.
    dt = Math.min(dt, 0.05);

    // A kill briefly dilates time so the moment lands.
    if (this.slowMoLeft > 0) {
      this.slowMoLeft -= dt;
      this.timeScale = this.slowMoLeft > 0 ? 0.35 : 1;
    } else {
      this.timeScale = 1;
    }
    dt *= this.timeScale;

    this.updateExplosions(dt);
    this.particles.update(dt, this.height - 2);
    const hadFires = this.fires.length > 0;
    this.updateFires(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 60);
    for (const t of this.tanks) {
      if (t.hitFlash > 0) t.hitFlash = Math.max(0, t.hitFlash - dt * 2.5);
    }
    // Fire keeps burning between turns, so it can claim a tank mid-aim.
    if (hadFires && this.state === "aiming") this.reapFireCasualties();

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

      // Rollers and tunnelers move along their own rules once they land.
      if (p.mode === "rolling") {
        this.stepRoller(p, dt);
        continue;
      }
      if (p.mode === "digging") {
        this.stepTunneler(p, dt);
        continue;
      }

      p.step(dt, this.wind, GRAVITY);

      p.trail.push({ x: p.pos.x, y: p.pos.y });
      if (p.trail.length > 18) p.trail.shift();

      if (p.shouldSplit()) {
        p.split = true;
        p.alive = false;
        spawned.push(...this.splitMirv(p, 0.9, 1));
        continue;
      }
      // Airbursts fuse just above the ground and rake it with bomblets.
      if (p.shouldAirburst(this.terrain.surfaceAt(p.pos.x))) {
        p.split = true;
        p.alive = false;
        spawned.push(...this.splitMirv(p, 1.5, 0.75));
        this.onSound?.("explode", 0.5);
        continue;
      }

      if (!this.applyWalls(p)) continue; // absorbed / flew away

      // Bottom escape: gone without a bang.
      if (p.pos.y > this.height + 80) {
        p.alive = false;
        continue;
      }
      // Direct hit on a tank?
      const hit = this.tankAt(p.pos, p.ownerId);
      const inGround = this.terrain.isSolid(p.pos.x, p.pos.y);
      if (hit || inGround) {
        // Rollers and tunnelers convert instead of detonating on the ground.
        if (!hit && inGround && p.weapon.kind === "roller") {
          p.mode = "rolling";
          p.pos.y = this.terrain.surfaceAt(p.pos.x);
          p.vel.y = 0;
          p.vel.x = clampMag(p.vel.x * 0.5, 260);
          continue;
        }
        if (!hit && inGround && p.weapon.kind === "tunneler") {
          p.mode = "digging";
          const speed = Math.max(120, Math.hypot(p.vel.x, p.vel.y));
          const a = Math.atan2(p.vel.y, p.vel.x);
          p.vel.x = Math.cos(a) * speed;
          p.vel.y = Math.sin(a) * speed;
          continue;
        }
        this.detonate(p);
        p.alive = false;
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.alive).concat(spawned);
  }

  /**
   * Apply the match's wall rule to a projectile that has left the field.
   * Returns false if the projectile is finished (absorbed or gone).
   */
  private applyWalls(p: Projectile): boolean {
    const mode = this.wallMode;
    const left = 0;
    const right = this.width;

    if (mode === "wrap") {
      if (p.pos.x < left) p.pos.x += this.width;
      else if (p.pos.x > right) p.pos.x -= this.width;
      return true;
    }

    if (mode === "bounce") {
      if (p.pos.x < left) {
        p.pos.x = left + (left - p.pos.x);
        p.vel.x = Math.abs(p.vel.x) * 0.92;
        this.particles.spawnSparks({ x: left, y: p.pos.y }, 6, "#9fd4ff", 160);
      } else if (p.pos.x > right) {
        p.pos.x = right - (p.pos.x - right);
        p.vel.x = -Math.abs(p.vel.x) * 0.92;
        this.particles.spawnSparks({ x: right, y: p.pos.y }, 6, "#9fd4ff", 160);
      }
      return true;
    }

    if (mode === "concrete") {
      if (p.pos.x < left || p.pos.x > right) {
        p.pos.x = Math.max(left, Math.min(right, p.pos.x));
        this.detonate(p);
        p.alive = false;
        return false;
      }
      return true;
    }

    // "open": drift off the map and vanish.
    if (p.pos.x < -60 || p.pos.x > this.width + 60) {
      p.alive = false;
      return false;
    }
    return true;
  }

  /** A landed roller flows along the surface, gathering speed downhill. */
  private stepRoller(p: Projectile, dt: number): void {
    const budget = p.weapon.rollDistance ?? 500;
    const here = this.terrain.surfaceAt(p.pos.x);
    const ahead = this.terrain.surfaceAt(p.pos.x + (p.vel.x >= 0 ? 6 : -6));
    // Downhill (surface y increases ahead) accelerates; uphill brakes.
    const slope = ahead - here;
    p.vel.x += Math.sign(p.vel.x || 1) * slope * 9 * dt * 60 * 0.02;
    p.vel.x = clampMag(p.vel.x * (1 - 0.25 * dt), 300);

    // Too slow on flat/uphill ground: give up and detonate.
    if (Math.abs(p.vel.x) < 12) {
      this.detonate(p);
      p.alive = false;
      return;
    }

    p.pos.x += p.vel.x * dt;
    p.travelled += Math.abs(p.vel.x) * dt;
    p.pos.y = this.terrain.surfaceAt(p.pos.x);

    p.trail.push({ x: p.pos.x, y: p.pos.y });
    if (p.trail.length > 10) p.trail.shift();
    if (this.rng() < 0.25) {
      this.particles.spawnDebris({ x: p.pos.x, y: p.pos.y }, 1, "#6b4a2a", 60);
    }

    // Rollers obey the match's wall rule at the edges.
    if (p.pos.x < 0 || p.pos.x > this.width) {
      if (this.wallMode === "wrap") {
        p.pos.x = (p.pos.x + this.width) % this.width;
        p.pos.y = this.terrain.surfaceAt(p.pos.x);
      } else if (this.wallMode === "bounce") {
        p.pos.x = Math.max(0, Math.min(this.width, p.pos.x));
        p.vel.x = -p.vel.x * 0.8;
      } else {
        // Open / concrete: stop at the edge and blow rather than vanish.
        p.pos.x = Math.max(0, Math.min(this.width, p.pos.x));
        this.detonate(p);
        p.alive = false;
        return;
      }
    }

    if (this.tankAt(p.pos, -1) || p.travelled > budget) {
      this.detonate(p);
      p.alive = false;
    }
  }

  /** A tunneler bores through terrain, carving a shaft, then erupts. */
  private stepTunneler(p: Projectile, dt: number): void {
    const budget = p.weapon.digDistance ?? 140;
    const step = Math.hypot(p.vel.x, p.vel.y) * dt;
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.travelled += step;

    // Carve a narrow shaft so the path stays visible.
    this.terrain.carve(p.pos.x, p.pos.y, 7);
    if (this.rng() < 0.6) {
      this.particles.spawnDebris({ x: p.pos.x, y: p.pos.y }, 1, "#8a6a3a", 70);
    }

    // Only leaving the sides loses the shell; digging into the floor still
    // erupts (clamped), so a low-ground hit is never a wasted shot.
    const offSides = p.pos.x < 0 || p.pos.x > this.width;
    const hitFloor = p.pos.y > this.height - 4;
    if (this.tankAt(p.pos, -1) || p.travelled > budget || offSides || hitFloor) {
      if (!offSides) {
        p.pos.y = Math.min(p.pos.y, this.height - 4);
        this.detonate(p);
      }
      p.alive = false;
    }
  }

  /** Fan a shell into sub-munitions. `fan` is the spread in radians. */
  private splitMirv(p: Projectile, fan: number, speedScale: number): Projectile[] {
    const n = p.weapon.children ?? 4;
    const out: Projectile[] = [];
    const baseAngle = Math.atan2(p.vel.y, p.vel.x);
    const speed = Math.hypot(p.vel.x, p.vel.y) * speedScale;
    for (let i = 0; i < n; i++) {
      const spread = ((i - (n - 1) / 2) / n) * fan; // fan radians
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
      w.id === "nuke"
        ? "#fff2c2"
        : w.kind === "dirt"
          ? "#a9743b"
          : w.kind === "napalm"
            ? "#ff7a2c"
            : "#ffb347";
    this.explosions.push({ x, y, r: 0, maxR: w.radius, t: 0, dur: 0.42, color });

    // Juice: particles, screen shake, and sound scaled to the blast.
    const scale = w.radius / 40;
    this.shake = Math.min(22, Math.max(this.shake, 3 + w.radius * 0.14));
    this.onSound?.("explode", scale);

    if (w.kind === "dirt") {
      this.terrain.deposit(x, y, w.radius);
      this.particles.spawnDebris({ x, y }, Math.round(14 * scale), "#a9743b", 140 + w.radius * 2);
      return;
    }

    this.terrain.carve(x, y, w.radius);
    this.particles.spawnSparks({ x, y }, Math.round(16 * scale), color, 180 + w.radius * 3);
    this.particles.spawnDebris({ x, y }, Math.round(12 * scale), "#6b4a2a", 120 + w.radius * 2);
    this.applyBlast(x, y, w.radius, w.damage, p.ownerId);

    // Napalm spills burning blobs that pour down the slope.
    if (w.kind === "napalm") this.spillFire(x, y, p.ownerId, w.fireCount ?? 12);
  }

  private spillFire(x: number, y: number, ownerId: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.fires.push({
        x: x + (this.rng() * 2 - 1) * 26,
        y,
        vx: (this.rng() * 2 - 1) * 90,
        life: 2.6 + this.rng() * 2.2,
        maxLife: 4.8,
        r: 13 + this.rng() * 9,
        ownerId,
      });
    }
  }

  /** Burning ground: slides downhill, scorches tanks, then burns out. */
  private updateFires(dt: number): void {
    for (const f of this.fires) {
      const here = this.terrain.surfaceAt(f.x);
      const ahead = this.terrain.surfaceAt(f.x + (f.vx >= 0 ? 5 : -5));
      f.vx += Math.sign(f.vx || 1) * (ahead - here) * FIRE_SLOPE_ACCEL * dt * 0.02;
      f.vx = clampMag(f.vx * (1 - 0.5 * dt), FIRE_MAX_SPEED);
      f.x += f.vx * dt;
      f.y = this.terrain.surfaceAt(f.x);
      f.life -= dt;

      if (this.rng() < 0.5) {
        this.particles.spawnSparks(
          { x: f.x, y: f.y - 4 },
          1,
          this.rng() < 0.5 ? "#ff9a3c" : "#ffd76a",
          40,
        );
      }

      // Scorch anything standing in the flames.
      for (const t of this.tanks) {
        if (!t.alive) continue;
        const cy = t.y - TANK_BODY_H / 2;
        if (Math.hypot(t.x - f.x, cy - f.y) < f.r + 10) {
          this.damageTank(t, FIRE_DPS * dt, f.ownerId);
        }
      }
    }
    this.fires = this.fires.filter(
      (f) => f.life > 0 && f.x > -20 && f.x < this.width + 20,
    );
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
      this.damageTank(t, dmg, ownerId);
    }
  }

  /**
   * Single entry point for hurting a tank: shields soak first, the survivor
   * flashes, and the attacker gets paid for whatever landed on the hull.
   */
  private damageTank(t: Tank, amount: number, ownerId: number): void {
    if (!t.alive || amount <= 0) return;
    let dmg = amount;
    if (t.shield > 0) {
      const absorbed = Math.min(t.shield, dmg);
      t.shield -= absorbed;
      dmg -= absorbed;
    }
    if (dmg > 0) {
      t.health -= dmg;
      t.hitFlash = Math.min(1, t.hitFlash + dmg / 40);
    }
    this.lastHitBy.set(t.id, ownerId);
    if (ownerId !== t.id) {
      const owner = this.tanks.find((o) => o.id === ownerId);
      if (owner) awardDamage(owner, dmg);
    }
  }

  private enterResolving(): void {
    // Terrain is already carved; drop tanks onto the new ground.
    for (const t of this.tanks) {
      if (!t.alive) continue;
      const fall = t.settle(this.terrain);
      if (fall > 8) {
        if (t.parachutes > 0) {
          t.parachutes -= 1;
          this.banner(`${t.name}'s parachute deployed!`);
        } else {
          t.health -= Math.min(45, fall * 0.14);
        }
      }
    }
    this.applyDeaths();
    // Let any remaining explosion flashes finish before advancing.
    this.resolveTimer = 0.25;
    this.setState("resolving");
  }

  /**
   * Fire can kill while another player is lining up a shot. Fold those deaths
   * in and end the round or skip the turn if the burning tank was up next.
   */
  private reapFireCasualties(): void {
    const dyingCurrent = this.current?.alive === true && this.current.health <= 0;
    const anyDying = this.tanks.some((t) => t.alive && t.health <= 0);
    if (!anyDying) return;

    this.applyDeaths();
    const alive = this.tanks.filter((t) => t.alive);
    if (alive.length <= 1) {
      this.endRound(alive[0]);
    } else if (dyingCurrent) {
      this.advanceTurn();
    }
  }

  private applyDeaths(): void {
    // Naturally idempotent: a tank is only processed while still alive.
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
        const ex = t.x;
        const ey = t.y - TANK_BODY_H;
        this.explosions.push({ x: ex, y: ey, r: 0, maxR: 48, t: 0, dur: 0.5, color: "#ff7a3c" });
        this.particles.spawnSparks({ x: ex, y: ey }, 44, "#ffd24d", 300);
        this.particles.spawnDebris({ x: ex, y: ey }, 30, t.color, 240);
        this.shake = Math.min(26, Math.max(this.shake, 16));
        this.onSound?.("death", 1.4);
        // Hang on the kill for a beat.
        this.slowMoLeft = Math.max(this.slowMoLeft, 0.45);
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

  buyItem(id: string): boolean {
    const human = this.humanTank();
    const item = getItem(id);
    if (!human || human.cash < item.price) return false;
    const current = item.kind === "shield" ? human.shield : human.parachutes;
    if (current >= item.cap) return false; // already maxed out
    human.cash -= item.price;
    if (item.kind === "shield") {
      human.shield = Math.min(item.cap, human.shield + item.amount);
    } else {
      human.parachutes = Math.min(item.cap, human.parachutes + item.amount);
    }
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
    const v = launchVelocity(t.angle, t.power, this.maxSpeed);
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

/** Clamp a signed value to a maximum magnitude, preserving direction. */
function clampMag(v: number, max: number): number {
  return v > max ? max : v < -max ? -max : v;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
