import Phaser from "phaser";
import type { CreatureState, Enemy } from "../systems/types";
import { GAME_CONFIG } from "../config";
import { computeStats, clampHealth } from "../systems/CreatureModel";
import { resolveBite, canEat } from "../systems/CombatSystem";
import { awardForEating } from "../systems/EconomySystem";
import { pickSpawn } from "../systems/EcosystemSystem";
import { tickSurvival, feed, maxHunger } from "../systems/SurvivalSystem";
import {
  isBossReady,
  bossForEra,
  defeatBoss,
  canAdvanceEra,
  advanceEra,
} from "../systems/ProgressionSystem";
import { ERA_BY_ID } from "../data/eras";
import { PART_BY_ID } from "../data/bodyParts";
import { buildSave, save } from "../persistence/SaveManager";
import { sound } from "../audio/SoundManager";

/** A live enemy on screen: definition, sprite, remaining health, and age. */
interface LiveEnemy {
  def: Enemy;
  gfx: Phaser.GameObjects.Shape;
  health: number;
  /** Seconds alive; non-boss enemies despawn past ENEMY_TTL so the pool churns. */
  age: number;
}

const DASH_SPEED_MULT = 2.8;
const DASH_DURATION = 0.18;
const DASH_COOLDOWN = 1.1;
/** How long a regular enemy lingers before drifting off and despawning. */
const ENEMY_TTL = 15;

/**
 * The gameplay scene: the swim/eat/grow loop with survival pressure and a boss
 * gate per era. Rendering, input, and spawning live here; every *rule* (combat,
 * economy, hunger, spawn weighting, progression) is delegated to the pure
 * systems so this file stays a thin, replaceable shell.
 */
export class GameScene extends Phaser.Scene {
  private creature!: CreatureState;
  private player!: Phaser.GameObjects.Container;
  private enemies: LiveEnemy[] = [];
  private boss: LiveEnemy | null = null;

  private spawnAcc = 0;
  private biteCooldown = 0;
  private dashTime = 0;
  private dashCooldown = 0;
  private facing = 0;
  private transitioning = false;

  private target = new Phaser.Math.Vector2();
  private hudGfx!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private bossText!: Phaser.GameObjects.Text;
  private dashBtn!: Phaser.GameObjects.Text;

  constructor() {
    super("Game");
  }

