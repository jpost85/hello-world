import Phaser from "phaser";
import { GAME_CONFIG } from "./config";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { EvolutionScene } from "./scenes/EvolutionScene";

/**
 * Entry point. Phaser is only ever wired up here and in `src/scenes`; the
 * simulation in `src/systems` stays renderer-agnostic and unit-testable.
 */
new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#0b1d2a",
  width: GAME_CONFIG.width,
  height: GAME_CONFIG.height,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: { debug: false },
  },
  scene: [BootScene, GameScene, EvolutionScene],
});
