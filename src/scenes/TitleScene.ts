import Phaser from "phaser";
import type { CreatureState } from "../systems/types";
import { GAME_CONFIG } from "../config";
import { createStarterCreature } from "../systems/CreatureModel";
import { load, clear } from "../persistence/SaveManager";
import { ERA_ORDER, ERA_BY_ID } from "../data/eras";
import { sound } from "../audio/SoundManager";

/**
 * Start screen. Offers Continue (if a save exists) or a fresh start, and serves
 * as the user gesture that unlocks the Web Audio context.
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super("Title");
  }

  create(): void {
    const { width, height } = GAME_CONFIG;
    this.cameras.main.setBackgroundColor("#0b1d2a");

    this.add
      .text(width / 2, height * 0.28, "EVO", {
        fontFamily: "monospace",
        fontSize: "72px",
        color: "#7fd1c4",
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height * 0.28 + 60, "Search for Eden", {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#e8f6f3",
      })
      .setOrigin(0.5);

    const saved = load();
    const startY = height * 0.58;

    if (saved) {
      const era = ERA_BY_ID[saved.creature.eraId];
      this.button(width / 2, startY, "▶  CONTINUE", "#a8e6a1", () => this.begin(saved.creature));
      this.add
        .text(width / 2, startY + 26, `${era?.name ?? "?"} · ${saved.creature.evoPoints} EVO`, {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#7a8a90",
        })
        .setOrigin(0.5);
      this.button(width / 2, startY + 64, "✦  NEW GAME", "#ffd27f", () => {
        clear();
        this.begin(createStarterCreature(ERA_ORDER[0]));
      });
    } else {
      this.button(width / 2, startY, "✦  START", "#ffd27f", () =>
        this.begin(createStarterCreature(ERA_ORDER[0])),
      );
    }

    this.add
      .text(width / 2, height - 30, "move: point / tap   ·   dash: SPACE   ·   evolve: E", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#5e7077",
      })
      .setOrigin(0.5);
  }

  private button(x: number, y: number, label: string, color: string, onClick: () => void): void {
    const t = this.add
      .text(x, y, label, { fontFamily: "monospace", fontSize: "26px", color })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    t.on("pointerover", () => t.setScale(1.08));
    t.on("pointerout", () => t.setScale(1));
    t.on("pointerdown", () => {
      sound.unlock();
      onClick();
    });
  }

  private begin(creature: CreatureState): void {
    sound.unlock();
    this.registry.set("creature", creature);
    this.scene.start("Game");
  }
}
