import Phaser from "phaser";
import type { CreatureState, Enemy } from "../systems/types";
import { GAME_CONFIG } from "../config";
import { computeStats, clampHealth } from "../systems/CreatureModel";
import { resolveBite, canEat } from "../systems/CombatSystem";
import { awardForEating } from "../systems/EconomySystem";
import { pickSpawn } from "../systems/EcosystemSystem";
import { canAdvanceEra, advanceEra } from "../systems/ProgressionSystem";
import { ERA_BY_ID } from "../data/eras";
import { PART_BY_ID } from "../data/bodyParts";
import { buildSave, save } from "../persistence/SaveManager";

/** A live enemy on screen: its definition, sprite, and remaining health. */
interface LiveEnemy {
  def: Enemy;
  gfx: Phaser.GameObjects.Arc | Phaser.GameObjects.Triangle | Phaser.GameObjects.Rectangle;
  health: number;
}

/**
 * The gameplay scene: the swim/eat/grow loop. It owns rendering, input, and
 * spawning, but delegates every rule (combat, economy, spawn weighting,
 * progression) to the pure systems. Open the evolution menu with E or the
 * on-screen button.
 */
export class GameScene extends Phaser.Scene {
  private creature!: CreatureState;
  private player!: Phaser.GameObjects.Container;
  private playerBody!: Phaser.GameObjects.Arc;
  private enemies: LiveEnemy[] = [];
  private spawnAcc = 0;
  private biteCooldown = 0;
  private hud!: Phaser.GameObjects.Text;
  private target = new Phaser.Math.Vector2();

  constructor() {
    super("Game");
  }