  create(): void {
    this.creature = this.registry.get("creature") as CreatureState;
    this.enemies = [];
    this.boss = null;
    this.spawnAcc = 0;
    this.biteCooldown = 0;
    this.dashTime = 0;
    this.dashCooldown = 0;
    this.transitioning = false;

    const era = ERA_BY_ID[this.creature.eraId];
    this.cameras.main.setBackgroundColor(era?.background ?? "#0b1d2a");
    this.cameras.main.fadeIn(350);
    this.drawBackdrop();

    this.buildPlayer();
    this.buildHud();
    this.seedInitialPrey();
    this.announce(era?.name ?? "", era?.description ?? "");

    this.target.set(this.player.x, this.player.y);
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.target.set(p.worldX, p.worldY));
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      sound.unlock();
      this.target.set(p.worldX, p.worldY);
    });

    this.input.keyboard?.on("keydown-E", () => this.openEvolution());
    this.input.keyboard?.on("keydown-SPACE", () => this.tryDash());
    this.input.keyboard?.on("keydown-M", () => sound.toggleMute());

    // EvolutionScene writes the mutated creature back and resumes us.
    this.events.on("resume", () => {
      this.creature = this.registry.get("creature") as CreatureState;
      this.rebuildPlayer();
      this.persist();
    });
  }

  // ---- construction -------------------------------------------------------

  private drawBackdrop(): void {
    // A few faint drifting motes to give the water some depth.
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(0xffffff, 0.04);
    for (let i = 0; i < 40; i++) {
      const x = (i * 137) % GAME_CONFIG.width;
      const y = (i * 89) % GAME_CONFIG.height;
      g.fillCircle(x, y, 1 + (i % 3));
    }
  }

  private buildPlayer(): void {
    this.player = this.add.container(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2);
    this.player.setDepth(10);
    this.rebuildPlayer();
  }

  /** Re-assemble the creature's body from its equipped parts. */
  private rebuildPlayer(): void {
    this.player.removeAll(true);
    const stats = computeStats(this.creature);
    const r = 10 + stats.size * 3;
    const parts = this.creature.parts;

    const hex = (id?: string) =>
      id ? Phaser.Display.Color.HexStringToColor(PART_BY_ID[id]?.visual.color ?? "#7fd1c4").color : 0x7fd1c4;

    // fins (drawn behind body)
    if (parts.fins) {
      const fc = hex(parts.fins);
      this.player.add(this.add.triangle(-r * 0.4, -r, 0, 0, r * 0.9, -r * 0.5, 0, -r, fc));
      this.player.add(this.add.triangle(-r * 0.4, r, 0, 0, r * 0.9, r * 0.5, 0, r, fc));
    }
    // limbs (small side nubs)
    if (parts.limbs) {
      const lc = hex(parts.limbs);
      this.player.add(this.add.rectangle(-r * 0.2, -r * 0.9, 5, 8, lc));
      this.player.add(this.add.rectangle(-r * 0.2, r * 0.9, 5, 8, lc));
    }
    // body
    this.player.add(this.add.circle(0, 0, r, hex(parts.body)));
    // armor ring
    if (parts.armor) {
      const ring = this.add.circle(0, 0, r + 2);
      ring.setStrokeStyle(3, hex(parts.armor), 0.9);
      ring.setFillStyle();
      this.player.add(ring);
    }
    // mouth (front, +x)
    if (parts.mouth && parts.mouth !== "mouth.none") {
      const mc = hex(parts.mouth);
      this.player.add(this.add.triangle(r * 0.8, 0, 0, -r * 0.5, r * 0.7, 0, 0, r * 0.5, mc));
    }
    // sense (eye near front)
    if (parts.sense) {
      this.player.add(this.add.circle(r * 0.4, -r * 0.35, Math.max(2, r * 0.18), 0xffffff));
      this.player.add(this.add.circle(r * 0.45, -r * 0.35, Math.max(1, r * 0.09), 0x1a1a1a));
    }
  }

  private buildHud(): void {
    const { width, height, safeTop } = GAME_CONFIG;
    this.hudGfx = this.add.graphics().setScrollFactor(0).setDepth(1000);

    // Status readout sits just under the bars, clear of the notch zone.
    this.hudText = this.add
      .text(16, safeTop + 64, "", { fontFamily: "monospace", fontSize: "14px", color: "#cfeae6" })
      .setScrollFactor(0)
      .setDepth(1000);

    // Boss banner: centered, below the status bars.
    this.bossText = this.add
      .text(width / 2, safeTop + 86, "", {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#ff9ad1",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    // Bottom thumb-zone controls — large tap targets, one per corner.
    const evolveBtn = this.add
      .text(16, height - 20, "EVOLVE", {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#ffd27f",
        backgroundColor: "#1c3a47",
        padding: { x: 20, y: 16 },
      })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true });
    evolveBtn.on("pointerdown", () => this.openEvolution());

    this.dashBtn = this.add
      .text(width - 16, height - 20, "DASH", {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#9ecae1",
        backgroundColor: "#16323d",
        padding: { x: 20, y: 16 },
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true });
    this.dashBtn.on("pointerdown", () => this.tryDash());
  }

  // ---- main loop ----------------------------------------------------------

  update(_time: number, deltaMs: number): void {
    if (this.transitioning) return;
    const dt = Math.min(0.05, deltaMs / 1000); // clamp to avoid tab-switch jumps

    this.creature = tickSurvival(this.creature, dt);
    this.movePlayer(dt);
    this.tickSpawning(dt);
    this.maybeSpawnBoss();
    this.moveEnemies(dt);
    this.cullEnemies(dt);

    this.biteCooldown = Math.max(0, this.biteCooldown - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.dashTime = Math.max(0, this.dashTime - dt);

    this.handleContacts();
    this.drawHud();

    if (this.creature.currentHealth <= 0) this.onDeath();
  }

  private movePlayer(dt: number): void {
    const stats = computeStats(this.creature);
    const speed = stats.speed * (this.dashTime > 0 ? DASH_SPEED_MULT : 1);
    const here = new Phaser.Math.Vector2(this.player.x, this.player.y);
    const dir = this.target.clone().subtract(here);
    if (dir.length() > 2) {
      const wanted = Math.atan2(dir.y, dir.x);
      this.facing = Phaser.Math.Angle.RotateTo(this.facing, wanted, 8 * dt);
      this.player.setRotation(this.facing);
      dir.normalize().scale(speed * dt);
      this.player.x = Phaser.Math.Clamp(this.player.x + dir.x, 0, GAME_CONFIG.width);
      this.player.y = Phaser.Math.Clamp(this.player.y + dir.y, 0, GAME_CONFIG.height);
    }
  }

  private tryDash(): void {
    if (this.dashCooldown > 0 || this.dashTime > 0) return;
    this.dashTime = DASH_DURATION;
    this.dashCooldown = DASH_COOLDOWN;
    this.player.setScale(1.15);
    this.tweens.add({ targets: this.player, scale: 1, duration: 220, ease: "Quad.out" });
    this.burst(this.player.x, this.player.y, 0x9ecae1, 6);
  }

  /** Populate the world with prey at the start of a run so there's food at t=0. */
  private seedInitialPrey(): void {
    for (let i = 0; i < GAME_CONFIG.initialPrey; i++) {
      const def = pickSpawn(this.creature.eraId, this.creature.evoPoints, Math.random());
      if (def) this.enemies.push(this.spawnEnemy(def));
    }
  }

  private tickSpawning(dt: number): void {
    if (this.boss) return; // freeze the soup during a boss fight
    this.spawnAcc += dt;
    if (this.spawnAcc < GAME_CONFIG.spawnIntervalSec) return;
    // Always reset the cadence; just skip the spawn itself when at capacity, so
    // the timer can never get stuck and silently stop the world.
    this.spawnAcc = 0;
    if (this.enemies.length >= GAME_CONFIG.maxEnemies) return;
    const def = pickSpawn(this.creature.eraId, this.creature.evoPoints, Math.random());
    if (def) this.enemies.push(this.spawnEnemy(def));
  }

  /** Age out lingering enemies so the pool keeps turning over and spawning. */
  private cullEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.age += dt;
      if (e.age > ENEMY_TTL) {
        const g = e.gfx;
        this.tweens.add({ targets: g, alpha: 0, duration: 300, onComplete: () => g.destroy() });
        this.enemies.splice(i, 1);
      }
    }
  }

  private spawnEnemy(def: Enemy, atCenter = false): LiveEnemy {
    const { width, height } = GAME_CONFIG;
    let x: number;
    let y: number;
    if (atCenter) {
      x = width * 0.5;
      y = height * 0.22;
    } else if (def.behavior === "hunt") {
      // Predators sweep in from an edge for a sense of threat/arrival.
      const edge = Math.floor(Math.random() * 4);
      x = edge === 1 ? width + 20 : edge === 3 ? -20 : Math.random() * width;
      y = edge === 0 ? -20 : edge === 2 ? height + 20 : Math.random() * height;
    } else {
      // Passive prey appears within view so there's always food to chase —
      // but never right on top of the player.
      const margin = 40;
      x = margin + Math.random() * (width - 2 * margin);
      y = margin + Math.random() * (height - 2 * margin);
      for (let tries = 0; tries < 6; tries++) {
        if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) > 120) break;
        x = margin + Math.random() * (width - 2 * margin);
        y = margin + Math.random() * (height - 2 * margin);
      }
    }
    const color = Phaser.Display.Color.HexStringToColor(def.visual.color).color;
    const rad = def.visual.radius;
    let gfx: Phaser.GameObjects.Shape;
    if (def.visual.shape === "triangle") {
      gfx = this.add.triangle(x, y, 0, rad, rad, -rad, -rad, -rad, color);
    } else if (def.visual.shape === "rect") {
      gfx = this.add.rectangle(x, y, rad * 2, rad * 2, color);
    } else {
      gfx = this.add.circle(x, y, rad, color);
    }
    gfx.setDepth(5);
    return { def, gfx, health: def.stats.maxHealth, age: 0 };
  }

  private maybeSpawnBoss(): void {
    if (this.boss || !isBossReady(this.creature)) return;
    const def = bossForEra(this.creature.eraId);
    if (!def) return;
    this.boss = this.spawnEnemy(def, true);
    this.boss.gfx.setDepth(6);
    sound.play("boss");
    this.cameras.main.shake(400, 0.006);
    this.announce("A SHADOW APPROACHES", def.name);
  }

  private moveEnemies(dt: number): void {
    const all = this.boss ? [...this.enemies, this.boss] : this.enemies;
    for (const e of all) {
      const to = new Phaser.Math.Vector2(this.player.x - e.gfx.x, this.player.y - e.gfx.y);
      const sp = e.def.stats.speed * dt;
      if (e.def.behavior === "hunt") {
        to.normalize().scale(sp);
        e.gfx.x += to.x;
        e.gfx.y += to.y;
      } else if (e.def.behavior === "flee") {
        to.normalize().scale(-sp);
        e.gfx.x += to.x;
        e.gfx.y += to.y;
      } else {
        e.gfx.x += Math.cos(e.gfx.x * 0.01) * sp * 0.5;
        e.gfx.y += Math.sin(e.gfx.y * 0.01) * sp * 0.5;
      }
      e.gfx.x = Phaser.Math.Clamp(e.gfx.x, -40, GAME_CONFIG.width + 40);
      e.gfx.y = Phaser.Math.Clamp(e.gfx.y, -40, GAME_CONFIG.height + 40);
    }
  }

  private handleContacts(): void {
    const stats = computeStats(this.creature);

    // Boss is handled separately so it can survive many bites and gate the era.
    if (this.boss) this.resolveEnemy(this.boss, stats, true);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const removed = this.resolveEnemy(this.enemies[i], stats, false);
      if (removed) this.enemies.splice(i, 1);
    }
  }

  /** Resolve contact with one enemy. Returns true if it was consumed/removed. */
  private resolveEnemy(e: LiveEnemy, stats: ReturnType<typeof computeStats>, isBoss: boolean): boolean {
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.gfx.x, e.gfx.y);
    const reach = GAME_CONFIG.biteRange + e.def.visual.radius + stats.size * 3;
    if (dist > reach) return false;

    // Prey too big (or a boss you can't yet out-size) hurts you on contact.
    if (!canEat(stats, e.def)) {
      if (this.biteCooldown === 0) {
        this.hurt(Math.max(1, e.def.stats.attack - stats.defense * 0.5));
        this.biteCooldown = 0.6;
      }
      return false;
    }

    if (this.biteCooldown > 0) return false;
    this.biteCooldown = isBoss ? 0.25 : 0.35;

    const out = resolveBite(this.creature, e.def, e.health);
    e.health = out.enemyRemainingHealth;
    this.burst(e.gfx.x, e.gfx.y, 0xffd27f, 3);
    if (out.damageToPlayer > 0) this.hurt(out.damageToPlayer);

    if (out.enemyDefeated) {
      this.creature = awardForEating(this.creature, e.def);
      this.creature = feed(this.creature, e.def);
      this.floatText(e.gfx.x, e.gfx.y, `+${e.def.reward}`, "#a8e6a1");
      this.burst(e.gfx.x, e.gfx.y, 0x7fffd4, 14);
      sound.play("eat");
      e.gfx.destroy();
      this.persist();
      if (isBoss) this.onBossDefeated();
      return true;
    }
    return false;
  }

  // ---- outcomes -----------------------------------------------------------

  private hurt(amount: number): void {
    this.creature = clampHealth({ ...this.creature, currentHealth: this.creature.currentHealth - amount });
    this.cameras.main.shake(120, 0.004);
    sound.play("hurt");
    this.player.setAlpha(0.5);
    this.tweens.add({ targets: this.player, alpha: 1, duration: 180 });
  }

  private onBossDefeated(): void {
    this.creature = defeatBoss(this.creature);
    this.boss = null;
    sound.play("levelup");
    this.cameras.main.shake(500, 0.008);
    this.persist();

    if (canAdvanceEra(this.creature)) {
      this.transitionTo(() => {
        this.creature = advanceEra(this.creature);
        this.registry.set("creature", this.creature);
        this.scene.restart();
      }, "ERA COMPLETE", "You evolved onward.");
    } else {
      // No further era authored — you reached Eden.
      this.transitionTo(() => this.scene.start("Title"), "YOU REACHED EDEN", "Thanks for playing the prototype.");
    }
  }

  private onDeath(): void {
    this.transitioning = true;
    sound.play("death");
    // Forgiving setback: keep parts/era, lose a quarter of banked points, and
    // respawn at full vitals so the player resumes rather than restarts.
    const penalized: CreatureState = clampHealth({
      ...this.creature,
      evoPoints: Math.floor(this.creature.evoPoints * 0.75),
      currentHealth: 99999,
    });
    penalized.hunger = maxHunger(penalized);
    this.persist(penalized);
    const era = ERA_BY_ID[this.creature.eraId];
    this.cameras.main.fade(400);
    this.time.delayedCall(420, () =>
      this.scene.start("GameOver", { eraName: era?.name, evoPoints: penalized.evoPoints }),
    );
  }

  private transitionTo(then: () => void, title: string, subtitle: string): void {
    this.transitioning = true;
    this.announce(title, subtitle);
    this.cameras.main.fade(900);
    this.time.delayedCall(950, then);
  }

  // ---- ui helpers ---------------------------------------------------------

  private openEvolution(): void {
    if (this.transitioning) return;
    this.registry.set("creature", this.creature);
    this.scene.launch("Evolution");
    this.scene.pause();
  }

  private drawHud(): void {
    const stats = computeStats(this.creature);
    const era = ERA_BY_ID[this.creature.eraId];
    const g = this.hudGfx;
    g.clear();

    const top = GAME_CONFIG.safeTop;
    const barW = GAME_CONFIG.width - 32; // full-width bars read better in portrait
    const bar = (y: number, frac: number, color: number, label: string) => {
      g.fillStyle(0x000000, 0.4);
      g.fillRect(16, y, barW, 14);
      g.fillStyle(color, 1);
      g.fillRect(16, y, barW * Phaser.Math.Clamp(frac, 0, 1), 14);
      g.lineStyle(1, 0xffffff, 0.25);
      g.strokeRect(16, y, barW, 14);
      this.hudLabel(label, y);
    };

    bar(top, this.creature.currentHealth / stats.maxHealth, 0xe5534b, "HP");
    bar(top + 20, this.creature.hunger / maxHunger(this.creature), 0xe0a23c, "FOOD");
    const goal = era?.advanceAtPoints ?? 1;
    bar(top + 40, this.creature.evoPoints / goal, 0x4fb0c6, "EVO");

    this.hudText.setText(
      `${era?.name ?? "?"}   ATK ${stats.attack}  DEF ${stats.defense}  SIZE ${stats.size}`,
    );

    // Boss banner + health (centered under the status bars).
    if (this.boss) {
      const frac = this.boss.health / this.boss.def.stats.maxHealth;
      const bw = GAME_CONFIG.width - 80;
      const bx = 40;
      const by = top + 110;
      g.fillStyle(0x000000, 0.5);
      g.fillRect(bx, by, bw, 10);
      g.fillStyle(0xff5fa2, 1);
      g.fillRect(bx, by, bw * Phaser.Math.Clamp(frac, 0, 1), 10);
      this.bossText.setText(`☠ ${this.boss.def.name}`);
    } else {
      this.bossText.setText(isBossReady(this.creature) ? "The boss is near…" : "");
    }

    // Dash cooldown feedback.
    this.dashBtn.setAlpha(this.dashCooldown > 0 ? 0.4 : 1);
  }

  private hudLabel(text: string, y: number): void {
    const key = `hudlbl_${y}`;
    const exists = this.children.getByName(key) as Phaser.GameObjects.Text | null;
    if (!exists) {
      // Label sits inside the left edge of its (now full-width) bar.
      this.add
        .text(22, y + 1, text, { fontFamily: "monospace", fontSize: "11px", color: "#f3faf8" })
        .setScrollFactor(0)
        .setDepth(1001)
        .setName(key);
    }
  }

  private announce(title: string, subtitle: string): void {
    const cx = GAME_CONFIG.width / 2;
    const cy = GAME_CONFIG.height / 2;
    const t = this.add
      .text(cx, cy - 14, title, { fontFamily: "monospace", fontSize: "30px", color: "#ffffff" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2000);
    const s = this.add
      .text(cx, cy + 18, subtitle, { fontFamily: "monospace", fontSize: "14px", color: "#bcd9d4" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2000);
    [t, s].forEach((o) => {
      o.setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 250, yoyo: true, hold: 1100, onComplete: () => o.destroy() });
    });
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add
      .text(x, y, text, { fontFamily: "monospace", fontSize: "14px", color })
      .setOrigin(0.5)
      .setDepth(1500);
    this.tweens.add({ targets: t, y: y - 32, alpha: 0, duration: 700, ease: "Quad.out", onComplete: () => t.destroy() });
  }

  private burst(x: number, y: number, color: number, count: number): void {
    const emitter = this.add.particles(x, y, "spark", {
      speed: { min: 40, max: 140 },
      lifespan: 400,
      scale: { start: 0.5, end: 0 },
      tint: color,
      blendMode: "ADD",
      emitting: false,
    });
    emitter.setDepth(20);
    emitter.explode(count);
    this.time.delayedCall(450, () => emitter.destroy());
  }

  private persist(state: CreatureState = this.creature): void {
    save(buildSave(state, Object.values(state.parts).filter(Boolean) as string[]));
  }
}
