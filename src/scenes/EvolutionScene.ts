import Phaser from "phaser";
import type { CreatureState } from "../systems/types";
import { GAME_CONFIG } from "../config";
import { availableEvolutions, evolve } from "../systems/EvolutionSystem";
import { sound } from "../audio/SoundManager";

/**
 * The evolution menu, launched as a paused overlay on top of GameScene. It
 * lists what the creature can mutate into, shows costs/affordability, applies
 * the choice via EvolutionSystem, then resumes gameplay with the new body.
 */
export class EvolutionScene extends Phaser.Scene {
  private creature!: CreatureState;
  private rows: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super("Evolution");
  }

  create(): void {
    const { width, height, safeTop } = GAME_CONFIG;
    this.creature = this.registry.get("creature") as CreatureState;

    this.add.rectangle(0, 0, width, height, 0x000000, 0.82).setOrigin(0, 0);

    this.add.text(24, safeTop, "EVOLVE", {
      fontFamily: "monospace",
      fontSize: "30px",
      color: "#ffd27f",
    });
    this.add.text(24, safeTop + 40, `EVO points available: ${this.creature.evoPoints}`, {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#e8f6f3",
    });

    this.renderOptions();

    // Big bottom-of-screen close button for thumbs.
    this.add
      .text(width / 2, height - 36, "✕  CLOSE", {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#9ecae1",
        backgroundColor: "#16323d",
        padding: { x: 24, y: 14 },
      })
      .setOrigin(0.5, 1)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.close());

    this.input.keyboard?.on("keydown-ESC", () => this.close());
  }

  private renderOptions(): void {
    this.rows.forEach((r) => r.destroy());
    this.rows = [];

    const options = availableEvolutions(this.creature).sort(
      (a, b) => a.part.slot.localeCompare(b.part.slot) || a.part.cost - b.part.cost,
    );

    const startY = GAME_CONFIG.safeTop + 80;
    const rowH = 64;
    const rowW = GAME_CONFIG.width - 48;

    options.forEach((opt, i) => {
      const y = startY + i * rowH;
      const mods = Object.entries(opt.part.statMods)
        .map(([k, v]) => `${k}+${v}`)
        .join("  ");
      const affordable = opt.affordable;

      // Tappable card: slot+name+cost on top, stat mods below.
      const card = this.add
        .rectangle(24, y, rowW, rowH - 10, affordable ? 0x1c3a47 : 0x14222a, 0.9)
        .setOrigin(0, 0)
        .setStrokeStyle(1, affordable ? 0x4fb0c6 : 0x2a3a42);
      const title = this.add.text(38, y + 9, `${opt.part.name}`, {
        fontFamily: "monospace",
        fontSize: "17px",
        color: affordable ? "#a8e6a1" : "#7a8a90",
      });
      const cost = this.add
        .text(24 + rowW - 14, y + 9, `${opt.part.cost}p`, {
          fontFamily: "monospace",
          fontSize: "17px",
          color: affordable ? "#ffd27f" : "#6a7a82",
        })
        .setOrigin(1, 0);
      const sub = this.add.text(38, y + 32, `${opt.part.slot} · ${mods}`, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: affordable ? "#bcd9d4" : "#5e7077",
      });

      if (affordable) {
        card.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.choose(opt.part.id));
      }
      this.rows.push(card, title, cost, sub);
    });

    if (options.length === 0) {
      this.rows.push(
        this.add.text(24, startY, "No mutations available — go eat something.", {
          fontFamily: "monospace",
          fontSize: "15px",
          color: "#7a8a90",
        }),
      );
    }
  }

  private choose(partId: string): void {
    const res = evolve(this.creature, partId);
    if (!res.ok) return;
    sound.play("evolve");
    this.creature = res.creature;
    this.registry.set("creature", this.creature);
    // Refresh the menu in place so the player can spend more points.
    this.scene.restart();
  }

  private close(): void {
    this.registry.set("creature", this.creature);
    this.scene.stop();
    this.scene.resume("Game");
  }
}