  create(): void {
    this.creature = this.registry.get("creature") as CreatureState;
    this.enemies = [];
    this.spawnAcc = 0;
    this.biteCooldown = 0;

    const era = ERA_BY_ID[this.creature.eraId];
    this.cameras.main.setBackgroundColor(era?.background ?? "#0b1d2a");

    this.createPlayer();
    this.createHud();

    // Steering: the creature swims toward the pointer / touch.
    this.target.set(this.player.x, this.player.y);
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.target.set(p.worldX, p.worldY));
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.target.set(p.worldX, p.worldY));

    // Open evolution menu (pauses gameplay, launches overlay scene).
    this.input.keyboard?.on("keydown-E", () => this.openEvolution());

    // Resume hook: EvolutionScene writes back the mutated creature here.
    this.events.on("resume", () => {
      this.creature = this.registry.get("creature") as CreatureState;
      this.redrawPlayer();
      this.persist();
    });
  }

  private createPlayer(): void {
    const stats = computeStats(this.creature);
    this.playerBody = this.add.circle(0, 0, 10 + stats.size * 3, 0x7fd1c4);
    this.player = this.add.container(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2, [
      this.playerBody,
    ]);
    this.redrawPlayer();
  }

  /** Re-skin the player from its currently equipped parts (color = mouth/body hint). */
  private redrawPlayer(): void {
    const stats = computeStats(this.creature);
    this.playerBody.setRadius(10 + stats.size * 3);
    const bodyPart = this.creature.parts.body ? PART_BY_ID[this.creature.parts.body] : undefined;
    if (bodyPart) this.playerBody.setFillStyle(Phaser.Display.Color.HexStringToColor(bodyPart.visual.color).color);
  }

  private createHud(): void {
    this.hud = this.add
      .text(12, 10, "", { fontFamily: "monospace", fontSize: "16px", color: "#e8f6f3" })
      .setScrollFactor(0)
      .setDepth(1000);

    const btn = this.add
      .text(GAME_CONFIG.width - 12, 10, "[ EVOLVE (E) ]", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffd27f",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true });
    btn.on("pointerdown", () => this.openEvolution());

    this.updateHud();
  }

  private updateHud(): void {
    const stats = computeStats(this.creature);
    const era = ERA_BY_ID[this.creature.eraId];
    this.hud.setText(
      [
        `Era: ${era?.name ?? "?"}`,
        `EVO: ${this.creature.evoPoints}  (advance @ ${era?.advanceAtPoints ?? "-"})`,
        `HP:  ${Math.ceil(this.creature.currentHealth)}/${stats.maxHealth}`,
        `ATK ${stats.attack}  DEF ${stats.defense}  SIZE ${stats.size}`,
      ].join("\n"),
    );
  }

  private openEvolution(): void {
    this.registry.set("creature", this.creature);
    this.scene.launch("Evolution");
    this.scene.pause();
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.movePlayer(dt);
    this.spawnAcc += dt;
    if (this.spawnAcc >= GAME_CONFIG.spawnIntervalSec && this.enemies.length < GAME_CONFIG.maxEnemies) {
      this.spawnAcc = 0;
      this.spawnEnemy();
    }
    this.moveEnemies(dt);
    this.biteCooldown = Math.max(0, this.biteCooldown - dt);
    this.handleContacts();
    this.checkEraAdvance();
    this.updateHud();
  }

  private movePlayer(dt: number): void {
    const stats = computeStats(this.creature);
    const dir = this.target.clone().subtract(new Phaser.Math.Vector2(this.player.x, this.player.y));
    if (dir.length() > 2) {
      dir.normalize().scale(stats.speed * dt);
      this.player.x = Phaser.Math.Clamp(this.player.x + dir.x, 0, GAME_CONFIG.width);
      this.player.y = Phaser.Math.Clamp(this.player.y + dir.y, 0, GAME_CONFIG.height);
    }
  }

  private spawnEnemy(): void {
    const def = pickSpawn(this.creature.eraId, Math.random());
    if (!def) return;

    // Spawn just off a random edge.
    const edge = Math.floor(Math.random() * 4);
    const x = edge === 1 ? GAME_CONFIG.width + 20 : edge === 3 ? -20 : Math.random() * GAME_CONFIG.width;
    const y = edge === 0 ? -20 : edge === 2 ? GAME_CONFIG.height + 20 : Math.random() * GAME_CONFIG.height;

    const color = Phaser.Display.Color.HexStringToColor(def.visual.color).color;
    let gfx: LiveEnemy["gfx"];
    if (def.visual.shape === "triangle") {
      gfx = this.add.triangle(x, y, 0, def.visual.radius, def.visual.radius, -def.visual.radius, -def.visual.radius, -def.visual.radius, color);
    } else if (def.visual.shape === "rect") {
      gfx = this.add.rectangle(x, y, def.visual.radius * 2, def.visual.radius * 2, color);
    } else {
      gfx = this.add.circle(x, y, def.visual.radius, color);
    }
    this.enemies.push({ def, gfx, health: def.stats.maxHealth });
  }

  private moveEnemies(dt: number): void {
    for (const e of this.enemies) {
      const toPlayer = new Phaser.Math.Vector2(this.player.x - e.gfx.x, this.player.y - e.gfx.y);
      let vx = 0;
      let vy = 0;
      const sp = e.def.stats.speed * dt;
      if (e.def.behavior === "hunt") {
        toPlayer.normalize().scale(sp);
        vx = toPlayer.x;
        vy = toPlayer.y;
      } else if (e.def.behavior === "flee") {
        toPlayer.normalize().scale(-sp);
        vx = toPlayer.x;
        vy = toPlayer.y;
      } else {
        // drift
        vx = Math.cos(e.gfx.x * 0.01) * sp * 0.5;
        vy = Math.sin(e.gfx.y * 0.01) * sp * 0.5;
      }
      e.gfx.x += vx;
      e.gfx.y += vy;
    }
  }

  private handleContacts(): void {
    const stats = computeStats(this.creature);
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.gfx.x, e.gfx.y);
      if (dist > GAME_CONFIG.biteRange + e.def.visual.radius) continue;

      if (!canEat(stats, e.def)) {
        // Too big to eat: it damages us on contact (throttled by cooldown).
        if (this.biteCooldown === 0) {
          this.creature = clampHealth({
            ...this.creature,
            currentHealth: this.creature.currentHealth - Math.max(1, e.def.stats.attack - stats.defense * 0.5),
          });
          this.biteCooldown = 0.6;
          this.flash(0xff5555);
        }
        continue;
      }

      if (this.biteCooldown > 0) continue;
      this.biteCooldown = 0.35;

      const out = resolveBite(this.creature, e.def, e.health);
      e.health = out.enemyRemainingHealth;
      if (out.damageToPlayer > 0) {
        this.creature = clampHealth({
          ...this.creature,
          currentHealth: this.creature.currentHealth - out.damageToPlayer,
        });
      }
      if (out.enemyDefeated) {
        this.creature = awardForEating(this.creature, e.def);
        e.gfx.destroy();
        this.enemies.splice(i, 1);
        this.flash(0x7fffd4);
      }
    }

    if (this.creature.currentHealth <= 0) this.onDeath();
  }

  private flash(color: number): void {
    this.playerBody.setFillStyle(color);
    this.time.delayedCall(80, () => this.redrawPlayer());
  }

  private checkEraAdvance(): void {
    if (!canAdvanceEra(this.creature)) return;
    this.creature = advanceEra(this.creature);
    this.persist();
    // Restart gameplay in the new era (new background + roster).
    this.registry.set("creature", this.creature);
    this.enemies.forEach((e) => e.gfx.destroy());
    this.enemies = [];
    this.scene.restart();
  }

  private onDeath(): void {
    // Soft fail for the prototype: respawn at full health, keep progress.
    this.creature = clampHealth({ ...this.creature, currentHealth: 9999 });
    this.flash(0xffffff);
  }

  private persist(): void {
    save(buildSave(this.creature, Object.values(this.creature.parts).filter(Boolean) as string[]));
  }
}
