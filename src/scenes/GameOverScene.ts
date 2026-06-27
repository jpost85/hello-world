import Phaser from "phaser";
import { GAME_CONFIG } from "../config";
import { sound } from "../audio/SoundManager";

/**
 * Shown when the creature dies. Progress is kept (the last save stands), so the
 * player resumes their era from a fresh starter body — losing momentum, not the
 * whole run. Tuned to be a setback, not a wipe.
 */
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super("GameOver");
  }

  create(data: { eraName?: string; evoPoints?: number }): void {
    const { width, height } = GAME_CONFIG;
    this.add.rectangle(0, 0, width, height, 0x14000a, 0.85).setOrigin(0, 0);

    this.add
      .text(width / 2, height * 0.34, "YOU WERE EATEN", {
        fontFamily: "monospace",
        fontSize: "40px",
        color: "#ff7a7a",
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        height * 0.34 + 44,
        `${data.eraName ?? "Your era"} · ${data.evoPoints ?? 0} EVO banked`,
        { fontFamily: "monospace", fontSize: "15px", color: "#e8c2c2" },
      )
      .setOrigin(0.5);

    const retry = this.add
      .text(width / 2, height * 0.62, "↻  TRY AGAIN", {
        fontFamily: "monospace",
        fontSize: "26px",
        color: "#a8e6a1",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    retry.on("pointerover", () => retry.setScale(1.08));
    retry.on("pointerout", () => retry.setScale(1));
    retry.on("pointerdown", () => {
      sound.unlock();
      this.scene.start("Title");
    });
  }
}
