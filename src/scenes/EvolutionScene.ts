import Phaser from "phaser";
import type { CreatureState } from "../systems/types";
import { GAME_CONFIG } from "../config";
import { availableEvolutions, evolve } from "../systems/EvolutionSystem";

/**
 * The evolution menu, launched as a paused overlay on top of GameScene. It
 * lists what the creature can mutate into, shows costs/affordability, applies
 * the choice via EvolutionSystem, then resumes gameplay with the new body.
 */
export class EvolutionScene extends Phaser.Scene {
  private creature!: CreatureState;
  private rows: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("Evolution");
  }

  create(): void {
    this.creature = this.registry.get("creature") as CreatureState;

    this.add
      .rectangle(0, 0, GAME_CONFIG.width, GAME_CONFIG.height, 0x000000, 0.78)
      .setOrigin(0, 0);

    this.add.text(40, 30, "EVOLVE", {
      fontFamily: "monospace",
      fontSize: "28px",
      color: "#ffd27f",
    });
    this.add.text(40, 66, `EVO points: ${this.creature.evoPoints}`, {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#e8f6f3",
    });

    this.renderOptions();

    this.add
      .text(40, GAME_CONFIG.height - 40, "[ CLOSE (Esc) ]", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#9ecae1",
      })
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

    options.forEach((opt, i) => {
      const y = 110 + i * 34;
      const mods = Object.entries(opt.part.statMods)
        .map(([k, v]) => `${k}+${v}`)
        .join(" ");
      const label = `${opt.part.slot.padEnd(6)} ${opt.part.name.padEnd(16)} ${String(opt.part.cost).padStart(4)}p   ${mods}`;
      const row = this.add
        .text(40, y, (opt.affordable ? "▶ " : "  ") + label, {
          fontFamily: "monospace",
          fontSize: "16px",
          color: opt.affordable ? "#a8e6a1" : "#7a8a90",
        })
        .setInteractive({ useHandCursor: opt.affordable });

      if (opt.affordable) {
        row.on("pointerdown", () => this.choose(opt.part.id));
      }
      this.rows.push(row);
    });

    if (options.length === 0) {
      this.rows.push(
        this.add.text(40, 110, "No mutations available — go eat something.", {
          fontFamily: "monospace",
          fontSize: "16px",
          color: "#7a8a90",
        }),
      );
    }
  }

  private choose(partId: string): void {
    const res = evolve(this.creature, partId);
    if (!res.ok) return;
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
